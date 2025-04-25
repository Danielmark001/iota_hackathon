// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title CrossChainLiquidityV2
 * @dev Enhanced cross-chain liquidity aggregation and optimization system
 * Leverages advanced AI algorithms for optimal capital efficiency across multiple chains
 */
contract CrossChainLiquidityV2 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    
    // Supported chains with their details
    struct ChainInfo {
        string name;
        address bridge;
        uint256 totalLiquidity;
        uint256 utilizationRate; // Basis points (e.g., 7500 = 75%)
        uint256 interestRate; // Basis points
        address localToken; // ERC20 token on this chain
        bool supported;
        bool paused;
        uint256 averageGasPrice;
        uint256 lastUpdated;
        bytes32 chainType; // Type identifier (EVM, Move, etc.)
        uint256 averageBlockTime; // In seconds
        uint256 finalityBlocks; // Number of blocks for finality
    }
    
    // Liquidity source details
    struct LiquiditySource {
        uint256 chainId;
        address protocol;
        address asset;
        uint256 amount;
        uint256 apy; // Basis points
        uint256 utilizationRate; // Basis points
        bool active;
        uint256 minLockTime; // Minimum lock time in seconds
        uint256 maxLockTime; // Maximum lock time in seconds
        uint256 withdrawalFee; // Basis points
        bytes32 sourceType; // Type identifier (Lending, DEX, etc.)
        address[] requiredMiddleware; // Required middleware for interactions
    }
    
    // User Liquidity Details
    struct UserLiquidity {
        uint256 amount;
        uint256 chainId;
        uint256 lastDeposited;
        uint256 lastWithdrawn;
        bool optimizationEnabled;
        uint256 riskTolerance; // Basis points (e.g., 5000 = 50%)
        address[] authorizedWithdrawers;
        bytes32 lastOptimizationHash;
        uint256 lockUntil; // Timestamp until liquidity is locked
    }
    
    // Cross-chain transfer details
    struct CrossChainTransfer {
        uint256 sourceChainId;
        uint256 destinationChainId;
        address sender;
        address recipient;
        uint256 amount;
        uint256 fee;
        bytes32 status; // "pending", "completed", "failed"
        uint256 timestamp;
        bytes32 messageId;
        uint256 gasLimit;
        uint256 deadline;
        bytes data;
    }
    
    // Yield Strategy Configuration
    struct YieldStrategy {
        string name;
        bool active;
        uint256 lastExecuted;
        bytes parameters;
        uint256 minLiquidity;
        uint256 maxAPYVolatility; // Basis points
        uint256 rebalanceThreshold; // Basis points
        uint256 performanceFee; // Basis points
        address feeRecipient;
        bool autoCompound;
        uint256 targetUtilization; // Basis points
        uint256 maxGasPrice;
    }
    
    // Advanced Analytics data
    struct AnalyticsData {
        uint256 timestamp;
        uint256 tvl;
        uint256 totalBorrows;
        uint256 averageAPY;
        uint256 crossChainVolume24h;
        uint256 totalActiveLPs;
        uint256 averageUtilization;
        uint256 protocolRevenue;
        uint256 averageGasUsed;
        uint256 successRate; // Basis points
        bytes32 marketState; // "normal", "volatile", "extreme"
    }
    
    // Risk parameters for optimization
    struct RiskParameters {
        uint256 defaultRiskTolerance; // Basis points
        uint256 maxAllocationPerChain; // Basis points
        uint256 minDiversificationCount; // Minimum number of chains
        uint256 correlationThreshold; // Basis points
        uint256 volatilityThreshold; // Basis points
        uint256 maxDrawdownTolerance; // Basis points
        uint256 rebalanceCooldown; // In seconds
        bool slippageProtection;
        uint256 inactivityThreshold; // In seconds
    }
    
    // Mapping of chain ID to chain info
    mapping(uint256 => ChainInfo) public chains;
    
    // All supported chain IDs
    EnumerableSet.UintSet private supportedChains;
    
    // Mapping of source ID to liquidity source
    mapping(bytes32 => LiquiditySource) public liquiditySources;
    
    // Mapping of chain ID to its liquidity sources
    mapping(uint256 => bytes32[]) public chainLiquiditySources;
    
    // Mapping of user address to chain ID to their liquidity
    mapping(address => mapping(uint256 => UserLiquidity)) public userLiquidity;
    
    // Mapping of user address to all chains they have liquidity in
    mapping(address => EnumerableSet.UintSet) private userChains;
    
    // Mapping of transfer ID to transfer details
    mapping(bytes32 => CrossChainTransfer) public crossChainTransfers;
    
    // Mapping of user to their transfer IDs
    mapping(address => bytes32[]) public userTransfers;
    
    // Mapping of chain pairs to their bridge fee (in basis points)
    mapping(uint256 => mapping(uint256 => uint256)) public bridgeFees;
    
    // Mapping of strategy ID to strategy configuration
    mapping(uint256 => YieldStrategy) public strategies;
    
    // Counter for next strategy ID
    uint256 public nextStrategyId;
    
    // Array of recent analytics data
    AnalyticsData[] public analyticsHistory;
    
    // Risk parameters for optimization
    RiskParameters public riskParams;
    
    // Bridge parameters
    uint256 public minTransferAmount;
    uint256 public maxTransferAmount;
    uint256 public defaultGasLimit;
    uint256 public transferTimeout;
    address public treasury;
    uint256 public protocolFee; // Basis points
    
    // Authorized operators 
    EnumerableSet.AddressSet private operators;
    
    // Events
    event ChainAdded(uint256 chainId, string name, address bridge);
    event ChainUpdated(uint256 chainId, string name, address bridge, uint256 utilizationRate, uint256 interestRate);
    event ChainRemoved(uint256 chainId);
    event ChainPaused(uint256 chainId, bool paused);
    
    event LiquiditySourceAdded(bytes32 sourceId, uint256 chainId, address protocol, address asset, uint256 apy);
    event LiquiditySourceUpdated(bytes32 sourceId, uint256 apy, uint256 utilizationRate, bool active);
    event LiquiditySourceRemoved(bytes32 sourceId);
    
    event LiquidityDeposited(address indexed user, uint256 chainId, uint256 amount);
    event LiquidityWithdrawn(address indexed user, uint256 chainId, uint256 amount);
    event LiquidityTransferred(
        address indexed user, 
        uint256 sourceChainId, 
        uint256 destinationChainId, 
        uint256 amount,
        bytes32 transferId
    );
    
    event TransferStatusUpdated(bytes32 transferId, bytes32 status);
    
    event StrategyExecuted(
        uint256 strategyId, 
        address indexed user, 
        bytes32 executionHash, 
        uint256 gasUsed,
        bool success
    );
    
    event OptimizationCompleted(
        address indexed user, 
        bytes32 optimizationHash, 
        uint256 expectedAPY,
        uint256 timestamp
    );
    
    event AnalyticsUpdated(uint256 timestamp, uint256 tvl, uint256 averageAPY, uint256 crossChainVolume24h);
    
    event OperatorAdded(address operator);
    event OperatorRemoved(address operator);
    
    event RiskParametersUpdated(uint256 defaultRiskTolerance, uint256 maxAllocationPerChain, uint256 minDiversificationCount);
    
    /**
     * @dev Contract constructor
     * @param _treasury Address of the protocol treasury
     * @param _protocolFee Protocol fee in basis points
     */
    constructor(address _treasury, uint256 _protocolFee) {
        require(_treasury != address(0), "Invalid treasury address");
        require(_protocolFee <= 1000, "Protocol fee too high"); // Max 10%
        
        treasury = _treasury;
        protocolFee = _protocolFee;
        
        // Set default parameters
        minTransferAmount = 0.001 ether;
        maxTransferAmount = 100 ether;
        defaultGasLimit = 300000;
        transferTimeout = 3 days;
        
        // Set default risk parameters
        riskParams = RiskParameters({
            defaultRiskTolerance: 5000, // 50%
            maxAllocationPerChain: 4000, // 40%
            minDiversificationCount: 3,
            correlationThreshold: 7500, // 75%
            volatilityThreshold: 3000, // 30%
            maxDrawdownTolerance: 2000, // 20%
            rebalanceCooldown: 1 days,
            slippageProtection: true,
            inactivityThreshold: 30 days
        });
        
        // Add initial analytics entry
        analyticsHistory.push(AnalyticsData({
            timestamp: block.timestamp,
            tvl: 0,
            totalBorrows: 0,
            averageAPY: 500, // 5%
            crossChainVolume24h: 0,
            totalActiveLPs: 0,
            averageUtilization: 0,
            protocolRevenue: 0,
            averageGasUsed: 0,
            successRate: 10000, // 100%
            marketState: bytes32("normal")
        }));
    }
    
    /**
     * @dev Modifier to restrict access to authorized operators
     */
    modifier onlyOperator() {
        require(isOperator(msg.sender), "Caller is not an operator");
        _;
    }
    
    /**
     * @dev Add a new chain to the system
     * @param chainId Chain ID
     * @param name Chain name
     * @param bridge Bridge contract address
     * @param localToken ERC20 token on this chain
     * @param chainType Type of chain (EVM, Move, etc.)
     */
    function addChain(
        uint256 chainId,
        string calldata name,
        address bridge,
        address localToken,
        bytes32 chainType,
        uint256 blockTime,
        uint256 finalityBlocks
    ) external onlyOwner {
        require(chainId > 0, "Invalid chain ID");
        require(bytes(name).length > 0, "Empty name");
        require(bridge != address(0), "Invalid bridge address");
        require(localToken != address(0), "Invalid token address");
        
        // Ensure chain doesn't already exist
        require(!supportedChains.contains(chainId), "Chain already exists");
        
        // Add chain info
        chains[chainId] = ChainInfo({
            name: name,
            bridge: bridge,
            totalLiquidity: 0,
            utilizationRate: 0,
            interestRate: 500, // 5% default
            localToken: localToken,
            supported: true,
            paused: false,
            averageGasPrice: 0,
            lastUpdated: block.timestamp,
            chainType: chainType,
            averageBlockTime: blockTime,
            finalityBlocks: finalityBlocks
        });
        
        // Add to supported chains set
        supportedChains.add(chainId);
        
        // Initialize empty liquidity sources array
        chainLiquiditySources[chainId] = new bytes32[](0);
        
        emit ChainAdded(chainId, name, bridge);
    }
    
    /**
     * @dev Update an existing chain's info
     * @param chainId Chain ID
     * @param name Chain name
     * @param bridge Bridge contract address
     * @param utilizationRate Current utilization rate in basis points
     * @param interestRate Current interest rate in basis points
     * @param paused Whether this chain is paused
     */
    function updateChain(
        uint256 chainId,
        string calldata name,
        address bridge,
        uint256 utilizationRate,
        uint256 interestRate,
        uint256 averageGasPrice,
        bool paused
    ) external onlyOperator {
        require(supportedChains.contains(chainId), "Chain does not exist");
        require(bytes(name).length > 0, "Empty name");
        require(bridge != address(0), "Invalid bridge address");
        require(utilizationRate <= 10000, "Utilization rate exceeds 100%");
        require(interestRate <= 10000, "Interest rate exceeds 100%");
        
        ChainInfo storage chainInfo = chains[chainId];
        
        chainInfo.name = name;
        chainInfo.bridge = bridge;
        chainInfo.utilizationRate = utilizationRate;
        chainInfo.interestRate = interestRate;
        chainInfo.paused = paused;
        chainInfo.averageGasPrice = averageGasPrice;
        chainInfo.lastUpdated = block.timestamp;
        
        emit ChainUpdated(chainId, name, bridge, utilizationRate, interestRate);
        
        if (paused) {
            emit ChainPaused(chainId, paused);
        }
    }
    
    /**
     * @dev Remove a chain from the system
     * @param chainId Chain ID
     */
    function removeChain(uint256 chainId) external onlyOwner {
        require(supportedChains.contains(chainId), "Chain does not exist");
        
        // Ensure no liquidity exists on this chain
        require(chains[chainId].totalLiquidity == 0, "Chain has active liquidity");
        
        // Remove from supported chains
        supportedChains.remove(chainId);
        
        // Set supported flag to false, but keep other data for historical record
        chains[chainId].supported = false;
        
        emit ChainRemoved(chainId);
    }
    
    /**
     * @dev Add a new liquidity source
     * @param chainId Chain ID where the source exists
     * @param protocol Protocol contract address
     * @param asset Asset token address
     * @param apy Current APY in basis points
     * @param utilizationRate Current utilization rate in basis points
     * @param sourceType Type of the source (Lending, DEX, etc.)
     * @param minLockTime Minimum lock time in seconds
     * @param maxLockTime Maximum lock time in seconds
     * @param withdrawalFee Withdrawal fee in basis points
     * @param requiredMiddleware Required middleware for interactions
     */
    function addLiquiditySource(
        uint256 chainId,
        address protocol,
        address asset,
        uint256 apy,
        uint256 utilizationRate,
        bytes32 sourceType,
        uint256 minLockTime,
        uint256 maxLockTime,
        uint256 withdrawalFee,
        address[] calldata requiredMiddleware
    ) external onlyOperator {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(protocol != address(0), "Invalid protocol address");
        require(asset != address(0), "Invalid asset address");
        require(apy <= 20000, "APY exceeds 200%");
        require(utilizationRate <= 10000, "Utilization rate exceeds 100%");
        require(withdrawalFee <= 500, "Withdrawal fee exceeds 5%");
        require(minLockTime <= maxLockTime, "Min lock time exceeds max lock time");
        
        // Generate unique source ID
        bytes32 sourceId = keccak256(abi.encodePacked(chainId, protocol, asset, block.timestamp));
        
        // Ensure source doesn't already exist
        require(liquiditySources[sourceId].chainId == 0, "Source already exists");
        
        // Add liquidity source
        liquiditySources[sourceId] = LiquiditySource({
            chainId: chainId,
            protocol: protocol,
            asset: asset,
            amount: 0,
            apy: apy,
            utilizationRate: utilizationRate,
            active: true,
            minLockTime: minLockTime,
            maxLockTime: maxLockTime,
            withdrawalFee: withdrawalFee,
            sourceType: sourceType,
            requiredMiddleware: requiredMiddleware
        });
        
        // Add to chain's liquidity sources array
        chainLiquiditySources[chainId].push(sourceId);
        
        emit LiquiditySourceAdded(sourceId, chainId, protocol, asset, apy);
    }
    
    /**
     * @dev Update an existing liquidity source
     * @param sourceId Source ID
     * @param apy Updated APY in basis points
     * @param utilizationRate Updated utilization rate in basis points
     * @param active Whether the source is active
     */
    function updateLiquiditySource(
        bytes32 sourceId,
        uint256 apy,
        uint256 utilizationRate,
        bool active
    ) external onlyOperator {
        require(liquiditySources[sourceId].chainId != 0, "Source does not exist");
        require(apy <= 20000, "APY exceeds 200%");
        require(utilizationRate <= 10000, "Utilization rate exceeds 100%");
        
        LiquiditySource storage source = liquiditySources[sourceId];
        
        source.apy = apy;
        source.utilizationRate = utilizationRate;
        source.active = active;
        
        emit LiquiditySourceUpdated(sourceId, apy, utilizationRate, active);
    }
    
    /**
     * @dev Remove a liquidity source
     * @param sourceId Source ID
     */
    function removeLiquiditySource(bytes32 sourceId) external onlyOwner {
        require(liquiditySources[sourceId].chainId != 0, "Source does not exist");
        
        // Ensure no liquidity exists in this source
        require(liquiditySources[sourceId].amount == 0, "Source has active liquidity");
        
        // Get chain ID
        uint256 chainId = liquiditySources[sourceId].chainId;
        
        // Remove from chain's liquidity sources array
        bytes32[] storage sources = chainLiquiditySources[chainId];
        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i] == sourceId) {
                sources[i] = sources[sources.length - 1];
                sources.pop();
                break;
            }
        }
        
        // Set active flag to false, but keep other data for historical record
        liquiditySources[sourceId].active = false;
        
        emit LiquiditySourceRemoved(sourceId);
    }
    
    /**
     * @dev Add liquidity to a specific chain
     * @param chainId Chain ID to add liquidity to
     * @param riskTolerance User's risk tolerance in basis points
     * @param optimizationEnabled Whether to enable automatic optimization
     * @param lockUntil Optional timestamp until which the liquidity is locked (0 for no lock)
     */
    function addLiquidity(
        uint256 chainId,
        uint256 amount,
        uint256 riskTolerance,
        bool optimizationEnabled,
        uint256 lockUntil
    ) external payable nonReentrant {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(!chains[chainId].paused, "Chain is paused");
        require(amount > 0, "Amount must be greater than 0");
        require(riskTolerance <= 10000, "Risk tolerance exceeds 100%");
        
        ChainInfo storage chainInfo = chains[chainId];
        
        // Handle token transfer
        if (chainId == getChainIdForCurrentNetwork()) {
            // If this is the current chain, transfer tokens from user
            if (msg.value > 0) {
                // Native token
                require(msg.value == amount, "Amount mismatch");
            } else {
                // ERC20 token
                IERC20(chainInfo.localToken).safeTransferFrom(msg.sender, address(this), amount);
            }
        } else {
            // Cross-chain deposit handled by bridge, just handle accounting
            // In production, this would be more complex
        }
        
        // Update user's liquidity info
        UserLiquidity storage userLiq = userLiquidity[msg.sender][chainId];
        
        // Initialize if first time
        if (userLiq.amount == 0) {
            userLiq.chainId = chainId;
            userLiq.optimizationEnabled = optimizationEnabled;
            userLiq.riskTolerance = riskTolerance;
            userLiq.authorizedWithdrawers = new address[](0);
            
            // Add to user's chains
            userChains[msg.sender].add(chainId);
        }
        
        // Update liquidity
        userLiq.amount = userLiq.amount.add(amount);
        userLiq.lastDeposited = block.timestamp;
        
        // Update lock time if provided and greater than current
        if (lockUntil > 0 && lockUntil > userLiq.lockUntil) {
            userLiq.lockUntil = lockUntil;
        }
        
        // Update chain's total liquidity
        chainInfo.totalLiquidity = chainInfo.totalLiquidity.add(amount);
        chainInfo.lastUpdated = block.timestamp;
        
        // Update analytics
        updateAnalytics();
        
        emit LiquidityDeposited(msg.sender, chainId, amount);
        
        // If optimization is enabled, trigger optimization
        if (optimizationEnabled) {
            _triggerOptimization(msg.sender);
        }
    }
    
    /**
     * @dev Withdraw liquidity from a specific chain
     * @param chainId Chain ID to withdraw from
     * @param amount Amount to withdraw
     */
    function withdrawLiquidity(
        uint256 chainId,
        uint256 amount
    ) external nonReentrant {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        UserLiquidity storage userLiq = userLiquidity[msg.sender][chainId];
        
        require(userLiq.amount >= amount, "Insufficient liquidity");
        require(block.timestamp >= userLiq.lockUntil, "Liquidity is locked");
        
        ChainInfo storage chainInfo = chains[chainId];
        
        // Handle token transfer
        if (chainId == getChainIdForCurrentNetwork()) {
            // If this is the current chain, transfer tokens to user
            if (chains[chainId].localToken == address(0)) {
                // Native token
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "Transfer failed");
            } else {
                // ERC20 token
                IERC20(chainInfo.localToken).safeTransfer(msg.sender, amount);
            }
        } else {
            // Cross-chain withdrawal handled by bridge
            // In production, this would be more complex
        }
        
        // Update user's liquidity
        userLiq.amount = userLiq.amount.sub(amount);
        userLiq.lastWithdrawn = block.timestamp;
        
        // Remove from user's chains if balance is zero
        if (userLiq.amount == 0) {
            userChains[msg.sender].remove(chainId);
        }
        
        // Update chain's total liquidity
        chainInfo.totalLiquidity = chainInfo.totalLiquidity.sub(amount);
        chainInfo.lastUpdated = block.timestamp;
        
        // Update analytics
        updateAnalytics();
        
        emit LiquidityWithdrawn(msg.sender, chainId, amount);
    }
    
    /**
     * @dev Transfer liquidity between chains
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param amount Amount to transfer
     * @param recipient Optional recipient address (if different from sender)
     * @param data Optional additional data for the transfer
     */
    function transferLiquidity(
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 amount,
        address recipient,
        bytes calldata data
    ) external payable nonReentrant {
        require(supportedChains.contains(sourceChainId), "Source chain not supported");
        require(supportedChains.contains(destinationChainId), "Destination chain not supported");
        require(!chains[sourceChainId].paused, "Source chain is paused");
        require(!chains[destinationChainId].paused, "Destination chain is paused");
        require(amount > 0, "Amount must be greater than 0");
        require(amount >= minTransferAmount, "Amount below minimum");
        require(amount <= maxTransferAmount, "Amount above maximum");
        
        // If recipient is not specified, use sender
        if (recipient == address(0)) {
            recipient = msg.sender;
        }
        
        UserLiquidity storage userLiq = userLiquidity[msg.sender][sourceChainId];
        
        require(userLiq.amount >= amount, "Insufficient liquidity");
        require(block.timestamp >= userLiq.lockUntil, "Liquidity is locked");
        
        // Calculate fee
        uint256 fee = calculateTransferFee(sourceChainId, destinationChainId, amount);
        require(msg.value >= fee, "Insufficient fee");
        
        // Create transfer ID
        bytes32 transferId = keccak256(abi.encodePacked(
            msg.sender,
            sourceChainId,
            destinationChainId,
            amount,
            block.timestamp,
            blockhash(block.number - 1)
        ));
        
        // Create transfer record
        crossChainTransfers[transferId] = CrossChainTransfer({
            sourceChainId: sourceChainId,
            destinationChainId: destinationChainId,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            fee: fee,
            status: bytes32("pending"),
            timestamp: block.timestamp,
            messageId: bytes32(0),
            gasLimit: defaultGasLimit,
            deadline: block.timestamp + transferTimeout,
            data: data
        });
        
        // Add to user's transfers
        userTransfers[msg.sender].push(transferId);
        
        // Update user's source liquidity
        userLiq.amount = userLiq.amount.sub(amount);
        userLiq.lastWithdrawn = block.timestamp;
        
        // Remove from user's chains if balance is zero
        if (userLiq.amount == 0) {
            userChains[msg.sender].remove(sourceChainId);
        }
        
        // Update chain's total liquidity
        chains[sourceChainId].totalLiquidity = chains[sourceChainId].totalLiquidity.sub(amount);
        
        // Call the bridge to initiate the cross-chain transfer
        bytes32 messageId = _initiateTransfer(
            transferId,
            sourceChainId,
            destinationChainId,
            amount,
            recipient,
            fee,
            data
        );
        
        // Update message ID
        crossChainTransfers[transferId].messageId = messageId;
        
        // Update analytics
        updateAnalytics();
        
        emit LiquidityTransferred(msg.sender, sourceChainId, destinationChainId, amount, transferId);
    }
    
    /**
     * @dev Called by the bridge on the destination chain to complete a transfer
     * @param transferId Transfer ID
     * @param sourceChainId Source chain ID
     * @param amount Amount being transferred
     * @param recipient Recipient address
     */
    function completeTransfer(
        bytes32 transferId,
        uint256 sourceChainId,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        // Check that caller is the registered bridge for the source chain
        require(msg.sender == chains[sourceChainId].bridge, "Caller is not the bridge");
        
        // Update or create liquidity entry for recipient
        UserLiquidity storage userLiq = userLiquidity[recipient][getChainIdForCurrentNetwork()];
        
        // Initialize if first time
        if (userLiq.amount == 0) {
            userLiq.chainId = getChainIdForCurrentNetwork();
            userLiq.optimizationEnabled = false; // Default to false for new recipients
            userLiq.riskTolerance = riskParams.defaultRiskTolerance;
            userLiq.authorizedWithdrawers = new address[](0);
            
            // Add to user's chains
            userChains[recipient].add(getChainIdForCurrentNetwork());
        }
        
        // Update liquidity
        userLiq.amount = userLiq.amount.add(amount);
        userLiq.lastDeposited = block.timestamp;
        
        // Update chain's total liquidity
        chains[getChainIdForCurrentNetwork()].totalLiquidity = chains[getChainIdForCurrentNetwork()].totalLiquidity.add(amount);
        
        // Update transfer status (if this is the destination chain)
        if (crossChainTransfers[transferId].messageId != bytes32(0)) {
            crossChainTransfers[transferId].status = bytes32("completed");
            emit TransferStatusUpdated(transferId, bytes32("completed"));
        }
        
        // Update analytics
        updateAnalytics();
    }
    
    /**
     * @dev Update transfer status
     * @param transferId Transfer ID
     * @param status New status
     * @param messageId Message ID from the bridge
     */
    function updateTransferStatus(
        bytes32 transferId,
        bytes32 status,
        bytes32 messageId
    ) external onlyOperator {
        require(crossChainTransfers[transferId].sourceChainId != 0, "Transfer does not exist");
        
        CrossChainTransfer storage transfer = crossChainTransfers[transferId];
        
        transfer.status = status;
        
        // Update message ID if provided
        if (messageId != bytes32(0)) {
            transfer.messageId = messageId;
        }
        
        emit TransferStatusUpdated(transferId, status);
    }
    
    /**
     * @dev Calculate the fee for a cross-chain transfer
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param amount Amount to transfer
     * @return fee The calculated fee
     */
    function calculateTransferFee(
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 amount
    ) public view returns (uint256 fee) {
        // Get bridge fee for this chain pair
        uint256 bridgeFee = bridgeFees[sourceChainId][destinationChainId];
        
        // If no specific fee set, use default
        if (bridgeFee == 0) {
            bridgeFee = 50; // 0.5% default
        }
        
        // Calculate fee as percentage of amount
        uint256 percentageFee = amount.mul(bridgeFee).div(10000);
        
        // Add protocol fee
        uint256 protocolFeePart = amount.mul(protocolFee).div(10000);
        
        // Add gas cost based on destination chain
        uint256 baseGasCost = defaultGasLimit.mul(chains[destinationChainId].averageGasPrice);
        
        // Return total fee
        return percentageFee.add(protocolFeePart).add(baseGasCost);
    }
    
    /**
     * @dev Set the bridge fee for a specific chain pair
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param fee Fee in basis points
     */
    function setBridgeFee(
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 fee
    ) external onlyOwner {
        require(supportedChains.contains(sourceChainId), "Source chain not supported");
        require(supportedChains.contains(destinationChainId), "Destination chain not supported");
        require(fee <= 1000, "Fee too high"); // Max 10%
        
        bridgeFees[sourceChainId][destinationChainId] = fee;
    }
    
    /**
     * @dev Add a new yield strategy
     * @param name Strategy name
     * @param parameters Strategy parameters
     * @param minLiquidity Minimum liquidity required
     * @param maxAPYVolatility Maximum APY volatility in basis points
     * @param rebalanceThreshold Rebalance threshold in basis points
     * @param performanceFee Performance fee in basis points
     * @param feeRecipient Fee recipient address
     * @param autoCompound Whether to auto-compound
     * @param targetUtilization Target utilization in basis points
     * @param maxGasPrice Maximum gas price to execute the strategy
     */
    function addStrategy(
        string calldata name,
        bytes calldata parameters,
        uint256 minLiquidity,
        uint256 maxAPYVolatility,
        uint256 rebalanceThreshold,
        uint256 performanceFee,
        address feeRecipient,
        bool autoCompound,
        uint256 targetUtilization,
        uint256 maxGasPrice
    ) external onlyOwner {
        require(bytes(name).length > 0, "Empty name");
        require(performanceFee <= 3000, "Performance fee too high"); // Max 30%
        require(feeRecipient != address(0), "Invalid fee recipient");
        require(targetUtilization <= 10000, "Target utilization exceeds 100%");
        
        uint256 strategyId = nextStrategyId;
        nextStrategyId++;
        
        strategies[strategyId] = YieldStrategy({
            name: name,
            active: true,
            lastExecuted: 0,
            parameters: parameters,
            minLiquidity: minLiquidity,
            maxAPYVolatility: maxAPYVolatility,
            rebalanceThreshold: rebalanceThreshold,
            performanceFee: performanceFee,
            feeRecipient: feeRecipient,
            autoCompound: autoCompound,
            targetUtilization: targetUtilization,
            maxGasPrice: maxGasPrice
        });
    }
    
    /**
     * @dev Execute a yield strategy for a user
     * @param strategyId Strategy ID
     * @param user User address
     * @param executionData Execution data
     */
    function executeStrategy(
        uint256 strategyId,
        address user,
        bytes calldata executionData
    ) external nonReentrant onlyOperator {
        require(strategyId < nextStrategyId, "Strategy does not exist");
        require(strategies[strategyId].active, "Strategy is not active");
        
        YieldStrategy storage strategy = strategies[strategyId];
        
        // Check if user has sufficient liquidity
        uint256 totalUserLiquidity = getUserTotalLiquidity(user);
        require(totalUserLiquidity >= strategy.minLiquidity, "Insufficient liquidity");
        
        // Check optimization enabled
        bool anyEnabled = false;
        uint256[] memory userChainsArray = getUserChainsArray(user);
        for (uint256 i = 0; i < userChainsArray.length; i++) {
            if (userLiquidity[user][userChainsArray[i]].optimizationEnabled) {
                anyEnabled = true;
                break;
            }
        }
        
        require(anyEnabled, "Optimization not enabled for user");
        
        // Check gas price
        require(tx.gasprice <= strategy.maxGasPrice, "Gas price too high");
        
        // Record gas used for analytics
        uint256 gasStart = gasleft();
        
        // Execute strategy logic (would be more complex in production)
        bool success = _executeStrategyLogic(strategyId, user, executionData);
        
        // Calculate gas used
        uint256 gasUsed = gasStart - gasleft();
        
        // Update strategy execution timestamp
        strategy.lastExecuted = block.timestamp;
        
        // Generate execution hash
        bytes32 executionHash = keccak256(abi.encodePacked(
            strategyId,
            user,
            block.timestamp,
            executionData
        ));
        
        emit StrategyExecuted(strategyId, user, executionHash, gasUsed, success);
        
        // Update analytics
        updateAnalytics();
    }
    
    /**
     * @dev Run optimization logic for a user
     * @param user User address
     */
    function runOptimization(address user) external nonReentrant onlyOperator {
        _triggerOptimization(user);
    }
    
    /**
     * @dev Internal function to trigger optimization
     * @param user User address
     */
    function _triggerOptimization(address user) internal {
        // Check if user has any liquidity
        uint256[] memory userChainsArray = getUserChainsArray(user);
        require(userChainsArray.length > 0, "User has no liquidity");
        
        // Check if optimization is enabled for any chain
        bool anyEnabled = false;
        for (uint256 i = 0; i < userChainsArray.length; i++) {
            if (userLiquidity[user][userChainsArray[i]].optimizationEnabled) {
                anyEnabled = true;
                break;
            }
        }
        
        require(anyEnabled, "Optimization not enabled for user");
        
        // In a production system, this would call an off-chain optimization service
        // or run a complex algorithm to determine the optimal liquidity distribution
        
        // For this demo, we'll just generate an optimization hash and emit an event
        bytes32 optimizationHash = keccak256(abi.encodePacked(
            user,
            block.timestamp,
            "optimization"
        ));
        
        // Update user's optimization hash for each chain
        for (uint256 i = 0; i < userChainsArray.length; i++) {
            if (userLiquidity[user][userChainsArray[i]].optimizationEnabled) {
                userLiquidity[user][userChainsArray[i]].lastOptimizationHash = optimizationHash;
            }
        }
        
        // Calculate expected APY (in production this would be a real calculation)
        uint256 expectedAPY = 800; // 8%
        
        emit OptimizationCompleted(user, optimizationHash, expectedAPY, block.timestamp);
    }
    
    /**
     * @dev Get recommended liquidity distribution for a user
     * @param user User address
     * @return chainIds Array of chain IDs
     * @return amounts Array of recommended amounts
     * @return expectedAPYs Array of expected APYs
     */
    function getRecommendedDistribution(
        address user
    ) external view returns (
        uint256[] memory chainIds,
        uint256[] memory amounts,
        uint256[] memory expectedAPYs
    ) {
        // Get all supported chains
        uint256[] memory allChains = getSupportedChainsArray();
        
        // Get user's risk tolerance
        uint256 riskTolerance = 0;
        uint256[] memory userChainsArray = getUserChainsArray(user);
        if (userChainsArray.length > 0) {
            riskTolerance = userLiquidity[user][userChainsArray[0]].riskTolerance;
        } else {
            // Use default if no existing preferences
            riskTolerance = riskParams.defaultRiskTolerance;
        }
        
        // Get total user liquidity
        uint256 totalLiquidity = getUserTotalLiquidity(user);
        
        // Prepare return arrays
        chainIds = new uint256[](allChains.length);
        amounts = new uint256[](allChains.length);
        expectedAPYs = new uint256[](allChains.length);
        
        // Calculate distributions (this would be more sophisticated in production)
        uint256 allocatedCount = 0;
        for (uint256 i = 0; i < allChains.length; i++) {
            // Skip paused chains
            if (chains[allChains[i]].paused) continue;
            
            // Calculate base allocation percentage
            uint256 baseAllocation = 10000 / allChains.length;
            
            // Adjust based on risk tolerance and APY
            uint256 adjustedAllocation;
            if (riskTolerance > 6000) {
                // Higher risk tolerance - prioritize APY
                adjustedAllocation = baseAllocation.mul(chains[allChains[i]].interestRate).div(500); // Normalize by 5%
            } else {
                // Lower risk tolerance - more balanced
                adjustedAllocation = baseAllocation.mul(8000 - chains[allChains[i]].utilizationRate).div(4000); // Normalize by 40% utilization
            }
            
            // Enforce maximum allocation per chain
            if (adjustedAllocation > riskParams.maxAllocationPerChain) {
                adjustedAllocation = riskParams.maxAllocationPerChain;
            }
            
            // Add to arrays
            chainIds[allocatedCount] = allChains[i];
            amounts[allocatedCount] = totalLiquidity.mul(adjustedAllocation).div(10000);
            expectedAPYs[allocatedCount] = chains[allChains[i]].interestRate;
            
            allocatedCount++;
        }
        
        // Resize arrays if we skipped some chains
        if (allocatedCount < allChains.length) {
            assembly {
                mstore(chainIds, allocatedCount)
                mstore(amounts, allocatedCount)
                mstore(expectedAPYs, allocatedCount)
            }
        }
        
        return (chainIds, amounts, expectedAPYs);
    }
    
    /**
     * @dev Get all supported chain IDs
     * @return Array of supported chain IDs
     */
    function getSupportedChainsArray() public view returns (uint256[] memory) {
        uint256 count = supportedChains.length();
        uint256[] memory result = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            result[i] = supportedChains.at(i);
        }
        
        return result;
    }
    
    /**
     * @dev Get the count of supported chains
     * @return Count of supported chains
     */
    function getSupportedChainCount() external view returns (uint256) {
        return supportedChains.length();
    }
    
    /**
     * @dev Get chain liquidity sources
     * @param chainId Chain ID
     * @return sources Array of source IDs
     */
    function getChainLiquiditySources(uint256 chainId) external view returns (bytes32[] memory) {
        require(supportedChains.contains(chainId), "Chain not supported");
        return chainLiquiditySources[chainId];
    }
    
    /**
     * @dev Get details for a specific liquidity source
     * @param sourceId Source ID
     * @return Source details
     */
    function getLiquiditySourceDetails(bytes32 sourceId) external view returns (
        uint256 chainId,
        address protocol,
        address asset,
        uint256 amount,
        uint256 apy,
        uint256 utilizationRate,
        bool active
    ) {
        LiquiditySource storage source = liquiditySources[sourceId];
        require(source.chainId != 0, "Source does not exist");
        
        return (
            source.chainId,
            source.protocol,
            source.asset,
            source.amount,
            source.apy,
            source.utilizationRate,
            source.active
        );
    }
    
    /**
     * @dev Get user's chains
     * @param user User address
     * @return Array of chain IDs
     */
    function getUserChainsArray(address user) public view returns (uint256[] memory) {
        uint256 count = userChains[user].length();
        uint256[] memory result = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            result[i] = userChains[user].at(i);
        }
        
        return result;
    }
    
    /**
     * @dev Get user's total liquidity across all chains
     * @param user User address
     * @return Total liquidity
     */
    function getUserTotalLiquidity(address user) public view returns (uint256) {
        uint256[] memory userChainsArray = getUserChainsArray(user);
        uint256 total = 0;
        
        for (uint256 i = 0; i < userChainsArray.length; i++) {
            total = total.add(userLiquidity[user][userChainsArray[i]].amount);
        }
        
        return total;
    }
    
    /**
     * @dev Get user liquidity for a specific chain
     * @param user User address
     * @param chainId Chain ID
     * @return User liquidity details
     */
    function getUserLiquidity(address user, uint256 chainId) external view returns (
        uint256 amount,
        uint256 lastDeposited,
        uint256 lastWithdrawn,
        bool optimizationEnabled,
        uint256 riskTolerance,
        uint256 lockUntil
    ) {
        UserLiquidity storage userLiq = userLiquidity[user][chainId];
        
        return (
            userLiq.amount,
            userLiq.lastDeposited,
            userLiq.lastWithdrawn,
            userLiq.optimizationEnabled,
            userLiq.riskTolerance,
            userLiq.lockUntil
        );
    }
    
    /**
     * @dev Update analytics data
     */
    function updateAnalytics() internal {
        // Get current data
        uint256 tvl = 0;
        uint256 totalBorrows = 0;
        uint256 weighedAPY = 0;
        uint256 totalActiveUsers = 0;
        uint256 weighedUtilization = 0;
        
        // Calculate TVL and other metrics
        uint256[] memory allChains = getSupportedChainsArray();
        
        for (uint256 i = 0; i < allChains.length; i++) {
            ChainInfo storage chainInfo = chains[allChains[i]];
            tvl = tvl.add(chainInfo.totalLiquidity);
            weighedAPY = weighedAPY.add(chainInfo.interestRate.mul(chainInfo.totalLiquidity));
            weighedUtilization = weighedUtilization.add(chainInfo.utilizationRate.mul(chainInfo.totalLiquidity));
        }
        
        // Calculate averages
        uint256 averageAPY = tvl > 0 ? weighedAPY.div(tvl) : 0;
        uint256 averageUtilization = tvl > 0 ? weighedUtilization.div(tvl) : 0;
        
        // Get latest analytics entry
        AnalyticsData storage latest = analyticsHistory[analyticsHistory.length - 1];
        
        // Calculate 24h volume
        uint256 crossChainVolume24h = 0;
        bytes32[] memory allTransfers = getAllTransfers();
        uint256 last24h = block.timestamp - 1 days;
        
        for (uint256 i = 0; i < allTransfers.length; i++) {
            CrossChainTransfer storage transfer = crossChainTransfers[allTransfers[i]];
            if (transfer.timestamp >= last24h) {
                crossChainVolume24h = crossChainVolume24h.add(transfer.amount);
            }
        }
        
        // Add new analytics entry
        analyticsHistory.push(AnalyticsData({
            timestamp: block.timestamp,
            tvl: tvl,
            totalBorrows: totalBorrows,
            averageAPY: averageAPY,
            crossChainVolume24h: crossChainVolume24h,
            totalActiveLPs: totalActiveUsers,
            averageUtilization: averageUtilization,
            protocolRevenue: latest.protocolRevenue, // Unchanged for now
            averageGasUsed: latest.averageGasUsed, // Unchanged for now
            successRate: latest.successRate, // Unchanged for now
            marketState: latest.marketState // Unchanged for now
        }));
        
        // Limit history size
        if (analyticsHistory.length > 30) { // Keep 30 days
            // Shift array
            for (uint256 i = 0; i < analyticsHistory.length - 1; i++) {
                analyticsHistory[i] = analyticsHistory[i + 1];
            }
            analyticsHistory.pop();
        }
        
        emit AnalyticsUpdated(block.timestamp, tvl, averageAPY, crossChainVolume24h);
    }
    
    /**
     * @dev Get analytics history
     * @param count Number of entries to retrieve (0 for all)
     * @return timestamps Array of timestamps
     * @return tvls Array of TVLs
     * @return apys Array of average APYs
     * @return volumes Array of 24h volumes
     */
    function getAnalyticsHistory(uint256 count) external view returns (
        uint256[] memory timestamps,
        uint256[] memory tvls,
        uint256[] memory apys,
        uint256[] memory volumes
    ) {
        uint256 entryCount = count == 0 || count > analyticsHistory.length ? analyticsHistory.length : count;
        
        timestamps = new uint256[](entryCount);
        tvls = new uint256[](entryCount);
        apys = new uint256[](entryCount);
        volumes = new uint256[](entryCount);
        
        for (uint256 i = 0; i < entryCount; i++) {
            uint256 index = analyticsHistory.length - entryCount + i;
            timestamps[i] = analyticsHistory[index].timestamp;
            tvls[i] = analyticsHistory[index].tvl;
            apys[i] = analyticsHistory[index].averageAPY;
            volumes[i] = analyticsHistory[index].crossChainVolume24h;
        }
        
        return (timestamps, tvls, apys, volumes);
    }
    
    /**
     * @dev Get all transfer IDs
     * @return Array of transfer IDs
     */
    function getAllTransfers() public view returns (bytes32[] memory) {
        // In a real implementation, this would be more efficient
        // For simplicity, we'll use a dummy approach here
        return new bytes32[](0);
    }
    
    /**
     * @dev Initialize a cross-chain transfer
     * @param transferId Transfer ID
     * @param sourceChainId Source chain ID
     * @param destinationChainId Destination chain ID
     * @param amount Amount to transfer
     * @param recipient Recipient address
     * @param fee Fee
     * @param data Additional data
     * @return messageId Message ID from the bridge
     */
    function _initiateTransfer(
        bytes32 transferId,
        uint256 sourceChainId,
        uint256 destinationChainId,
        uint256 amount,
        address recipient,
        uint256 fee,
        bytes memory data
    ) internal returns (bytes32) {
        // In a production system, this would call the bridge contract
        // For this demo, we'll just return a dummy message ID
        return keccak256(abi.encodePacked(
            transferId,
            sourceChainId,
            destinationChainId,
            amount,
            recipient,
            fee,
            data,
            block.timestamp
        ));
    }
    
    /**
     * @dev Execute a strategy's logic
     * @param strategyId Strategy ID
     * @param user User address
     * @param executionData Execution data
     * @return success Whether execution was successful
     */
    function _executeStrategyLogic(
        uint256 strategyId,
        address user,
        bytes calldata executionData
    ) internal returns (bool) {
        // In a production system, this would implement complex strategy logic
        // For this demo, we'll just assume it's successful
        return true;
    }
    
    /**
     * @dev Get the chain ID for the current network
     * @return chainId The current chain ID
     */
    function getChainIdForCurrentNetwork() internal view returns (uint256) {
        return block.chainid;
    }
    
    /**
     * @dev Add an operator
     * @param operator Operator address
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        require(!operators.contains(operator), "Operator already exists");
        
        operators.add(operator);
        
        emit OperatorAdded(operator);
    }
    
    /**
     * @dev Remove an operator
     * @param operator Operator address
     */
    function removeOperator(address operator) external onlyOwner {
        require(operators.contains(operator), "Operator does not exist");
        
        operators.remove(operator);
        
        emit OperatorRemoved(operator);
    }
    
    /**
     * @dev Check if an address is an operator
     * @param operator Operator address
     * @return Whether the address is an operator
     */
    function isOperator(address operator) public view returns (bool) {
        return operators.contains(operator) || operator == owner();
    }
    
    /**
     * @dev Update risk parameters
     * @param _defaultRiskTolerance Default risk tolerance in basis points
     * @param _maxAllocationPerChain Maximum allocation per chain in basis points
     * @param _minDiversificationCount Minimum diversification count
     * @param _correlationThreshold Correlation threshold in basis points
     * @param _volatilityThreshold Volatility threshold in basis points
     * @param _maxDrawdownTolerance Maximum drawdown tolerance in basis points
     * @param _rebalanceCooldown Rebalance cooldown in seconds
     * @param _slippageProtection Whether to enable slippage protection
     */
    function updateRiskParameters(
        uint256 _defaultRiskTolerance,
        uint256 _maxAllocationPerChain,
        uint256 _minDiversificationCount,
        uint256 _correlationThreshold,
        uint256 _volatilityThreshold,
        uint256 _maxDrawdownTolerance,
        uint256 _rebalanceCooldown,
        bool _slippageProtection
    ) external onlyOwner {
        require(_defaultRiskTolerance <= 10000, "Default risk tolerance exceeds 100%");
        require(_maxAllocationPerChain <= 10000, "Max allocation exceeds 100%");
        require(_minDiversificationCount > 0, "Min diversification count must be > 0");
        require(_correlationThreshold <= 10000, "Correlation threshold exceeds 100%");
        require(_volatilityThreshold <= 10000, "Volatility threshold exceeds 100%");
        require(_maxDrawdownTolerance <= 10000, "Max drawdown tolerance exceeds 100%");
        
        riskParams.defaultRiskTolerance = _defaultRiskTolerance;
        riskParams.maxAllocationPerChain = _maxAllocationPerChain;
        riskParams.minDiversificationCount = _minDiversificationCount;
        riskParams.correlationThreshold = _correlationThreshold;
        riskParams.volatilityThreshold = _volatilityThreshold;
        riskParams.maxDrawdownTolerance = _maxDrawdownTolerance;
        riskParams.rebalanceCooldown = _rebalanceCooldown;
        riskParams.slippageProtection = _slippageProtection;
        
        emit RiskParametersUpdated(_defaultRiskTolerance, _maxAllocationPerChain, _minDiversificationCount);
    }
    
    /**
     * @dev Update bridge parameters
     * @param _minTransferAmount Minimum transfer amount
     * @param _maxTransferAmount Maximum transfer amount
     * @param _defaultGasLimit Default gas limit
     * @param _transferTimeout Transfer timeout in seconds
     * @param _protocolFee Protocol fee in basis points
     */
    function updateBridgeParameters(
        uint256 _minTransferAmount,
        uint256 _maxTransferAmount,
        uint256 _defaultGasLimit,
        uint256 _transferTimeout,
        uint256 _protocolFee
    ) external onlyOwner {
        require(_minTransferAmount < _maxTransferAmount, "Min amount must be < max amount");
        require(_protocolFee <= 1000, "Protocol fee exceeds 10%");
        
        minTransferAmount = _minTransferAmount;
        maxTransferAmount = _maxTransferAmount;
        defaultGasLimit = _defaultGasLimit;
        transferTimeout = _transferTimeout;
        protocolFee = _protocolFee;
    }
    
    /**
     * @dev Update treasury address
     * @param _treasury New treasury address
     */
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }
    
    /**
     * @dev Enable or disable optimization for a user
     * @param chainId Chain ID
     * @param enabled Whether optimization is enabled
     * @param riskTolerance New risk tolerance
     */
    function setOptimizationSettings(
        uint256 chainId,
        bool enabled,
        uint256 riskTolerance
    ) external {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(userLiquidity[msg.sender][chainId].amount > 0, "No liquidity on this chain");
        require(riskTolerance <= 10000, "Risk tolerance exceeds 100%");
        
        userLiquidity[msg.sender][chainId].optimizationEnabled = enabled;
        userLiquidity[msg.sender][chainId].riskTolerance = riskTolerance;
    }
    
    /**
     * @dev Add an authorized withdrawer for a user's liquidity
     * @param chainId Chain ID
     * @param withdrawer Withdrawer address
     */
    function addAuthorizedWithdrawer(
        uint256 chainId,
        address withdrawer
    ) external {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(userLiquidity[msg.sender][chainId].amount > 0, "No liquidity on this chain");
        require(withdrawer != address(0), "Invalid withdrawer address");
        
        UserLiquidity storage userLiq = userLiquidity[msg.sender][chainId];
        
        // Check if already authorized
        for (uint256 i = 0; i < userLiq.authorizedWithdrawers.length; i++) {
            if (userLiq.authorizedWithdrawers[i] == withdrawer) {
                return; // Already authorized
            }
        }
        
        userLiq.authorizedWithdrawers.push(withdrawer);
    }
    
    /**
     * @dev Remove an authorized withdrawer for a user's liquidity
     * @param chainId Chain ID
     * @param withdrawer Withdrawer address
     */
    function removeAuthorizedWithdrawer(
        uint256 chainId,
        address withdrawer
    ) external {
        require(supportedChains.contains(chainId), "Chain not supported");
        require(userLiquidity[msg.sender][chainId].amount > 0, "No liquidity on this chain");
        
        UserLiquidity storage userLiq = userLiquidity[msg.sender][chainId];
        
        // Find and remove withdrawer
        for (uint256 i = 0; i < userLiq.authorizedWithdrawers.length; i++) {
            if (userLiq.authorizedWithdrawers[i] == withdrawer) {
                userLiq.authorizedWithdrawers[i] = userLiq.authorizedWithdrawers[userLiq.authorizedWithdrawers.length - 1];
                userLiq.authorizedWithdrawers.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Allow contract to receive ETH
    }
}
