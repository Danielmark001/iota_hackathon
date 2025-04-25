// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title CrossChainLiquidity
 * @dev Cross-chain liquidity module for the IntelliLend protocol
 * Allows for liquidity aggregation from different chains and AI-powered yield optimization
 */
contract CrossChainLiquidity is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Interfaces to the cross-layer bridge
    ICrossLayerBridge public bridge;
    
    // Interface to AI Risk Assessment
    IAIRiskAssessment public riskAssessment;
    
    // Lending Pool
    ILendingPool public lendingPool;
    
    // Struct for Cross-chain Asset
    struct CrossChainAsset {
        address tokenAddress;
        uint256 chainId;
        bytes32 remoteAssetId; // Asset ID on the source chain
        uint256 totalLiquidity;
        uint256 allocatedLiquidity;
        uint256 utilizationRate; // In basis points (1/100 of a percent)
        bool isActive;
        YieldStrategy[] strategies;
        uint256 currentStrategyIndex;
    }
    
    // Struct for Yield Strategy
    struct YieldStrategy {
        string name;
        uint256 projectedAPY; // In basis points
        uint256 riskScore; // 0-100, assessed by AI
        uint256 minAmount; // Minimum amount to deploy
        uint256 maxAmount; // Maximum amount to deploy
        address strategyController; // Address of the strategy controller
        bool isActive;
    }
    
    // Struct for Liquidity Provider
    struct LiquidityProvider {
        uint256 totalLiquidity;
        mapping(address => uint256) assetLiquidity; // token address -> amount
        mapping(address => uint256) assetShares; // token address -> shares
        mapping(address => uint256) lastDepositTime; // token address -> timestamp
        uint256 reputationScore; // 0-100, assessed by AI
        bool crossChainEnabled;
    }
    
    // Struct for Rebalance History
    struct RebalanceHistory {
        uint256 timestamp;
        address tokenAddress;
        uint256 oldStrategy;
        uint256 newStrategy;
        uint256 amount;
        uint256 projectedAPYChange; // In basis points
        bool successful;
    }
    
    // Global yield optimizer settings
    uint256 public rebalanceThreshold; // Minimum APY improvement to trigger rebalance (in basis points)
    uint256 public rebalanceInterval; // Minimum time between rebalances (in seconds)
    uint256 public lastRebalanceTime; // Timestamp of the last rebalance
    uint256 public performanceFee; // Fee taken from yield (in basis points)
    uint256 public withdrawalFee; // Fee for early withdrawals (in basis points)
    uint256 public minLockPeriod; // Minimum time assets must be locked (in seconds)
    
    // Market condition parameters
    uint256 public marketVolatility; // 0-100, assessed by oracle
    uint256 public marketTrend; // -100 to 100, negative for downtrend, positive for uptrend
    uint256 public systemRiskLevel; // 0-100, assessed by AI
    
    // Mapping from token address to CrossChainAsset
    mapping(address => CrossChainAsset) public assets;
    
    // Mapping of supported chain IDs
    mapping(uint256 => bool) public supportedChains;
    
    // Mapping from provider address to LiquidityProvider
    mapping(address => LiquidityProvider) public providers;
    
    // Array to track registered assets
    address[] public registeredAssets;
    
    // Rebalance history
    RebalanceHistory[] public rebalanceHistory;
    
    // Events
    event AssetRegistered(address indexed tokenAddress, uint256 chainId, bytes32 remoteAssetId);
    event StrategyRegistered(address indexed tokenAddress, string strategyName, uint256 projectedAPY, uint256 riskScore);
    event LiquidityAdded(address indexed provider, address indexed tokenAddress, uint256 amount, uint256 shares);
    event LiquidityRemoved(address indexed provider, address indexed tokenAddress, uint256 amount, uint256 shares);
    event StrategyUpdated(address indexed tokenAddress, uint256 strategyIndex, uint256 projectedAPY, uint256 riskScore);
    event Rebalanced(address indexed tokenAddress, uint256 oldStrategy, uint256 newStrategy, uint256 amount);
    event YieldHarvested(address indexed tokenAddress, uint256 strategyIndex, uint256 amount, uint256 fee);
    event CrossChainLiquidityReceived(uint256 chainId, bytes32 remoteAssetId, uint256 amount);
    event CrossChainLiquiditySent(uint256 chainId, bytes32 remoteAssetId, uint256 amount);
    event RiskParametersUpdated(address indexed tokenAddress, uint256 oldRiskScore, uint256 newRiskScore);
    event MarketConditionsUpdated(uint256 volatility, uint256 trend, uint256 systemRisk);
    
    /**
     * @dev Constructor
     * @param _bridgeAddress Address of the cross-layer bridge
     * @param _riskAssessmentAddress Address of the AI risk assessment
     * @param _lendingPoolAddress Address of the lending pool
     */
    constructor(
        address _bridgeAddress,
        address _riskAssessmentAddress,
        address _lendingPoolAddress
    ) {
        bridge = ICrossLayerBridge(_bridgeAddress);
        riskAssessment = IAIRiskAssessment(_riskAssessmentAddress);
        lendingPool = ILendingPool(_lendingPoolAddress);
        
        // Set default parameters
        rebalanceThreshold = 50; // 0.5% minimum improvement
        rebalanceInterval = 1 days;
        lastRebalanceTime = block.timestamp;
        performanceFee = 1000; // 10%
        withdrawalFee = 500; // 5%
        minLockPeriod = 7 days;
        
        // Set default market conditions
        marketVolatility = 50; // Medium volatility
        marketTrend = 0; // Neutral trend
        systemRiskLevel = 50; // Medium risk
        
        // Add IOTA EVM as a supported chain
        supportedChains[1] = true; // Chain ID 1 for IOTA EVM
    }
    
    /**
     * @dev Register a new cross-chain asset
     * @param tokenAddress Address of the token on this chain
     * @param chainId ID of the source chain
     * @param remoteAssetId Asset ID on the source chain
     */
    function registerAsset(
        address tokenAddress,
        uint256 chainId,
        bytes32 remoteAssetId
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(supportedChains[chainId], "Chain not supported");
        require(!assets[tokenAddress].isActive, "Asset already registered");
        
        // Create the asset
        CrossChainAsset storage asset = assets[tokenAddress];
        asset.tokenAddress = tokenAddress;
        asset.chainId = chainId;
        asset.remoteAssetId = remoteAssetId;
        asset.totalLiquidity = 0;
        asset.allocatedLiquidity = 0;
        asset.utilizationRate = 0;
        asset.isActive = true;
        asset.currentStrategyIndex = 0;
        
        // Add to registered assets
        registeredAssets.push(tokenAddress);
        
        emit AssetRegistered(tokenAddress, chainId, remoteAssetId);
    }
    
    /**
     * @dev Register a new yield strategy for an asset
     * @param tokenAddress Address of the token
     * @param name Name of the strategy
     * @param projectedAPY Projected annual yield (in basis points)
     * @param riskScore Risk score assessed by AI (0-100)
     * @param minAmount Minimum amount for the strategy
     * @param maxAmount Maximum amount for the strategy
     * @param strategyController Address of the strategy controller
     */
    function registerStrategy(
        address tokenAddress,
        string calldata name,
        uint256 projectedAPY,
        uint256 riskScore,
        uint256 minAmount,
        uint256 maxAmount,
        address strategyController
    ) external onlyOwner {
        require(assets[tokenAddress].isActive, "Asset not registered");
        require(strategyController != address(0), "Invalid controller address");
        require(riskScore <= 100, "Risk score must be 0-100");
        
        // Create the strategy
        YieldStrategy memory strategy = YieldStrategy({
            name: name,
            projectedAPY: projectedAPY,
            riskScore: riskScore,
            minAmount: minAmount,
            maxAmount: maxAmount,
            strategyController: strategyController,
            isActive: true
        });
        
        // Add to the asset's strategies
        assets[tokenAddress].strategies.push(strategy);
        
        emit StrategyRegistered(tokenAddress, name, projectedAPY, riskScore);
    }
    
    /**
     * @dev Add liquidity to the protocol
     * @param tokenAddress Address of the token
     * @param amount Amount to add
     */
    function addLiquidity(
        address tokenAddress,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(assets[tokenAddress].isActive, "Asset not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        // Get asset and provider
        CrossChainAsset storage asset = assets[tokenAddress];
        LiquidityProvider storage provider = providers[msg.sender];
        
        // Calculate shares (simplified for now)
        uint256 shares = calculateShares(tokenAddress, amount);
        
        // Transfer tokens from user
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update asset state
        asset.totalLiquidity = asset.totalLiquidity.add(amount);
        
        // Update provider state
        provider.totalLiquidity = provider.totalLiquidity.add(amount);
        provider.assetLiquidity[tokenAddress] = provider.assetLiquidity[tokenAddress].add(amount);
        provider.assetShares[tokenAddress] = provider.assetShares[tokenAddress].add(shares);
        provider.lastDepositTime[tokenAddress] = block.timestamp;
        
        // If this is a new provider, assess their reputation
        if (provider.totalLiquidity == amount) {
            provider.reputationScore = 50; // Default score
            
            // Request AI assessment of the provider
            requestReputationAssessment(msg.sender);
        }
        
        // Check if we should allocate to strategy
        if (shouldAllocateToStrategy(tokenAddress)) {
            allocateToStrategy(tokenAddress);
        }
        
        emit LiquidityAdded(msg.sender, tokenAddress, amount, shares);
    }
    
    /**
     * @dev Remove liquidity from the protocol
     * @param tokenAddress Address of the token
     * @param shares Number of shares to redeem
     */
    function removeLiquidity(
        address tokenAddress,
        uint256 shares
    ) external nonReentrant {
        require(assets[tokenAddress].isActive, "Asset not supported");
        
        // Get asset and provider
        CrossChainAsset storage asset = assets[tokenAddress];
        LiquidityProvider storage provider = providers[msg.sender];
        
        require(provider.assetShares[tokenAddress] >= shares, "Insufficient shares");
        
        // Calculate amount to withdraw
        uint256 amount = calculateAmount(tokenAddress, shares);
        require(amount > 0, "Amount must be greater than 0");
        
        // Check if there's a early withdrawal fee
        uint256 lockPeriod = block.timestamp.sub(provider.lastDepositTime[tokenAddress]);
        uint256 feeAmount = 0;
        
        if (lockPeriod < minLockPeriod) {
            feeAmount = amount.mul(withdrawalFee).div(10000);
            amount = amount.sub(feeAmount);
        }
        
        // Ensure we have enough liquidity
        require(
            IERC20(tokenAddress).balanceOf(address(this)) >= amount,
            "Insufficient liquidity"
        );
        
        // Update asset state
        asset.totalLiquidity = asset.totalLiquidity.sub(amount.add(feeAmount));
        
        // Update provider state
        provider.totalLiquidity = provider.totalLiquidity.sub(amount.add(feeAmount));
        provider.assetLiquidity[tokenAddress] = provider.assetLiquidity[tokenAddress].sub(amount.add(feeAmount));
        provider.assetShares[tokenAddress] = provider.assetShares[tokenAddress].sub(shares);
        
        // Transfer tokens to user
        IERC20(tokenAddress).safeTransfer(msg.sender, amount);
        
        // If there was a fee, it stays in the contract
        
        emit LiquidityRemoved(msg.sender, tokenAddress, amount, shares);
    }
    
    /**
     * @dev Update a strategy's parameters
     * @param tokenAddress Address of the token
     * @param strategyIndex Index of the strategy
     * @param projectedAPY New projected APY
     * @param riskScore New risk score
     * @param minAmount New minimum amount
     * @param maxAmount New maximum amount
     * @param isActive Whether the strategy is active
     */
    function updateStrategy(
        address tokenAddress,
        uint256 strategyIndex,
        uint256 projectedAPY,
        uint256 riskScore,
        uint256 minAmount,
        uint256 maxAmount,
        bool isActive
    ) external onlyOwner {
        require(assets[tokenAddress].isActive, "Asset not registered");
        require(strategyIndex < assets[tokenAddress].strategies.length, "Invalid strategy index");
        require(riskScore <= 100, "Risk score must be 0-100");
        
        // Update the strategy
        YieldStrategy storage strategy = assets[tokenAddress].strategies[strategyIndex];
        strategy.projectedAPY = projectedAPY;
        strategy.riskScore = riskScore;
        strategy.minAmount = minAmount;
        strategy.maxAmount = maxAmount;
        strategy.isActive = isActive;
        
        emit StrategyUpdated(tokenAddress, strategyIndex, projectedAPY, riskScore);
        
        // Check if we should rebalance based on new parameters
        if (shouldRebalance(tokenAddress)) {
            rebalance(tokenAddress);
        }
    }
    
    /**
     * @dev Update market conditions
     * @param volatility New market volatility (0-100)
     * @param trend New market trend (-100 to 100)
     * @param systemRisk New system risk level (0-100)
     */
    function updateMarketConditions(
        uint256 volatility,
        int256 trend,
        uint256 systemRisk
    ) external onlyOwner {
        require(volatility <= 100, "Volatility must be 0-100");
        require(trend >= -100 && trend <= 100, "Trend must be -100 to 100");
        require(systemRisk <= 100, "System risk must be 0-100");
        
        marketVolatility = volatility;
        marketTrend = uint256(trend);
        systemRiskLevel = systemRisk;
        
        emit MarketConditionsUpdated(volatility, uint256(trend), systemRisk);
        
        // Check if we should rebalance based on new conditions
        for (uint256 i = 0; i < registeredAssets.length; i++) {
            if (shouldRebalance(registeredAssets[i])) {
                rebalance(registeredAssets[i]);
            }
        }
    }
    
    /**
     * @dev Rebalance an asset's allocation strategy
     * @param tokenAddress Address of the token
     */
    function rebalance(address tokenAddress) public whenNotPaused {
        require(
            msg.sender == owner() || msg.sender == address(this),
            "Only owner or self-call"
        );
        require(assets[tokenAddress].isActive, "Asset not registered");
        require(
            block.timestamp >= lastRebalanceTime.add(rebalanceInterval),
            "Rebalance too soon"
        );
        
        CrossChainAsset storage asset = assets[tokenAddress];
        require(asset.strategies.length > 0, "No strategies available");
        
        // Find the best strategy based on current conditions
        uint256 currentIndex = asset.currentStrategyIndex;
        uint256 newIndex = findBestStrategy(tokenAddress);
        
        // Only rebalance if there's a better strategy
        if (newIndex != currentIndex) {
            YieldStrategy storage oldStrategy = asset.strategies[currentIndex];
            YieldStrategy storage newStrategy = asset.strategies[newIndex];
            
            // Calculate how much APY improvement we get
            uint256 apyImprovement = 0;
            if (newStrategy.projectedAPY > oldStrategy.projectedAPY) {
                apyImprovement = newStrategy.projectedAPY.sub(oldStrategy.projectedAPY);
            }
            
            // Only rebalance if the improvement exceeds the threshold
            if (apyImprovement >= rebalanceThreshold) {
                // Move funds from old strategy to new strategy
                uint256 amountToMove = asset.allocatedLiquidity;
                
                // Call the strategy controllers to perform the actual movement
                bool success = executeStrategySwitch(
                    tokenAddress,
                    oldStrategy.strategyController,
                    newStrategy.strategyController,
                    amountToMove
                );
                
                if (success) {
                    // Update asset state
                    asset.currentStrategyIndex = newIndex;
                    
                    // Record the rebalance history
                    RebalanceHistory memory history = RebalanceHistory({
                        timestamp: block.timestamp,
                        tokenAddress: tokenAddress,
                        oldStrategy: currentIndex,
                        newStrategy: newIndex,
                        amount: amountToMove,
                        projectedAPYChange: apyImprovement,
                        successful: true
                    });
                    
                    rebalanceHistory.push(history);
                    
                    emit Rebalanced(tokenAddress, currentIndex, newIndex, amountToMove);
                }
            }
        }
        
        lastRebalanceTime = block.timestamp;
    }
    
    /**
     * @dev Harvest yield from the current strategy
     * @param tokenAddress Address of the token
     */
    function harvestYield(address tokenAddress) external nonReentrant whenNotPaused {
        require(assets[tokenAddress].isActive, "Asset not registered");
        
        CrossChainAsset storage asset = assets[tokenAddress];
        require(asset.strategies.length > 0, "No strategies available");
        
        uint256 strategyIndex = asset.currentStrategyIndex;
        YieldStrategy storage strategy = asset.strategies[strategyIndex];
        
        // Call the strategy controller to harvest the yield
        (bool success, uint256 harvestedAmount) = executeHarvest(
            tokenAddress,
            strategy.strategyController
        );
        
        if (success && harvestedAmount > 0) {
            // Calculate fee
            uint256 feeAmount = harvestedAmount.mul(performanceFee).div(10000);
            uint256 netAmount = harvestedAmount.sub(feeAmount);
            
            // Distribute net amount to the asset's total liquidity
            asset.totalLiquidity = asset.totalLiquidity.add(netAmount);
            
            emit YieldHarvested(tokenAddress, strategyIndex, harvestedAmount, feeAmount);
        }
    }
    
    /**
     * @dev Process a cross-chain liquidity deposit
     * @param chainId Source chain ID
     * @param remoteAssetId Asset ID on the source chain
     * @param amount Amount deposited
     * @param recipient Recipient address on this chain
     */
    function processCrossChainDeposit(
        uint256 chainId,
        bytes32 remoteAssetId,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        // Only the bridge or owner can call this
        require(
            msg.sender == address(bridge) || msg.sender == owner(),
            "Only bridge or owner"
        );
        require(supportedChains[chainId], "Chain not supported");
        
        // Find the matching asset
        address tokenAddress = findAssetByRemoteId(chainId, remoteAssetId);
        require(tokenAddress != address(0), "Asset not registered");
        
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // Update asset state
        asset.totalLiquidity = asset.totalLiquidity.add(amount);
        
        // Create liquidity for the recipient if they don't exist
        LiquidityProvider storage provider = providers[recipient];
        
        // Calculate shares
        uint256 shares = calculateShares(tokenAddress, amount);
        
        // Update provider state
        provider.totalLiquidity = provider.totalLiquidity.add(amount);
        provider.assetLiquidity[tokenAddress] = provider.assetLiquidity[tokenAddress].add(amount);
        provider.assetShares[tokenAddress] = provider.assetShares[tokenAddress].add(shares);
        provider.lastDepositTime[tokenAddress] = block.timestamp;
        provider.crossChainEnabled = true;
        
        emit CrossChainLiquidityReceived(chainId, remoteAssetId, amount);
        emit LiquidityAdded(recipient, tokenAddress, amount, shares);
        
        // Check if we should allocate to strategy
        if (shouldAllocateToStrategy(tokenAddress)) {
            allocateToStrategy(tokenAddress);
        }
    }
    
    /**
     * @dev Send liquidity to another chain
     * @param tokenAddress Address of the token on this chain
     * @param targetChainId Target chain ID
     * @param amount Amount to send
     * @param recipient Recipient address on the target chain
     */
    function sendCrossChainLiquidity(
        address tokenAddress,
        uint256 targetChainId,
        uint256 amount,
        bytes32 recipient
    ) external nonReentrant whenNotPaused {
        require(assets[tokenAddress].isActive, "Asset not supported");
        require(supportedChains[targetChainId], "Chain not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        // Get asset and provider
        CrossChainAsset storage asset = assets[tokenAddress];
        LiquidityProvider storage provider = providers[msg.sender];
        
        require(provider.assetLiquidity[tokenAddress] >= amount, "Insufficient liquidity");
        
        // Calculate shares to burn
        uint256 shares = (provider.assetShares[tokenAddress].mul(amount)).div(provider.assetLiquidity[tokenAddress]);
        
        // Update provider state
        provider.totalLiquidity = provider.totalLiquidity.sub(amount);
        provider.assetLiquidity[tokenAddress] = provider.assetLiquidity[tokenAddress].sub(amount);
        provider.assetShares[tokenAddress] = provider.assetShares[tokenAddress].sub(shares);
        
        // Update asset state
        asset.totalLiquidity = asset.totalLiquidity.sub(amount);
        
        // Prepare bridge message
        bytes memory payload = abi.encode(
            targetChainId,
            recipient,
            asset.remoteAssetId,
            amount
        );
        
        // Send message via bridge
        bridge.sendMessageToL1(
            recipient,
            "CROSS_CHAIN_DEPOSIT",
            payload,
            2000000 // gas limit
        );
        
        emit CrossChainLiquiditySent(targetChainId, asset.remoteAssetId, amount);
    }
    
    /**
     * @dev Enable or disable cross-chain functionality for a provider
     * @param enabled Whether cross-chain is enabled
     */
    function setCrossChainEnabled(bool enabled) external {
        LiquidityProvider storage provider = providers[msg.sender];
        provider.crossChainEnabled = enabled;
    }
    
    /**
     * @dev Update global protocol parameters
     * @param _rebalanceThreshold New rebalance threshold
     * @param _rebalanceInterval New rebalance interval
     * @param _performanceFee New performance fee
     * @param _withdrawalFee New withdrawal fee
     * @param _minLockPeriod New minimum lock period
     */
    function updateProtocolParameters(
        uint256 _rebalanceThreshold,
        uint256 _rebalanceInterval,
        uint256 _performanceFee,
        uint256 _withdrawalFee,
        uint256 _minLockPeriod
    ) external onlyOwner {
        require(_performanceFee <= 3000, "Performance fee too high"); // Max 30%
        require(_withdrawalFee <= 2000, "Withdrawal fee too high"); // Max 20%
        
        rebalanceThreshold = _rebalanceThreshold;
        rebalanceInterval = _rebalanceInterval;
        performanceFee = _performanceFee;
        withdrawalFee = _withdrawalFee;
        minLockPeriod = _minLockPeriod;
    }
    
    /**
     * @dev Add a supported chain
     * @param chainId ID of the chain to support
     */
    function addSupportedChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = true;
    }
    
    /**
     * @dev Remove a supported chain
     * @param chainId ID of the chain to remove
     */
    function removeSupportedChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
    }
    
    /**
     * @dev Pause the protocol
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the protocol
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw fees collected by the protocol
     * @param tokenAddress Address of the token
     * @param recipient Address to receive the fees
     */
    function withdrawFees(address tokenAddress, address recipient) external onlyOwner {
        // Calculate fees as the difference between contract balance and total liquidity
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        uint256 totalLiquidity = assets[tokenAddress].totalLiquidity;
        
        uint256 fees = 0;
        if (balance > totalLiquidity) {
            fees = balance.sub(totalLiquidity);
        }
        
        require(fees > 0, "No fees to withdraw");
        
        // Transfer fees
        IERC20(tokenAddress).safeTransfer(recipient, fees);
    }
    
    // Internal functions
    
    /**
     * @dev Calculate shares for a given amount
     * @param tokenAddress Address of the token
     * @param amount Amount of tokens
     * @return shares Number of shares
     */
    function calculateShares(address tokenAddress, uint256 amount) internal view returns (uint256) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // If no liquidity yet, 1 token = 1 share
        if (asset.totalLiquidity == 0) {
            return amount;
        }
        
        // Calculate total shares across all providers
        uint256 totalShares = 0;
        for (uint256 i = 0; i < registeredAssets.length; i++) {
            if (registeredAssets[i] == tokenAddress) {
                for (uint256 j = 0; j < registeredAssets.length; j++) {
                    address providerAddr = address(uint160(j)); // This is a simplified example
                    totalShares = totalShares.add(providers[providerAddr].assetShares[tokenAddress]);
                }
                break;
            }
        }
        
        // Calculate shares based on current liquidity and total shares
        return amount.mul(totalShares).div(asset.totalLiquidity);
    }
    
    /**
     * @dev Calculate amount for a given number of shares
     * @param tokenAddress Address of the token
     * @param shares Number of shares
     * @return amount Amount of tokens
     */
    function calculateAmount(address tokenAddress, uint256 shares) internal view returns (uint256) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // Calculate total shares across all providers
        uint256 totalShares = 0;
        for (uint256 i = 0; i < registeredAssets.length; i++) {
            if (registeredAssets[i] == tokenAddress) {
                for (uint256 j = 0; j < registeredAssets.length; j++) {
                    address providerAddr = address(uint160(j)); // This is a simplified example
                    totalShares = totalShares.add(providers[providerAddr].assetShares[tokenAddress]);
                }
                break;
            }
        }
        
        // Calculate amount based on shares
        return shares.mul(asset.totalLiquidity).div(totalShares);
    }
    
    /**
     * @dev Check if we should allocate to a strategy
     * @param tokenAddress Address of the token
     * @return Whether we should allocate
     */
    function shouldAllocateToStrategy(address tokenAddress) internal view returns (bool) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // If no strategies, no allocation
        if (asset.strategies.length == 0) {
            return false;
        }
        
        // If already fully allocated, no more allocation
        if (asset.allocatedLiquidity >= asset.totalLiquidity) {
            return false;
        }
        
        // Get current strategy
        YieldStrategy storage strategy = asset.strategies[asset.currentStrategyIndex];
        
        // If strategy is not active, no allocation
        if (!strategy.isActive) {
            return false;
        }
        
        // If unallocated amount is below minimum, no allocation
        uint256 unallocated = asset.totalLiquidity.sub(asset.allocatedLiquidity);
        if (unallocated < strategy.minAmount) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Allocate funds to the current strategy
     * @param tokenAddress Address of the token
     */
    function allocateToStrategy(address tokenAddress) internal {
        CrossChainAsset storage asset = assets[tokenAddress];
        YieldStrategy storage strategy = asset.strategies[asset.currentStrategyIndex];
        
        uint256 unallocated = asset.totalLiquidity.sub(asset.allocatedLiquidity);
        uint256 amountToAllocate = unallocated;
        
        // Respect maximum amount
        if (asset.allocatedLiquidity.add(amountToAllocate) > strategy.maxAmount) {
            amountToAllocate = strategy.maxAmount.sub(asset.allocatedLiquidity);
        }
        
        // Call the strategy controller to allocate funds
        bool success = executeAllocation(
            tokenAddress,
            strategy.strategyController,
            amountToAllocate
        );
        
        if (success) {
            // Update allocated amount
            asset.allocatedLiquidity = asset.allocatedLiquidity.add(amountToAllocate);
            
            // Update utilization rate
            asset.utilizationRate = asset.allocatedLiquidity.mul(10000).div(asset.totalLiquidity);
        }
    }
    
    /**
     * @dev Check if we should rebalance
     * @param tokenAddress Address of the token
     * @return Whether we should rebalance
     */
    function shouldRebalance(address tokenAddress) internal view returns (bool) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // If no strategies or only one strategy, no rebalance
        if (asset.strategies.length <= 1) {
            return false;
        }
        
        // If no allocation, no rebalance
        if (asset.allocatedLiquidity == 0) {
            return false;
        }
        
        // If too soon since last rebalance, no rebalance
        if (block.timestamp < lastRebalanceTime.add(rebalanceInterval)) {
            return false;
        }
        
        // Get current strategy
        YieldStrategy storage currentStrategy = asset.strategies[asset.currentStrategyIndex];
        
        // Find best strategy
        uint256 bestIndex = findBestStrategy(tokenAddress);
        
        // If best strategy is current strategy, no rebalance
        if (bestIndex == asset.currentStrategyIndex) {
            return false;
        }
        
        // Get best strategy
        YieldStrategy storage bestStrategy = asset.strategies[bestIndex];
        
        // Calculate APY improvement
        uint256 apyImprovement = 0;
        if (bestStrategy.projectedAPY > currentStrategy.projectedAPY) {
            apyImprovement = bestStrategy.projectedAPY.sub(currentStrategy.projectedAPY);
        }
        
        // If improvement is below threshold, no rebalance
        if (apyImprovement < rebalanceThreshold) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Find the best strategy for an asset
     * @param tokenAddress Address of the token
     * @return Index of the best strategy
     */
    function findBestStrategy(address tokenAddress) internal view returns (uint256) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        // If no strategies, return 0
        if (asset.strategies.length == 0) {
            return 0;
        }
        
        // Initialize with current strategy
        uint256 bestIndex = asset.currentStrategyIndex;
        uint256 bestScore = 0;
        
        // Calculate score for current strategy
        YieldStrategy storage currentStrategy = asset.strategies[bestIndex];
        if (currentStrategy.isActive) {
            bestScore = calculateStrategyScore(currentStrategy);
        }
        
        // Check all strategies
        for (uint256 i = 0; i < asset.strategies.length; i++) {
            if (i == bestIndex) {
                continue; // Skip current strategy
            }
            
            YieldStrategy storage strategy = asset.strategies[i];
            
            // Skip inactive strategies
            if (!strategy.isActive) {
                continue;
            }
            
            // Skip strategies where our amount is outside their limits
            if (asset.allocatedLiquidity < strategy.minAmount || 
                asset.allocatedLiquidity > strategy.maxAmount) {
                continue;
            }
            
            // Calculate score
            uint256 score = calculateStrategyScore(strategy);
            
            // Update best if this is better
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }
        
        return bestIndex;
    }
    
    /**
     * @dev Calculate a score for a strategy based on APY and risk
     * @param strategy The strategy to score
     * @return The strategy score
     */
    function calculateStrategyScore(YieldStrategy storage strategy) internal view returns (uint256) {
        // Basic formula: APY * (100 - risk_weight * risk)
        
        // Adjust weight of risk based on market conditions
        uint256 riskWeight = 1; // Default weight
        
        // If market is volatile, increase risk weight
        if (marketVolatility > 75) {
            riskWeight = 2;
        } else if (marketVolatility > 50) {
            riskWeight = 1;
        }
        
        // If market is in downtrend, increase risk weight
        if (marketTrend < 0) {
            riskWeight = riskWeight.add(1);
        }
        
        // If system risk is high, increase risk weight
        if (systemRiskLevel > 75) {
            riskWeight = riskWeight.add(1);
        }
        
        // Calculate effective risk penalty
        uint256 riskPenalty = riskWeight.mul(strategy.riskScore).div(100);
        
        // Calculate score: APY * (1 - risk_penalty)
        uint256 score = strategy.projectedAPY.mul(100 - riskPenalty).div(100);
        
        return score;
    }
    
    /**
     * @dev Execute allocation to a strategy
     * @param tokenAddress Address of the token
     * @param strategyController Address of the strategy controller
     * @param amount Amount to allocate
     * @return success Whether the allocation was successful
     */
    function executeAllocation(
        address tokenAddress,
        address strategyController,
        uint256 amount
    ) internal returns (bool) {
        // Approve the strategy controller to spend tokens
        IERC20(tokenAddress).safeApprove(strategyController, 0);
        IERC20(tokenAddress).safeApprove(strategyController, amount);
        
        // Call the strategy controller
        (bool success,) = strategyController.call(
            abi.encodeWithSignature(
                "allocate(address,uint256)",
                tokenAddress,
                amount
            )
        );
        
        return success;
    }
    
    /**
     * @dev Execute strategy switch
     * @param tokenAddress Address of the token
     * @param oldController Address of the old strategy controller
     * @param newController Address of the new strategy controller
     * @param amount Amount to move
     * @return success Whether the switch was successful
     */
    function executeStrategySwitch(
        address tokenAddress,
        address oldController,
        address newController,
        uint256 amount
    ) internal returns (bool) {
        // Call the old controller to withdraw
        (bool success1,) = oldController.call(
            abi.encodeWithSignature(
                "withdraw(address,uint256)",
                tokenAddress,
                amount
            )
        );
        
        if (!success1) {
            return false;
        }
        
        // Approve the new controller to spend tokens
        IERC20(tokenAddress).safeApprove(newController, 0);
        IERC20(tokenAddress).safeApprove(newController, amount);
        
        // Call the new controller to allocate
        (bool success2,) = newController.call(
            abi.encodeWithSignature(
                "allocate(address,uint256)",
                tokenAddress,
                amount
            )
        );
        
        return success2;
    }
    
    /**
     * @dev Execute harvest from a strategy
     * @param tokenAddress Address of the token
     * @param strategyController Address of the strategy controller
     * @return success Whether the harvest was successful
     * @return harvestedAmount Amount harvested
     */
    function executeHarvest(
        address tokenAddress,
        address strategyController
    ) internal returns (bool success, uint256 harvestedAmount) {
        // Get token balance before harvest
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        
        // Call the strategy controller to harvest
        (bool callSuccess, bytes memory returnData) = strategyController.call(
            abi.encodeWithSignature(
                "harvest(address)",
                tokenAddress
            )
        );
        
        if (!callSuccess) {
            return (false, 0);
        }
        
        // Get token balance after harvest
        uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
        
        // Calculate harvested amount
        harvestedAmount = balanceAfter.sub(balanceBefore);
        
        return (true, harvestedAmount);
    }
    
    /**
     * @dev Find asset by remote ID
     * @param chainId Chain ID
     * @param remoteAssetId Asset ID on the remote chain
     * @return tokenAddress Address of the token on this chain
     */
    function findAssetByRemoteId(
        uint256 chainId,
        bytes32 remoteAssetId
    ) internal view returns (address) {
        for (uint256 i = 0; i < registeredAssets.length; i++) {
            address tokenAddress = registeredAssets[i];
            CrossChainAsset storage asset = assets[tokenAddress];
            
            if (asset.chainId == chainId && asset.remoteAssetId == remoteAssetId) {
                return tokenAddress;
            }
        }
        
        return address(0);
    }
    
    /**
     * @dev Request a reputation assessment for a provider
     * @param provider Address of the provider
     */
    function requestReputationAssessment(address provider) internal {
        // Get the provider
        LiquidityProvider storage providerData = providers[provider];
        
        // Request assessment from AI risk assessment contract
        if (address(riskAssessment) != address(0)) {
            riskAssessment.requestProviderAssessment(provider);
        }
    }
    
    /**
     * @dev Update provider reputation score (callback from AI)
     * @param provider Address of the provider
     * @param score New reputation score
     */
    function updateProviderReputation(
        address provider,
        uint256 score
    ) external {
        // Only the risk assessment contract can update reputation
        require(
            msg.sender == address(riskAssessment),
            "Only risk assessment"
        );
        require(score <= 100, "Score must be 0-100");
        
        // Update the provider's reputation
        providers[provider].reputationScore = score;
    }
    
    /**
     * @dev Emergency withdraw from a strategy
     * @param tokenAddress Address of the token
     * @param strategyIndex Index of the strategy to withdraw from
     */
    function emergencyWithdraw(
        address tokenAddress,
        uint256 strategyIndex
    ) external onlyOwner {
        require(assets[tokenAddress].isActive, "Asset not registered");
        require(strategyIndex < assets[tokenAddress].strategies.length, "Invalid strategy index");
        
        CrossChainAsset storage asset = assets[tokenAddress];
        YieldStrategy storage strategy = asset.strategies[strategyIndex];
        
        // Call the strategy controller to withdraw all funds
        (bool success,) = strategy.strategyController.call(
            abi.encodeWithSignature(
                "emergencyWithdraw(address)",
                tokenAddress
            )
        );
        
        if (success) {
            // Reset allocated liquidity
            asset.allocatedLiquidity = 0;
            asset.utilizationRate = 0;
        }
    }
    
    // View functions
    
    /**
     * @dev Get the number of registered assets
     * @return Number of assets
     */
    function getRegisteredAssetCount() external view returns (uint256) {
        return registeredAssets.length;
    }
    
    /**
     * @dev Get the number of strategies for an asset
     * @param tokenAddress Address of the token
     * @return Number of strategies
     */
    function getStrategyCount(address tokenAddress) external view returns (uint256) {
        return assets[tokenAddress].strategies.length;
    }
    
    /**
     * @dev Get liquidity provider details
     * @param provider Address of the provider
     * @param tokenAddress Address of the token
     * @return totalLiquidity Total liquidity provided
     * @return assetLiquidity Liquidity in the specific asset
     * @return assetShares Shares in the specific asset
     * @return reputationScore Reputation score
     */
    function getProviderDetails(
        address provider,
        address tokenAddress
    ) external view returns (
        uint256 totalLiquidity,
        uint256 assetLiquidity,
        uint256 assetShares,
        uint256 reputationScore
    ) {
        LiquidityProvider storage providerData = providers[provider];
        
        return (
            providerData.totalLiquidity,
            providerData.assetLiquidity[tokenAddress],
            providerData.assetShares[tokenAddress],
            providerData.reputationScore
        );
    }
    
    /**
     * @dev Get strategy details
     * @param tokenAddress Address of the token
     * @param strategyIndex Index of the strategy
     * @return name Strategy name
     * @return projectedAPY Projected APY
     * @return riskScore Risk score
     * @return minAmount Minimum amount
     * @return maxAmount Maximum amount
     * @return strategyController Controller address
     * @return isActive Whether the strategy is active
     */
    function getStrategyDetails(
        address tokenAddress,
        uint256 strategyIndex
    ) external view returns (
        string memory name,
        uint256 projectedAPY,
        uint256 riskScore,
        uint256 minAmount,
        uint256 maxAmount,
        address strategyController,
        bool isActive
    ) {
        require(assets[tokenAddress].isActive, "Asset not registered");
        require(strategyIndex < assets[tokenAddress].strategies.length, "Invalid strategy index");
        
        YieldStrategy storage strategy = assets[tokenAddress].strategies[strategyIndex];
        
        return (
            strategy.name,
            strategy.projectedAPY,
            strategy.riskScore,
            strategy.minAmount,
            strategy.maxAmount,
            strategy.strategyController,
            strategy.isActive
        );
    }
    
    /**
     * @dev Get asset details
     * @param tokenAddress Address of the token
     * @return totalLiquidity Total liquidity
     * @return allocatedLiquidity Allocated liquidity
     * @return utilizationRate Utilization rate
     * @return currentStrategyIndex Current strategy index
     */
    function getAssetDetails(
        address tokenAddress
    ) external view returns (
        uint256 totalLiquidity,
        uint256 allocatedLiquidity,
        uint256 utilizationRate,
        uint256 currentStrategyIndex
    ) {
        CrossChainAsset storage asset = assets[tokenAddress];
        
        return (
            asset.totalLiquidity,
            asset.allocatedLiquidity,
            asset.utilizationRate,
            asset.currentStrategyIndex
        );
    }
    
    /**
     * @dev Get market conditions
     * @return Volatility, trend, and system risk
     */
    function getMarketConditions() external view returns (
        uint256 volatility,
        int256 trend,
        uint256 systemRisk
    ) {
        return (
            marketVolatility,
            int256(marketTrend),
            systemRiskLevel
        );
    }
    
    /**
     * @dev Get the number of rebalance history entries
     * @return Number of entries
     */
    function getRebalanceHistoryCount() external view returns (uint256) {
        return rebalanceHistory.length;
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
 * @dev Interface for the AI Risk Assessment
 */
interface IAIRiskAssessment {
    function requestProviderAssessment(address provider) external;
}

/**
 * @dev Interface for the Lending Pool
 */
interface ILendingPool {
    function updateRiskScore(address user, uint256 score) external;
}
