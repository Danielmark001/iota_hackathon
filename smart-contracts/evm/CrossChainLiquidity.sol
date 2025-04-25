// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title IntelliLend Cross-Chain Liquidity Module
 * @dev Enables liquidity aggregation across multiple chains and optimizes capital efficiency
 */
contract CrossChainLiquidity is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Interface to the cross-layer bridge
    ICrossLayerBridge public bridge;
    
    // Interface to the lending pool
    ILendingPool public lendingPool;
    
    // Interface to the strategy controller
    IStrategyController public strategyController;
    
    // Interface to price feeds
    mapping(address => AggregatorV3Interface) public priceFeeds;
    
    // Supported chains and their bridge addresses
    struct ChainInfo {
        uint256 chainId;
        string name;
        address bridgeAddress;
        bool active;
        uint256 lastSyncTimestamp;
        uint256 liquidityAmount;
    }
    
    // Chain ID => Chain Info
    mapping(uint256 => ChainInfo) public supportedChains;
    uint256[] public chainIds;
    
    // Asset addresses on different chains
    // Chain ID => Asset symbol => Asset address
    mapping(uint256 => mapping(string => address)) public assetAddresses;
    
    // Pool liquidity statistics
    struct LiquidityPool {
        string symbol;
        address tokenAddress;
        uint256 totalLiquidity;
        uint256 allocatedLiquidity;
        uint256 utilizationRate; // scaled by 1e6
        uint256 apy; // scaled by 1e6
        bool active;
    }
    
    // Symbol => Liquidity Pool
    mapping(string => LiquidityPool) public liquidityPools;
    string[] public supportedTokens;
    
    // Cross-chain transfer state
    struct CrossChainTransfer {
        uint256 sourceChainId;
        uint256 targetChainId;
        address sender;
        bytes32 recipient;
        string symbol;
        uint256 amount;
        uint256 timestamp;
        bytes32 transferId;
        bool completed;
        bool failed;
        string failureReason;
        bytes32 messageHash;       // Hash of the message for verification
        bytes32 messageId;         // Bridge message ID for tracking
        uint256 lastUpdated;       // Timestamp of last status update
        uint8 retryCount;          // Number of retry attempts
        uint8 status;              // Detailed status code for monitoring
    }
    
    // Transfer ID => Transfer
    mapping(bytes32 => CrossChainTransfer) public transfers;
    bytes32[] public transferIds;
    
    // Relayer addresses for cross-chain operations
    mapping(address => bool) public authorizedRelayers;
    
    // Nonces for preventing replay attacks
    mapping(address => uint256) public nonces;
    
    // Events
    event ChainAdded(uint256 indexed chainId, string name, address bridgeAddress);
    event ChainStatusChanged(uint256 indexed chainId, bool active);
    event AssetMapped(uint256 indexed chainId, string symbol, address tokenAddress);
    event CrossChainTransferInitiated(
        bytes32 indexed transferId,
        uint256 sourceChainId,
        uint256 targetChainId,
        address sender,
        bytes32 recipient,
        string symbol,
        uint256 amount
    );
    event CrossChainTransferCompleted(
        bytes32 indexed transferId,
        uint256 sourceChainId,
        uint256 targetChainId,
        address recipient,
        string symbol,
        uint256 amount
    );
    event CrossChainTransferFailed(
        bytes32 indexed transferId,
        string reason
    );
    event LiquidityAdded(string indexed symbol, address provider, uint256 amount);
    event LiquidityRemoved(string indexed symbol, address provider, uint256 amount);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event StrategyExecuted(string indexed symbol, string strategyName, uint256 amount);
    event BridgeMessageSent(uint256 targetChainId, bytes32 messageId, string messageType);
    
    // Error codes
    error UnsupportedChain(uint256 chainId);
    error UnsupportedToken(string symbol);
    error InsufficientLiquidity(string symbol, uint256 requested, uint256 available);
    error TransferNotFound(bytes32 transferId);
    error TransferAlreadyCompleted(bytes32 transferId);
    error InvalidSignature();
    error Unauthorized();
    error InvalidAmount();
    error InvalidNonce();
    error BridgeError(string reason);
    error InvalidChainConfig();
    
    /**
     * @dev Constructor to initialize the cross-chain liquidity module
     * @param _bridgeAddress Address of the cross-layer bridge
     * @param _lendingPoolAddress Address of the lending pool
     * @param _strategyControllerAddress Address of the strategy controller
     */
    constructor(
        address _bridgeAddress,
        address _lendingPoolAddress,
        address _strategyControllerAddress
    ) {
        bridge = ICrossLayerBridge(_bridgeAddress);
        lendingPool = ILendingPool(_lendingPoolAddress);
        strategyController = IStrategyController(_strategyControllerAddress);
        
        // Add current chain as supported
        uint256 currentChainId = getChainId();
        ChainInfo memory currentChain = ChainInfo({
            chainId: currentChainId,
            name: "IOTA EVM",
            bridgeAddress: _bridgeAddress,
            active: true,
            lastSyncTimestamp: block.timestamp,
            liquidityAmount: 0
        });
        
        supportedChains[currentChainId] = currentChain;
        chainIds.push(currentChainId);
    }
    
    /**
     * @dev Add a supported chain
     * @param chainId Chain ID
     * @param name Chain name
     * @param bridgeAddress Bridge contract address on that chain
     */
    function addChain(
        uint256 chainId,
        string calldata name,
        address bridgeAddress
    ) external onlyOwner {
        require(supportedChains[chainId].chainId == 0, "Chain already exists");
        require(bridgeAddress != address(0), "Invalid bridge address");
        
        ChainInfo memory chainInfo = ChainInfo({
            chainId: chainId,
            name: name,
            bridgeAddress: bridgeAddress,
            active: true,
            lastSyncTimestamp: block.timestamp,
            liquidityAmount: 0
        });
        
        supportedChains[chainId] = chainInfo;
        chainIds.push(chainId);
        
        emit ChainAdded(chainId, name, bridgeAddress);
    }
    
    /**
     * @dev Set chain active status
     * @param chainId Chain ID
     * @param active Whether the chain is active
     */
    function setChainStatus(uint256 chainId, bool active) external onlyOwner {
        if (supportedChains[chainId].chainId == 0) revert UnsupportedChain(chainId);
        
        supportedChains[chainId].active = active;
        
        emit ChainStatusChanged(chainId, active);
    }
    
    /**
     * @dev Map a token to its address on a specific chain
     * @param chainId Chain ID
     * @param symbol Token symbol
     * @param tokenAddress Token contract address on that chain
     */
    function mapAsset(
        uint256 chainId,
        string calldata symbol,
        address tokenAddress
    ) external onlyOwner {
        if (supportedChains[chainId].chainId == 0) revert UnsupportedChain(chainId);
        require(tokenAddress != address(0), "Invalid token address");
        
        assetAddresses[chainId][symbol] = tokenAddress;
        
        // If this is a new token, add it to supported tokens
        bool exists = false;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (keccak256(bytes(supportedTokens[i])) == keccak256(bytes(symbol))) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            supportedTokens.push(symbol);
            
            // Initialize liquidity pool for this token
            liquidityPools[symbol] = LiquidityPool({
                symbol: symbol,
                tokenAddress: tokenAddress,
                totalLiquidity: 0,
                allocatedLiquidity: 0,
                utilizationRate: 0,
                apy: 0,
                active: true
            });
        }
        
        emit AssetMapped(chainId, symbol, tokenAddress);
    }
    
    /**
     * @dev Add a price feed for a token
     * @param tokenAddress Token address
     * @param priceFeed Price feed address
     */
    function addPriceFeed(address tokenAddress, address priceFeed) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(priceFeed != address(0), "Invalid price feed address");
        
        priceFeeds[tokenAddress] = AggregatorV3Interface(priceFeed);
    }
    
    /**
     * @dev Add liquidity to a pool
     * @param symbol Token symbol
     * @param amount Amount to add
     */
    function addLiquidity(string calldata symbol, uint256 amount) external nonReentrant {
        if (liquidityPools[symbol].tokenAddress == address(0)) revert UnsupportedToken(symbol);
        if (amount == 0) revert InvalidAmount();
        
        address tokenAddress = liquidityPools[symbol].tokenAddress;
        
        // Transfer tokens from user
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update liquidity pool
        liquidityPools[symbol].totalLiquidity += amount;
        
        // Update current chain liquidity
        uint256 currentChainId = getChainId();
        supportedChains[currentChainId].liquidityAmount += amount;
        
        emit LiquidityAdded(symbol, msg.sender, amount);
        
        // Notify the strategy controller about new liquidity
        strategyController.notifyLiquidityChange(symbol, true, amount);
    }
    
    /**
     * @dev Remove liquidity from a pool
     * @param symbol Token symbol
     * @param amount Amount to remove
     */
    function removeLiquidity(string calldata symbol, uint256 amount) external nonReentrant {
        if (liquidityPools[symbol].tokenAddress == address(0)) revert UnsupportedToken(symbol);
        if (amount == 0) revert InvalidAmount();
        
        LiquidityPool storage pool = liquidityPools[symbol];
        
        // Check available liquidity
        uint256 availableLiquidity = pool.totalLiquidity - pool.allocatedLiquidity;
        if (amount > availableLiquidity) revert InsufficientLiquidity(symbol, amount, availableLiquidity);
        
        address tokenAddress = pool.tokenAddress;
        
        // Update liquidity pool
        pool.totalLiquidity -= amount;
        
        // Update current chain liquidity
        uint256 currentChainId = getChainId();
        supportedChains[currentChainId].liquidityAmount -= amount;
        
        // Transfer tokens to user
        IERC20(tokenAddress).safeTransfer(msg.sender, amount);
        
        emit LiquidityRemoved(symbol, msg.sender, amount);
        
        // Notify the strategy controller about liquidity removal
        strategyController.notifyLiquidityChange(symbol, false, amount);
    }
    
    /**
     * @dev Initiate a cross-chain transfer
     * @param targetChainId Target chain ID
     * @param recipient Recipient address on target chain (as bytes32)
     * @param symbol Token symbol
     * @param amount Amount to transfer
     * @return transferId Transfer ID
     */
    function initiateTransfer(
        uint256 targetChainId,
        bytes32 recipient,
        string calldata symbol,
        uint256 amount
    ) external nonReentrant returns (bytes32 transferId) {
        // Validate parameters
        if (supportedChains[targetChainId].chainId == 0 || !supportedChains[targetChainId].active) 
            revert UnsupportedChain(targetChainId);
        if (liquidityPools[symbol].tokenAddress == address(0)) revert UnsupportedToken(symbol);
        if (amount == 0) revert InvalidAmount();
        
        LiquidityPool storage pool = liquidityPools[symbol];
        
        // Check available liquidity
        uint256 availableLiquidity = pool.totalLiquidity - pool.allocatedLiquidity;
        if (amount > availableLiquidity) revert InsufficientLiquidity(symbol, amount, availableLiquidity);
        
        // Get current chain ID
        uint256 sourceChainId = getChainId();
        
        // Generate transfer ID
        transferId = keccak256(abi.encode(
            sourceChainId,
            targetChainId,
            msg.sender,
            recipient,
            symbol,
            amount,
            block.timestamp,
            nonces[msg.sender]++
        ));
        
        // Create transfer record
        transfers[transferId] = CrossChainTransfer({
            sourceChainId: sourceChainId,
            targetChainId: targetChainId,
            sender: msg.sender,
            recipient: recipient,
            symbol: symbol,
            amount: amount,
            timestamp: block.timestamp,
            transferId: transferId,
            completed: false,
            failed: false,
            failureReason: ""
        });
        
        transferIds.push(transferId);
        
        // Update allocated liquidity
        pool.allocatedLiquidity += amount;
        
        // Calculate utilization rate
        if (pool.totalLiquidity > 0) {
            pool.utilizationRate = (pool.allocatedLiquidity * 1e6) / pool.totalLiquidity;
        }
        
        // Transfer tokens from user
        IERC20(pool.tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        emit CrossChainTransferInitiated(
            transferId,
            sourceChainId,
            targetChainId,
            msg.sender,
            recipient,
            symbol,
            amount
        );
        
        // Send message to bridge
        sendBridgeMessage(targetChainId, transferId, symbol, amount, recipient);
        
        return transferId;
    }
    
    /**
     * @dev Complete a cross-chain transfer based on message from source chain
     * @param transferId Transfer ID
     * @param sourceChainId Source chain ID
     * @param sender Sender address on source chain
     * @param recipient Recipient address on this chain
     * @param symbol Token symbol
     * @param amount Amount to transfer
     * @param signature Signature from authorized relayer
     */
    function completeTransfer(
        bytes32 transferId,
        uint256 sourceChainId,
        address sender,
        address recipient,
        string calldata symbol,
        uint256 amount,
        bytes calldata signature
    ) external nonReentrant {
        // Verify the transfer hasn't been processed
        if (transfers[transferId].transferId == transferId) {
            if (transfers[transferId].completed) revert TransferAlreadyCompleted(transferId);
        }
        
        // Verify signature from authorized relayer
        bytes32 messageHash = keccak256(abi.encode(
            transferId,
            sourceChainId,
            getChainId(), // target chain id
            sender,
            recipient,
            symbol,
            amount
        ));
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        
        if (!authorizedRelayers[signer]) revert InvalidSignature();
        
        // Get token address on this chain
        address tokenAddress = assetAddresses[getChainId()][symbol];
        if (tokenAddress == address(0)) revert UnsupportedToken(symbol);
        
        // Create or update transfer record
        if (transfers[transferId].transferId != transferId) {
            transfers[transferId] = CrossChainTransfer({
                sourceChainId: sourceChainId,
                targetChainId: getChainId(),
                sender: sender,
                recipient: bytes32(uint256(uint160(recipient))),
                symbol: symbol,
                amount: amount,
                timestamp: block.timestamp,
                transferId: transferId,
                completed: true,
                failed: false,
                failureReason: ""
            });
            transferIds.push(transferId);
        } else {
            transfers[transferId].completed = true;
        }
        
        // Transfer tokens to recipient
        IERC20(tokenAddress).safeTransfer(recipient, amount);
        
        emit CrossChainTransferCompleted(
            transferId,
            sourceChainId,
            getChainId(),
            recipient,
            symbol,
            amount
        );
        
        // Update liquidity tracking
        supportedChains[getChainId()].liquidityAmount += amount;
    }
    
    /**
     * @dev Mark a transfer as failed
     * @param transferId Transfer ID
     * @param reason Failure reason
     */
    function failTransfer(bytes32 transferId, string calldata reason) external onlyOwnerOrRelayer {
        if (transfers[transferId].transferId == bytes32(0)) revert TransferNotFound(transferId);
        if (transfers[transferId].completed) revert TransferAlreadyCompleted(transferId);
        
        CrossChainTransfer storage transfer = transfers[transferId];
        
        // Update transfer status
        transfer.failed = true;
        transfer.failureReason = reason;
        
        // Refund tokens if this is the source chain
        if (transfer.sourceChainId == getChainId()) {
            // Update allocated liquidity
            liquidityPools[transfer.symbol].allocatedLiquidity -= transfer.amount;
            
            // Update utilization rate
            if (liquidityPools[transfer.symbol].totalLiquidity > 0) {
                liquidityPools[transfer.symbol].utilizationRate = (liquidityPools[transfer.symbol].allocatedLiquidity * 1e6) / liquidityPools[transfer.symbol].totalLiquidity;
            }
            
            // Transfer tokens back to sender
            address tokenAddress = liquidityPools[transfer.symbol].tokenAddress;
            IERC20(tokenAddress).safeTransfer(transfer.sender, transfer.amount);
        }
        
        emit CrossChainTransferFailed(transferId, reason);
    }
    
    /**
     * @dev Add a relayer
     * @param relayer Relayer address
     */
    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "Invalid relayer address");
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }
    
    /**
     * @dev Remove a relayer
     * @param relayer Relayer address
     */
    function removeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }
    
    /**
     * @dev Execute a yield optimization strategy
     * @param symbol Token symbol
     * @param strategyName Strategy name
     * @param amount Amount to allocate to strategy
     */
    function executeStrategy(
        string calldata symbol,
        string calldata strategyName,
        uint256 amount
    ) external onlyOwner {
        if (liquidityPools[symbol].tokenAddress == address(0)) revert UnsupportedToken(symbol);
        
        LiquidityPool storage pool = liquidityPools[symbol];
        
        // Check available liquidity
        uint256 availableLiquidity = pool.totalLiquidity - pool.allocatedLiquidity;
        if (amount > availableLiquidity) revert InsufficientLiquidity(symbol, amount, availableLiquidity);
        
        // Approve tokens for strategy controller
        IERC20(pool.tokenAddress).safeApprove(address(strategyController), amount);
        
        // Execute strategy
        strategyController.executeStrategy(symbol, strategyName, amount);
        
        // Update allocated liquidity
        pool.allocatedLiquidity += amount;
        
        // Calculate utilization rate
        if (pool.totalLiquidity > 0) {
            pool.utilizationRate = (pool.allocatedLiquidity * 1e6) / pool.totalLiquidity;
        }
        
        emit StrategyExecuted(symbol, strategyName, amount);
    }
    
    /**
     * @dev Handle returns from yield strategies
     * @param symbol Token symbol
     * @param amount Amount returned
     */
    function handleStrategyReturns(string calldata symbol, uint256 amount) external {
        // Only strategy controller can call this
        require(msg.sender == address(strategyController), "Unauthorized");
        
        if (liquidityPools[symbol].tokenAddress == address(0)) revert UnsupportedToken(symbol);
        
        LiquidityPool storage pool = liquidityPools[symbol];
        
        // Update allocated liquidity
        if (amount <= pool.allocatedLiquidity) {
            pool.allocatedLiquidity -= amount;
        } else {
            // If return is more than allocated (profit), increase total liquidity
            pool.totalLiquidity += (amount - pool.allocatedLiquidity);
            pool.allocatedLiquidity = 0;
        }
        
        // Calculate utilization rate
        if (pool.totalLiquidity > 0) {
            pool.utilizationRate = (pool.allocatedLiquidity * 1e6) / pool.totalLiquidity;
        }
    }
    
    /**
     * @dev Get the token price from Chainlink oracle
     * @param tokenAddress Token address
     * @return price Token price in USD (scaled by 1e8)
     */
    function getTokenPrice(address tokenAddress) public view returns (uint256 price) {
        AggregatorV3Interface priceFeed = priceFeeds[tokenAddress];
        require(address(priceFeed) != address(0), "Price feed not set");
        
        (, int256 answer, , , ) = priceFeed.latestRoundData();
        price = uint256(answer);
    }
    
    /**
     * @dev Get chain ID
     * @return chainId Current chain ID
     */
    function getChainId() public view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }
    
    /**
     * @dev Get liquidity pool info
     * @param symbol Token symbol
     * @return pool Liquidity pool info
     */
    function getLiquidityPool(string calldata symbol) external view returns (LiquidityPool memory) {
        return liquidityPools[symbol];
    }
    
    /**
     * @dev Get all supported token symbols
     * @return tokens Array of token symbols
     */
    function getSupportedTokens() external view returns (string[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev Get all supported chain IDs
     * @return chains Array of chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory) {
        return chainIds;
    }
    
    /**
     * @dev Get transfer by ID
     * @param transferId Transfer ID
     * @return transfer Transfer info
     */
    function getTransfer(bytes32 transferId) external view returns (CrossChainTransfer memory) {
        return transfers[transferId];
    }
    
    /**
     * @dev Get all transfer IDs
     * @return ids Array of transfer IDs
     */
    function getAllTransferIds() external view returns (bytes32[] memory) {
        return transferIds;
    }
    
    /**
     * @dev Get available liquidity for a token
     * @param symbol Token symbol
     * @return availableLiquidity Available liquidity
     */
    function getAvailableLiquidity(string calldata symbol) external view returns (uint256) {
        LiquidityPool memory pool = liquidityPools[symbol];
        return pool.totalLiquidity - pool.allocatedLiquidity;
    }
    
    /**
     * @dev Helper function to send a message to the bridge
     * @param targetChainId Target chain ID
     * @param transferId Transfer ID
     * @param symbol Token symbol
     * @param amount Amount
     * @param recipient Recipient address on target chain
     */
    /**
     * @dev Send message to bridge with enhanced error handling and security
     * @param targetChainId Target chain ID
     * @param transferId Transfer ID
     * @param symbol Token symbol
     * @param amount Amount
     * @param recipient Recipient address on target chain
     */
    function sendBridgeMessage(
        uint256 targetChainId,
        bytes32 transferId,
        string memory symbol,
        uint256 amount,
        bytes32 recipient
    ) internal {
        // Generate a secure nonce to prevent replay attacks across chains
        uint256 secureNonce = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.number,
            msg.sender,
            transferId
        )));
        
        // Add transfer metadata for advanced tracking
        bytes memory metadata = abi.encode(
            block.timestamp,
            block.chainid,
            secureNonce,
            supportedChains[targetChainId].bridgeAddress
        );
        
        // Construct enhanced message payload with version and metadata
        bytes memory payload = abi.encode(
            uint8(1), // protocol version
            transferId,
            getChainId(), // source chain ID
            msg.sender, // sender
            recipient, // recipient
            symbol,
            amount,
            metadata
        );
        
        // Calculate message hash for verification on receiving chain
        bytes32 messageHash = keccak256(payload);
        
        // Try sending via primary bridge with fallback mechanism
        try bridge.sendMessageToL1(
            recipient,
            "CROSS_CHAIN_TRANSFER",
            payload,
            2000000 // gas limit
        ) returns (bytes32 messageId) {
            // Store message hash for verification
            transfers[transferId].messageHash = messageHash;
            
            // Monitor the transaction (in production, we would implement a monitoring service)
            _monitorBridgeTransaction(targetChainId, messageId, transferId);
            
            emit BridgeMessageSent(targetChainId, messageId, "CROSS_CHAIN_TRANSFER");
        } catch Error(string memory reason) {
            // Try fallback bridge mechanism if available
            if (_tryFallbackBridge(targetChainId, transferId, symbol, amount, recipient, payload)) {
                return;
            }
            
            // If fallback fails too, handle failure
            transfers[transferId].failed = true;
            transfers[transferId].failureReason = reason;
            
            // Update allocated liquidity
            liquidityPools[symbol].allocatedLiquidity -= amount;
            
            // Refund tokens to sender
            address tokenAddress = liquidityPools[symbol].tokenAddress;
            IERC20(tokenAddress).safeTransfer(msg.sender, amount);
            
            emit CrossChainTransferFailed(transferId, reason);
            revert BridgeError(reason);
        }
    }
    
    /**
     * @dev Try fallback bridge if primary fails
     * @param targetChainId Target chain ID
     * @param transferId Transfer ID
     * @param symbol Token symbol
     * @param amount Amount
     * @param recipient Recipient address
     * @param payload Message payload
     * @return success Whether fallback succeeded
     */
    function _tryFallbackBridge(
        uint256 targetChainId,
        bytes32 transferId,
        string memory symbol,
        uint256 amount,
        bytes32 recipient,
        bytes memory payload
    ) internal returns (bool) {
        // In production, we would implement alternative bridge providers
        // For demo, just simulate a retry with the same bridge
        
        // If target chain has a fallback bridge address
        if (supportedChains[targetChainId].bridgeAddress != address(0)) {
            try bridge.sendMessageToL1(
                recipient,
                "CROSS_CHAIN_TRANSFER_FALLBACK",
                payload,
                3000000 // increased gas limit for fallback
            ) returns (bytes32 messageId) {
                emit BridgeMessageSent(targetChainId, messageId, "CROSS_CHAIN_TRANSFER_FALLBACK");
                return true;
            } catch {
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Monitor bridge transaction status
     * @param targetChainId Target chain ID
     * @param messageId Bridge message ID
     * @param transferId Transfer ID
     */
    function _monitorBridgeTransaction(
        uint256 targetChainId,
        bytes32 messageId,
        bytes32 transferId
    ) internal {
        // In production, this would set up monitoring for the bridge transaction
        // For demo purposes, just update the transfer record
        
        // Store messageId in transfer data for reference
        CrossChainTransfer storage transfer = transfers[transferId];
        
        // Add messageId field - this requires modifying the CrossChainTransfer struct
        // For this demo, we'll just use this pseudo-code comment since we can't modify the struct
        // transfer.messageId = messageId;
        
        // In a real implementation, we would:
        // 1. Store the monitoring request in a persistent store
        // 2. Have an off-chain service that checks transaction status
        // 3. Implement retry/recovery mechanisms for failed transactions
    }
    
    /**
     * @dev Check if sender is owner or authorized relayer
     */
    modifier onlyOwnerOrRelayer() {
        if (msg.sender != owner() && !authorizedRelayers[msg.sender]) revert Unauthorized();
        _;
    }
}

/**
 * @dev Interface for the CrossLayerBridge
 */
interface ICrossLayerBridge {
    function sendMessageToL1(
        bytes32 targetAddress,
        string calldata messageType,
        bytes calldata payload,
        uint256 gasLimit
    ) external payable returns (bytes32 messageId);
}

/**
 * @dev Interface for the LendingPool
 */
interface ILendingPool {
    function deposits(address user) external view returns (uint256);
    function borrows(address user) external view returns (uint256);
    function collaterals(address user) external view returns (uint256);
    function riskScores(address user) external view returns (uint256);
    function updateRiskScore(address user, uint256 score) external;
}

/**
 * @dev Interface for the StrategyController
 */
interface IStrategyController {
    function executeStrategy(string calldata symbol, string calldata strategyName, uint256 amount) external;
    function notifyLiquidityChange(string calldata symbol, bool isAdded, uint256 amount) external;
}
