// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IIOTAStreams.sol";

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
    bytes public streamsChannelAddress;
    
    // Events
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed borrower,
        uint256 debtAmount,
        uint256 collateralAmount,
        uint256 startTime,
        uint256 endTime
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmount
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );
    
    event AuctionCanceled(
        uint256 indexed auctionId,
        string reason
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
        
        // Initialize IOTA Streams channel for auction events
        bytes memory seed = abi.encodePacked(blockhash(block.number - 1), address(this));
        streamsChannelAddress = iotaStreams.createChannel(seed);
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
            canceled: false
        });
        
        // Emit auction created event
        emit AuctionCreated(
            auctionId,
            borrower,
            debtAmount,
            collateralToLiquidate,
            block.timestamp,
            block.timestamp + auctionDuration
        );
        
        // Send event to IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            borrower,
            debtAmount,
            collateralToLiquidate,
            block.timestamp,
            block.timestamp + auctionDuration
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "AUCTION_CREATED");
        
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
        
        // Emit bid placed event
        emit BidPlaced(auctionId, msg.sender, bidAmount);
        
        // Send event to IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            msg.sender,
            bidAmount
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "BID_PLACED");
        
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
            
            // Emit auction ended event
            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
            
            // Send event to IOTA Streams
            bytes memory payload = abi.encode(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );
            
            iotaStreams.sendMessage(streamsChannelAddress, payload, "AUCTION_ENDED");
        } else {
            // No bids were placed, cancel the auction
            auction.canceled = true;
            
            emit AuctionCanceled(auctionId, "No bids placed");
            
            // Send event to IOTA Streams
            bytes memory payload = abi.encode(
                auctionId,
                "No bids placed"
            );
            
            iotaStreams.sendMessage(streamsChannelAddress, payload, "AUCTION_CANCELED");
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
        
        emit AuctionCanceled(auctionId, reason);
        
        // Send event to IOTA Streams
        bytes memory payload = abi.encode(
            auctionId,
            reason
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "AUCTION_CANCELED");
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
        bool canceled
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
            auction.canceled
        );
    }
}
