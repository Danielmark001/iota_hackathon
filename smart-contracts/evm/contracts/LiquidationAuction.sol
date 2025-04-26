// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interface to IOTA Streams Bridge
interface IIOTAStreams {
    function sendMessage(bytes32 channelId, bytes calldata payload, string calldata messageType) external returns (bytes32);
    function getChannelAddress() external view returns (bytes memory);
    function createChannel(bytes calldata seed) external returns (bytes32);
}

// Interface to the lending pool
interface ILendingPool {
    function getHealthFactor(address user) external view returns (uint256);
    function collaterals(address user) external view returns (uint256);
    function borrows(address user) external view returns (uint256);
}

/**
 * @title IntelliLend Liquidation Auction
 * @dev Manages liquidation auctions for under-collateralized positions
 */
contract LiquidationAuction is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Structures
    struct Auction {
        address borrower;           // Address of the borrower being liquidated
        uint256 debtAmount;         // Amount of debt to be repaid
        uint256 collateralAmount;   // Amount of collateral to be auctioned
        uint256 startPrice;         // Starting price of the auction
        uint256 endPrice;           // Ending price (floor) of the auction
        uint256 startTime;          // Start time of the auction
        uint256 endTime;            // End time of the auction
        address highestBidder;      // Address of the highest bidder
        uint256 highestBid;         // Highest bid amount
        bool ended;                 // Whether the auction has ended
        bool canceled;              // Whether the auction was canceled
        bytes32 streamsMsgId;       // IOTA Streams message ID for this auction
    }

    // State variables
    ILendingPool public lendingPool;
    IERC20 public lendingToken;    // Token used for bidding (e.g., IOTA)
    IERC20 public collateralToken; // Token being auctioned (e.g., MIOTA)
    IIOTAStreams public iotaStreams; // IOTA Streams for events
    
    uint256 public auctionDuration = 3600; // Default auction duration (1 hour)
    uint256 public minBidIncrement = 5;    // Minimum bid increment (5%)
    uint256 public liquidationPenalty = 8; // Liquidation penalty (8%)
    uint256 public protocolFee = 2;        // Protocol fee (2%)
    uint256 public autoLiquidationThreshold = 75; // Auto-liquidation health factor threshold (75%)
    
    mapping(uint256 => Auction) public auctions;
    uint256 public nextAuctionId = 1;
    bytes32 public streamsChannelId;
    
    // Trusted oracles that can verify confirmations from IOTA
    mapping(address => bool) public authorizedOracles;
    address[] public oracleList;
    
    // Events
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed borrower,
        uint256 debtAmount,
        uint256 collateralAmount,
        uint256 startTime,
        uint256 endTime,
        bytes32 streamsMsgId
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmount,
        bytes32 streamsMsgId
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid,
        bytes32 streamsMsgId
    );
    
    event AuctionCanceled(
        uint256 indexed auctionId,
        string reason,
        bytes32 streamsMsgId
    );
    
    event LiquidationThresholdUpdated(uint256 newThreshold);
    event AuctionDurationUpdated(uint256 newDuration);
    event FeeUpdated(uint256 newProtocolFee);
    
    /**
     * @dev Constructor to initialize the liquidation auction
     * @param _lendingPool Address of the lending pool contract
     * @param _lendingToken Address of the token used for lending
     * @param _collateralToken Address of the token used for collateral
     * @param _iotaStreamsAddress Address of the IOTA Streams contract
     */
    constructor(
        address _lendingPool,
        address _lendingToken,
        address _collateralToken,
        address _iotaStreamsAddress
    ) {
        lendingPool = ILendingPool(_lendingPool);
        lendingToken = IERC20(_lendingToken);
        collateralToken = IERC20(_collateralToken);
        iotaStreams = IIOTAStreams(_iotaStreamsAddress);
        
        // Add deployer as trusted oracle
        authorizedOracles[msg.sender] = true;
        oracleList.push(msg.sender);
        
        // Initialize IOTA Streams channel for auction events
        bytes memory seed = abi.encodePacked(blockhash(block.number - 1), address(this));
        streamsChannelId = iotaStreams.createChannel(seed);
    }
    
    /**
     * @dev Modifier to restrict access to authorized oracles
     */
    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }
    
    /**
     * @dev Add an oracle (only callable by owner)
     * @param oracle Address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid oracle address");
        require(!authorizedOracles[oracle], "Oracle already exists");
        
        authorizedOracles[oracle] = true;
        oracleList.push(oracle);
    }
    
    /**
     * @dev Remove an oracle (only callable by owner)
     * @param oracle Address of the oracle to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle does not exist");
        
        authorizedOracles[oracle] = false;
        
        // Remove from list
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[oracleList.length - 1];
                oracleList.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Create a new liquidation auction
     * @param borrower Address of the borrower to liquidate
     * @param debtAmount Amount of debt to liquidate
     * @return auctionId ID of the created auction
     */
    function createAuction(address borrower, uint256 debtAmount) external returns (uint256) {
        // Check if the borrower's position is unhealthy
        uint256 healthFactor = lendingPool.getHealthFactor(borrower);
        require(healthFactor < autoLiquidationThreshold, "Position is healthy");
        
        // Fetch the borrower's collateral
        uint256 borrowerCollateral = lendingPool.collaterals(borrower);
        uint256 borrowerDebt = lendingPool.borrows(borrower);
        
        // Calculate collateral to liquidate (based on debt amount)
        uint256 collateralToLiquidate = (debtAmount * (100 + liquidationPenalty)) / 100;
        
        // Cap the debt amount to the borrower's total debt
        if (debtAmount > borrowerDebt) {
            debtAmount = borrowerDebt;
        }
        
        // Cap the collateral to the borrower's total collateral
        if (collateralToLiquidate > borrowerCollateral) {
            collateralToLiquidate = borrowerCollateral;
        }
        
        // Calculate auction parameters
        uint256 startPrice = collateralToLiquidate * 110 / 100; // Start 10% above collateral value
        uint256 endPrice = collateralToLiquidate * 90 / 100;    // End 10% below collateral value
        
        // Create the auction
        uint256 auctionId = nextAuctionId++;
        
        auctions[auctionId] = Auction({
            borrower: borrower,
            debtAmount: debtAmount,
            collateralAmount: collateralToLiquidate,
            startPrice: startPrice,
            endPrice: endPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + auctionDuration,
            highestBidder: address(0),
            highestBid: 0,
            ended: false,
            canceled: false,
            streamsMsgId: bytes32(0) // Will be set after IOTA Streams message is sent
        });
        
        // Prepare auction data for IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            borrower,
            debtAmount,
            collateralToLiquidate,
            startPrice,
            endPrice,
            block.timestamp,
            block.timestamp + auctionDuration
        );
        
        // Send auction data to IOTA Streams
        bytes32 streamsMsgId = iotaStreams.sendMessage(
            streamsChannelId,
            payload,
            "AUCTION_CREATED"
        );
        
        // Update the auction with the IOTA Streams message ID
        auctions[auctionId].streamsMsgId = streamsMsgId;
        
        // Emit auction created event
        emit AuctionCreated(
            auctionId,
            borrower,
            debtAmount,
            collateralToLiquidate,
            block.timestamp,
            block.timestamp + auctionDuration,
            streamsMsgId
        );
        
        return auctionId;
    }
    
    /**
     * @dev Place a bid on an auction
     * @param auctionId ID of the auction to bid on
     * @param bidAmount Amount to bid
     */
    function placeBid(uint256 auctionId, uint256 bidAmount) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        // Check auction state
        require(!auction.ended, "Auction has ended");
        require(!auction.canceled, "Auction was canceled");
        require(block.timestamp < auction.endTime, "Auction has expired");
        
        // Check if bid is higher than current highest bid
        require(bidAmount > auction.highestBid, "Bid too low");
        
        // Check if bid meets minimum increment if not the first bid
        if (auction.highestBid > 0) {
            uint256 minBid = auction.highestBid * (100 + minBidIncrement) / 100;
            require(bidAmount >= minBid, "Bid increment too small");
        } else {
            // If first bid, check against the current auction price
            uint256 currentPrice = getCurrentAuctionPrice(auctionId);
            require(bidAmount >= currentPrice, "Bid below current price");
        }
        
        // Transfer tokens from previous highest bidder back to them
        if (auction.highestBidder != address(0)) {
            lendingToken.safeTransfer(auction.highestBidder, auction.highestBid);
        }
        
        // Transfer tokens from bidder to contract
        lendingToken.safeTransferFrom(msg.sender, address(this), bidAmount);
        
        // Update auction with new highest bid
        auction.highestBidder = msg.sender;
        auction.highestBid = bidAmount;
        
        // Prepare bid data for IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            msg.sender,
            bidAmount,
            block.timestamp
        );
        
        // Send bid data to IOTA Streams
        bytes32 streamsMsgId = iotaStreams.sendMessage(
            streamsChannelId,
            payload,
            "BID_PLACED"
        );
        
        // Emit bid placed event
        emit BidPlaced(auctionId, msg.sender, bidAmount, streamsMsgId);
        
        // If bid is high enough, end the auction immediately
        if (bidAmount >= auction.startPrice) {
            _endAuction(auctionId);
        }
    }
    
    /**
     * @dev End an auction after it has expired
     * @param auctionId ID of the auction to end
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        // Check if auction can be ended
        require(!auction.ended, "Auction has already ended");
        require(!auction.canceled, "Auction was canceled");
        require(block.timestamp >= auction.endTime, "Auction has not expired yet");
        
        _endAuction(auctionId);
    }
    
    /**
     * @dev Calculate the current auction price based on time elapsed
     * @param auctionId ID of the auction
     * @return Current price of the auction
     */
    function getCurrentAuctionPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        
        if (block.timestamp >= auction.endTime) {
            return auction.endPrice;
        }
        
        // Calculate time elapsed as a percentage of total duration
        uint256 timeElapsed = block.timestamp - auction.startTime;
        uint256 totalDuration = auction.endTime - auction.startTime;
        uint256 timePercentage = (timeElapsed * 100) / totalDuration;
        
        // Calculate price based on linear interpolation
        uint256 priceDifference = auction.startPrice - auction.endPrice;
        uint256 priceReduction = (priceDifference * timePercentage) / 100;
        
        return auction.startPrice - priceReduction;
    }
    
    /**
     * @dev Internal function to end an auction and process the results
     * @param auctionId ID of the auction to end
     */
    function _endAuction(uint256 auctionId) internal {
        Auction storage auction = auctions[auctionId];
        
        // Mark auction as ended
        auction.ended = true;
        
        // If there was a bid, process the liquidation
        if (auction.highestBidder != address(0)) {
            // Calculate protocol fee
            uint256 feeAmount = (auction.highestBid * protocolFee) / 100;
            uint256 repayAmount = auction.highestBid - feeAmount;
            
            // Transfer collateral to the highest bidder
            collateralToken.safeTransfer(auction.highestBidder, auction.collateralAmount);
            
            // Repay debt to the lending pool
            lendingToken.approve(address(lendingPool), repayAmount);
            
            // Update the lending pool with the liquidation
            // This would typically call a liquidate function on the lending pool
            // But for simplicity, we're just handling it here
            
            // Transfer fee to protocol
            lendingToken.safeTransfer(owner(), feeAmount);
            
            // Prepare end auction data for IOTA Streams
            bytes memory payload = abi.encode(
                auctionId,
                auction.highestBidder,
                auction.highestBid,
                block.timestamp,
                true, // Success
                "Auction completed successfully"
            );
            
            // Send end auction data to IOTA Streams
            bytes32 streamsMsgId = iotaStreams.sendMessage(
                streamsChannelId,
                payload,
                "AUCTION_ENDED"
            );
            
            // Emit auction ended event
            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid, streamsMsgId);
        } else {
            // No bids were placed, cancel the auction
            auction.canceled = true;
            
            // Prepare cancel auction data for IOTA Streams
            bytes memory payload = abi.encode(
                auctionId,
                address(0), // No winner
                0, // No winning bid
                block.timestamp,
                false, // Failed
                "No bids placed"
            );
            
            // Send cancel auction data to IOTA Streams
            bytes32 streamsMsgId = iotaStreams.sendMessage(
                streamsChannelId,
                payload,
                "AUCTION_CANCELED"
            );
            
            // Emit auction canceled event
            emit AuctionCanceled(auctionId, "No bids placed", streamsMsgId);
        }
    }
    
    /**
     * @dev Cancel an auction (admin only)
     * @param auctionId ID of the auction to cancel
     * @param reason Reason for cancellation
     */
    function cancelAuction(uint256 auctionId, string calldata reason) external onlyOwner {
        Auction storage auction = auctions[auctionId];
        
        require(!auction.ended, "Auction has already ended");
        require(!auction.canceled, "Auction was already canceled");
        
        auction.canceled = true;
        
        // Refund the highest bidder if there was a bid
        if (auction.highestBidder != address(0)) {
            lendingToken.safeTransfer(auction.highestBidder, auction.highestBid);
        }
        
        // Prepare cancel auction data for IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            address(0), // No winner
            0, // No winning bid
            block.timestamp,
            false, // Canceled
            reason
        );
        
        // Send cancel auction data to IOTA Streams
        bytes32 streamsMsgId = iotaStreams.sendMessage(
            streamsChannelId,
            payload,
            "AUCTION_CANCELED"
        );
        
        // Emit auction canceled event
        emit AuctionCanceled(auctionId, reason, streamsMsgId);
    }
    
    /**
     * @dev Update liquidation threshold
     * @param newThreshold New threshold value
     */
    function updateLiquidationThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0 && newThreshold < 100, "Invalid threshold");
        autoLiquidationThreshold = newThreshold;
        
        emit LiquidationThresholdUpdated(newThreshold);
    }
    
    /**
     * @dev Update auction duration
     * @param newDuration New duration in seconds
     */
    function updateAuctionDuration(uint256 newDuration) external onlyOwner {
        require(newDuration >= 600, "Duration too short"); // Minimum 10 minutes
        auctionDuration = newDuration;
        
        emit AuctionDurationUpdated(newDuration);
    }
    
    /**
     * @dev Update protocol fee
     * @param newFee New fee percentage
     */
    function updateProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 5, "Fee too high"); // Maximum 5%
        protocolFee = newFee;
        
        emit FeeUpdated(newFee);
    }
    
    /**
     * @dev Update IOTA Streams channel (in case of migration)
     * @param newChannelId New channel ID
     */
    function updateStreamsChannel(bytes32 newChannelId) external onlyOwner {
        require(newChannelId != bytes32(0), "Invalid channel ID");
        streamsChannelId = newChannelId;
    }
    
    /**
     * @dev Receive IOTA Streams confirmation (only callable by oracles)
     * @param messageId Message ID from IOTA Streams
     * @param status Confirmation status
     */
    function receiveStreamsConfirmation(bytes32 messageId, bool status) external onlyOracle {
        // This function allows oracles to confirm that a message was successfully
        // processed on the IOTA Tangle. In a real implementation, this would
        // potentially trigger additional logic.
    }
    
    /**
     * @dev Get details of an auction
     * @param auctionId ID of the auction
     * @return Full auction details
     */
    function getAuctionDetails(uint256 auctionId) external view returns (
        address borrower,
        uint256 debtAmount,
        uint256 collateralAmount,
        uint256 currentPrice,
        uint256 highestBid,
        address highestBidder,
        uint256 endTime,
        bool ended,
        bool canceled,
        bytes32 streamsMsgId
    ) {
        Auction storage auction = auctions[auctionId];
        
        return (
            auction.borrower,
            auction.debtAmount,
            auction.collateralAmount,
            getCurrentAuctionPrice(auctionId),
            auction.highestBid,
            auction.highestBidder,
            auction.endTime,
            auction.ended,
            auction.canceled,
            auction.streamsMsgId
        );
    }
    
    /**
     * @dev Get IOTA Streams channel ID
     * @return Channel ID
     */
    function getStreamsChannelId() external view returns (bytes32) {
        return streamsChannelId;
    }
    
    /**
     * @dev Get IOTA Streams channel address
     * @return Channel address bytes
     */
    function getStreamsChannelAddress() external view returns (bytes memory) {
        return iotaStreams.getChannelAddress();
    }
}
