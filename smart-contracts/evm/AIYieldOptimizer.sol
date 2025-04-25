// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title AIYieldOptimizer
 * @dev Advanced yield optimization strategy using AI to allocate funds across DeFi protocols
 */
contract AIYieldOptimizer is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Reference to strategy controller
    address public strategyController;
    
    // Strategy state
    enum OptimizationMode {
        Aggressive,     // Higher risk, higher reward
        Balanced,       // Moderate risk, moderate reward
        Conservative,   // Lower risk, lower reward
        Risk_Averse     // Minimal risk, lower reward
    }
    
    // AI-driven yield strategy
    struct YieldStrategy {
        string name;
        string[] protocolIds;
        uint256[] allocationPercentages; // Scaled by 100 (e.g. 5000 = 50%)
        uint256 projectedAPY;
        OptimizationMode risk;
        uint256 lastUpdated;
        address[] targetContracts;
        bytes4[] targetSelectors; // Function selectors for each protocol interaction
        bool active;
    }
    
    // Token allocations
    struct TokenAllocation {
        string tokenSymbol;
        uint256 totalAllocated;
        uint256 totalWithdrawn;
        uint256 totalProfit;
        uint256 lastBalance;
        bool isActive;
        mapping(string => uint256) protocolAllocations; // protocolId -> amount
    }
    
    // Protocol performance tracking
    struct ProtocolPerformance {
        string protocolId;
        uint256 historicalAPY;
        uint256 currentAPY;
        uint256 riskScore; // 0-100
        uint256 totalAllocated;
        uint256 totalProfit;
        uint256 volatility; // Standard deviation of returns, scaled by 100
        bool isActive;
    }
    
    // AI predictor configuration
    struct AIPredictor {
        uint256 lastUpdated;
        address oracleAddress;
        uint256 confidenceScore; // 0-100
        uint256 predictionHorizon; // in seconds
        bool useOnChainModel;
    }
    
    // Market condition tracking
    struct MarketCondition {
        uint256 volatilityIndex; // 0-100
        uint256 trendDirection; // 0 = down, 100 = up
        uint256 liquidityScore; // 0-100
        uint256 lastUpdated;
    }
    
    // Protocol registry
    mapping(string => address) public protocols;
    
    // Strategies by ID
    mapping(string => YieldStrategy) public strategies;
    string[] public strategyIds;
    
    // Token allocations
    mapping(string => TokenAllocation) public allocations;
    string[] public supportedTokens;
    
    // Protocol performance tracking
    mapping(string => ProtocolPerformance) public protocolPerformance;
    string[] public supportedProtocols;
    
    // AI predictor configuration
    AIPredictor public aiPredictor;
    
    // Market condition
    MarketCondition public marketCondition;
    
    // User tracking
    mapping(address => bool) public authorizedUsers;
    
    // Events
    event StrategyDeployed(string strategyId, string[] protocols, uint256[] allocations);
    event StrategyUpdated(string strategyId, string[] protocols, uint256[] allocations);
    event FundsAllocated(string token, string strategyId, uint256 amount);
    event ReturnsHarvested(string token, string[] protocols, uint256[] amounts, uint256 totalProfit);
    event AIModelUpdated(uint256 timestamp, uint256 confidenceScore);
    event ProtocolAdded(string protocolId, address contractAddress);
    event ProtocolRemoved(string protocolId);
    event UserAuthorized(address user, bool status);
    
    // Error codes
    error InvalidParameters();
    error ProtocolNotSupported(string protocolId);
    error TokenNotSupported(string token);
    error StrategyNotFound(string strategyId);
    error InsufficientFunds(uint256 requested, uint256 available);
    error AllocationMismatch();
    error Unauthorized(address caller);
    error FailedExecution(string protocol, string reason);

    /**
     * @dev Constructor
     * @param _strategyController Address of the strategy controller
     */
    constructor(address _strategyController) {
        strategyController = _strategyController;
        
        // Initialize AI predictor
        aiPredictor = AIPredictor({
            lastUpdated: block.timestamp,
            oracleAddress: address(0),
            confidenceScore: 70,
            predictionHorizon: 7 days,
            useOnChainModel: true
        });
        
        // Initialize market condition
        marketCondition = MarketCondition({
            volatilityIndex: 50,
            trendDirection: 50,
            liquidityScore: 80,
            lastUpdated: block.timestamp
        });
        
        // Authorize the deployer
        authorizedUsers[msg.sender] = true;
    }
    
    /**
     * @dev Modifier to restrict access to authorized users
     */
    modifier onlyAuthorized() {
        if (!authorizedUsers[msg.sender] && msg.sender != owner() && msg.sender != strategyController) {
            revert Unauthorized(msg.sender);
        }
        _;
    }
    
    /**
     * @dev Add a supported protocol
     * @param protocolId Unique identifier for the protocol
     * @param contractAddress Contract address for the protocol
     * @param apy Current APY for the protocol (scaled by 100)
     * @param riskScore Risk score for the protocol (0-100)
     */
    function addProtocol(
        string calldata protocolId,
        address contractAddress,
        uint256 apy,
        uint256 riskScore
    ) 
        external 
        onlyOwner 
    {
        if (bytes(protocolId).length == 0 || contractAddress == address(0)) {
            revert InvalidParameters();
        }
        
        // Add protocol to mapping
        protocols[protocolId] = contractAddress;
        
        // Initialize protocol performance
        protocolPerformance[protocolId] = ProtocolPerformance({
            protocolId: protocolId,
            historicalAPY: apy,
            currentAPY: apy,
            riskScore: riskScore,
            totalAllocated: 0,
            totalProfit: 0,
            volatility: 20, // Default volatility
            isActive: true
        });
        
        // Add to supported protocols if new
        bool found = false;
        for (uint256 i = 0; i < supportedProtocols.length; i++) {
            if (keccak256(bytes(supportedProtocols[i])) == keccak256(bytes(protocolId))) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            supportedProtocols.push(protocolId);
        }
        
        emit ProtocolAdded(protocolId, contractAddress);
    }
    
    /**
     * @dev Remove a protocol
     * @param protocolId Unique identifier for the protocol
     */
    function removeProtocol(string calldata protocolId) external onlyOwner {
        if (bytes(protocolId).length == 0) {
            revert InvalidParameters();
        }
        
        // Mark protocol as inactive
        ProtocolPerformance storage performance = protocolPerformance[protocolId];
        require(performance.isActive, "Protocol already inactive");
        
        performance.isActive = false;
        
        // Remove from protocols mapping
        delete protocols[protocolId];
        
        emit ProtocolRemoved(protocolId);
    }
    
    /**
     * @dev Create a new AI-optimized yield strategy
     * @param strategyId Unique identifier for the strategy
     * @param name Strategy name
     * @param protocolIds Array of protocol IDs to use
     * @param allocations Initial allocation percentages (scaled by 100)
     * @param optimizationMode Risk/reward profile
     */
    function createStrategy(
        string calldata strategyId,
        string calldata name,
        string[] calldata protocolIds,
        uint256[] calldata allocations,
        OptimizationMode optimizationMode
    ) 
        external 
        onlyOwner 
    {
        // Validate parameters
        if (bytes(strategyId).length == 0 || 
            bytes(name).length == 0 || 
            protocolIds.length == 0 || 
            protocolIds.length != allocations.length) {
            revert InvalidParameters();
        }
        
        // Check if strategy already exists
        for (uint256 i = 0; i < strategyIds.length; i++) {
            if (keccak256(bytes(strategyIds[i])) == keccak256(bytes(strategyId))) {
                revert InvalidParameters();
            }
        }
        
        // Verify all protocols are supported and active
        for (uint256 i = 0; i < protocolIds.length; i++) {
            if (protocols[protocolIds[i]] == address(0) || 
                !protocolPerformance[protocolIds[i]].isActive) {
                revert ProtocolNotSupported(protocolIds[i]);
            }
        }
        
        // Verify allocation percentages add up to 10000 (100%)
        uint256 totalAllocation = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            totalAllocation += allocations[i];
        }
        
        if (totalAllocation != 10000) {
            revert InvalidParameters();
        }
        
        // Create target contracts and selectors arrays
        address[] memory targetContracts = new address[](protocolIds.length);
        bytes4[] memory targetSelectors = new bytes4[](protocolIds.length);
        
        for (uint256 i = 0; i < protocolIds.length; i++) {
            targetContracts[i] = protocols[protocolIds[i]];
            
            // Determine appropriate function selector based on protocol
            if (keccak256(bytes(protocolIds[i])) == keccak256(bytes("compound"))) {
                targetSelectors[i] = bytes4(keccak256("supply(address,uint256)"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes("aave"))) {
                targetSelectors[i] = bytes4(keccak256("deposit(address,uint256,address,uint16)"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes("lido"))) {
                targetSelectors[i] = bytes4(keccak256("submit(address)"));
            } else {
                // Default for other protocols
                targetSelectors[i] = bytes4(keccak256("deposit(uint256)"));
            }
        }
        
        // Calculate projected APY based on allocation and protocol APYs
        uint256 projectedAPY = 0;
        for (uint256 i = 0; i < protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[protocolIds[i]];
            projectedAPY += (performance.currentAPY * allocations[i]) / 10000;
        }
        
        // Create strategy
        strategies[strategyId] = YieldStrategy({
            name: name,
            protocolIds: protocolIds,
            allocationPercentages: allocations,
            projectedAPY: projectedAPY,
            risk: optimizationMode,
            lastUpdated: block.timestamp,
            targetContracts: targetContracts,
            targetSelectors: targetSelectors,
            active: true
        });
        
        strategyIds.push(strategyId);
        
        emit StrategyDeployed(strategyId, protocolIds, allocations);
    }
    
    /**
     * @dev Update AI optimization model with current market conditions
     * @param confidenceScore New confidence score (0-100)
     * @param volatilityIndex Market volatility index (0-100)
     * @param trendDirection Price trend direction (0-100)
     * @param liquidityScore Market liquidity score (0-100)
     */
    function updateAIModel(
        uint256 confidenceScore,
        uint256 volatilityIndex,
        uint256 trendDirection,
        uint256 liquidityScore
    ) 
        external 
        onlyAuthorized 
    {
        // Validate parameters
        if (confidenceScore > 100 || 
            volatilityIndex > 100 || 
            trendDirection > 100 || 
            liquidityScore > 100) {
            revert InvalidParameters();
        }
        
        // Update AI predictor
        aiPredictor.lastUpdated = block.timestamp;
        aiPredictor.confidenceScore = confidenceScore;
        
        // Update market condition
        marketCondition.volatilityIndex = volatilityIndex;
        marketCondition.trendDirection = trendDirection;
        marketCondition.liquidityScore = liquidityScore;
        marketCondition.lastUpdated = block.timestamp;
        
        emit AIModelUpdated(block.timestamp, confidenceScore);
    }
    
    /**
     * @dev Optimize allocations for a strategy based on current conditions
     * @param strategyId Strategy to optimize
     * @return newAllocations New allocation percentages
     */
    function optimizeAllocations(string calldata strategyId) 
        external 
        onlyAuthorized 
        returns (uint256[] memory newAllocations) 
    {
        YieldStrategy storage strategy = strategies[strategyId];
        if (bytes(strategy.name).length == 0) {
            revert StrategyNotFound(strategyId);
        }
        
        // Implement AI optimization logic
        newAllocations = _runAIOptimization(
            strategy.protocolIds,
            strategy.allocationPercentages,
            strategy.risk
        );
        
        // Update strategy
        strategy.allocationPercentages = newAllocations;
        strategy.lastUpdated = block.timestamp;
        
        // Recalculate projected APY
        uint256 projectedAPY = 0;
        for (uint256 i = 0; i < strategy.protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[strategy.protocolIds[i]];
            projectedAPY += (performance.currentAPY * newAllocations[i]) / 10000;
        }
        strategy.projectedAPY = projectedAPY;
        
        emit StrategyUpdated(strategyId, strategy.protocolIds, newAllocations);
        
        return newAllocations;
    }
    
    /**
     * @dev Execute a strategy for a token
     * @param token Token symbol
     * @param strategyId Strategy to execute
     * @param amount Amount to allocate
     */
    function executeStrategy(
        string calldata token,
        string calldata strategyId,
        uint256 amount
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyAuthorized 
    {
        // Validate parameters
        if (bytes(token).length == 0 || bytes(strategyId).length == 0 || amount == 0) {
            revert InvalidParameters();
        }
        
        // Check if strategy exists and is active
        YieldStrategy storage strategy = strategies[strategyId];
        if (bytes(strategy.name).length == 0 || !strategy.active) {
            revert StrategyNotFound(strategyId);
        }
        
        // Get token contract address (would be provided by the calling contract)
        address tokenAddress;
        if (keccak256(bytes(token)) == keccak256(bytes("IOTA"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes("MIOTA"))) {
            tokenAddress = 0x5555555555555555555555555555555555555555; // Placeholder
        } else {
            revert TokenNotSupported(token);
        }
        
        // Track allocation
        if (!allocations[token].isActive) {
            allocations[token].tokenSymbol = token;
            allocations[token].isActive = true;
            allocations[token].lastBalance = amount;
            
            // Add to supported tokens if new
            bool found = false;
            for (uint256 i = 0; i < supportedTokens.length; i++) {
                if (keccak256(bytes(supportedTokens[i])) == keccak256(bytes(token))) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                supportedTokens.push(token);
            }
        }
        
        // Update allocation tracking
        allocations[token].totalAllocated += amount;
        allocations[token].lastBalance += amount;
        
        // Distribute to protocols according to allocation percentages
        for (uint256 i = 0; i < strategy.protocolIds.length; i++) {
            string memory protocolId = strategy.protocolIds[i];
            uint256 allocationPercentage = strategy.allocationPercentages[i];
            uint256 protocolAmount = (amount * allocationPercentage) / 10000;
            
            if (protocolAmount > 0) {
                // Track allocation by protocol
                allocations[token].protocolAllocations[protocolId] += protocolAmount;
                protocolPerformance[protocolId].totalAllocated += protocolAmount;
                
                // Get protocol contract
                address protocolContract = protocols[protocolId];
                
                // Approve tokens for the protocol contract
                IERC20(tokenAddress).safeApprove(protocolContract, protocolAmount);
                
                // Execute deposit (would be customized for each protocol)
                (bool success, bytes memory result) = protocolContract.call(
                    abi.encodeWithSelector(strategy.targetSelectors[i], protocolAmount)
                );
                
                if (!success) {
                    // Extract reason from revert
                    string memory reason = "Unknown error";
                    if (result.length > 4) {
                        reason = _extractRevertReason(result);
                    }
                    
                    // Revert allocation tracking
                    allocations[token].protocolAllocations[protocolId] -= protocolAmount;
                    protocolPerformance[protocolId].totalAllocated -= protocolAmount;
                    allocations[token].totalAllocated -= protocolAmount;
                    allocations[token].lastBalance -= protocolAmount;
                    
                    // Revert approval
                    IERC20(tokenAddress).safeApprove(protocolContract, 0);
                    
                    revert FailedExecution(protocolId, reason);
                }
            }
        }
        
        emit FundsAllocated(token, strategyId, amount);
    }
    
    /**
     * @dev Harvest yields from protocols
     * @param token Token symbol to harvest yields for
     * @return totalHarvested Total amount harvested
     */
    function harvestYields(string calldata token) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyAuthorized 
        returns (uint256 totalHarvested) 
    {
        // Validate parameters
        if (bytes(token).length == 0 || !allocations[token].isActive) {
            revert TokenNotSupported(token);
        }
        
        // Get token address (would be provided by calling contract)
        address tokenAddress;
        if (keccak256(bytes(token)) == keccak256(bytes("IOTA"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes("MIOTA"))) {
            tokenAddress = 0x5555555555555555555555555555555555555555; // Placeholder
        } else {
            revert TokenNotSupported(token);
        }
        
        // Prepare arrays for tracking harvested amounts
        string[] memory harvestedProtocols = new string[](supportedProtocols.length);
        uint256[] memory harvestedAmounts = new uint256[](supportedProtocols.length);
        uint256 harvestedCount = 0;
        
        // Harvest from each protocol that has allocation
        for (uint256 i = 0; i < supportedProtocols.length; i++) {
            string memory protocolId = supportedProtocols[i];
            uint256 allocated = allocations[token].protocolAllocations[protocolId];
            
            if (allocated > 0 && protocolPerformance[protocolId].isActive) {
                // Get protocol contract
                address protocolContract = protocols[protocolId];
                
                // Determine appropriate harvest function selector based on protocol
                bytes4 harvestSelector;
                if (keccak256(bytes(protocolId)) == keccak256(bytes("compound"))) {
                    harvestSelector = bytes4(keccak256("claimComp(address)"));
                } else if (keccak256(bytes(protocolId)) == keccak256(bytes("aave"))) {
                    harvestSelector = bytes4(keccak256("claimRewards(address[],uint256,address)"));
                } else {
                    // Default for other protocols
                    harvestSelector = bytes4(keccak256("getReward()"));
                }
                
                // Execute harvest
                (bool success, ) = protocolContract.call(
                    abi.encodeWithSelector(harvestSelector)
                );
                
                if (success) {
                    // Check token balance increase
                    uint256 currentBalance = IERC20(tokenAddress).balanceOf(address(this));
                    if (currentBalance > allocations[token].lastBalance) {
                        uint256 harvestedAmount = currentBalance - allocations[token].lastBalance;
                        
                        // Record harvested amount
                        harvestedProtocols[harvestedCount] = protocolId;
                        harvestedAmounts[harvestedCount] = harvestedAmount;
                        harvestedCount++;
                        
                        // Update protocol performance
                        protocolPerformance[protocolId].totalProfit += harvestedAmount;
                        
                        // Update total
                        totalHarvested += harvestedAmount;
                        allocations[token].lastBalance = currentBalance;
                        allocations[token].totalProfit += harvestedAmount;
                    }
                }
            }
        }
        
        // If any yields were harvested, transfer to strategy controller
        if (totalHarvested > 0) {
            // Prepare final arrays of correct size
            string[] memory finalProtocols = new string[](harvestedCount);
            uint256[] memory finalAmounts = new uint256[](harvestedCount);
            
            for (uint256 i = 0; i < harvestedCount; i++) {
                finalProtocols[i] = harvestedProtocols[i];
                finalAmounts[i] = harvestedAmounts[i];
            }
            
            // Transfer harvested amount to strategy controller
            IERC20(tokenAddress).safeTransfer(strategyController, totalHarvested);
            
            // Emit event
            emit ReturnsHarvested(token, finalProtocols, finalAmounts, totalHarvested);
        }
        
        return totalHarvested;
    }
    
    /**
     * @dev Withdraw all funds from a specific protocol (emergency function)
     * @param token Token symbol
     * @param protocolId Protocol to withdraw from
     * @return amountWithdrawn Amount withdrawn
     */
    function emergencyWithdraw(string calldata token, string calldata protocolId) 
        external 
        nonReentrant 
        onlyOwner 
        returns (uint256 amountWithdrawn) 
    {
        // Validate parameters
        if (bytes(token).length == 0 || !allocations[token].isActive) {
            revert TokenNotSupported(token);
        }
        
        if (bytes(protocolId).length == 0 || !protocolPerformance[protocolId].isActive) {
            revert ProtocolNotSupported(protocolId);
        }
        
        // Get allocation for this protocol
        uint256 allocated = allocations[token].protocolAllocations[protocolId];
        if (allocated == 0) {
            return 0;
        }
        
        // Get token address and protocol contract
        address tokenAddress;
        if (keccak256(bytes(token)) == keccak256(bytes("IOTA"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes("MIOTA"))) {
            tokenAddress = 0x5555555555555555555555555555555555555555; // Placeholder
        } else {
            revert TokenNotSupported(token);
        }
        
        address protocolContract = protocols[protocolId];
        
        // Determine appropriate withdraw function selector based on protocol
        bytes4 withdrawSelector;
        if (keccak256(bytes(protocolId)) == keccak256(bytes("compound"))) {
            withdrawSelector = bytes4(keccak256("redeem(uint256)"));
        } else if (keccak256(bytes(protocolId)) == keccak256(bytes("aave"))) {
            withdrawSelector = bytes4(keccak256("withdraw(address,uint256,address)"));
        } else {
            // Default for other protocols
            withdrawSelector = bytes4(keccak256("withdraw(uint256)"));
        }
        
        // Get balance before withdrawal
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        
        // Execute withdrawal
        (bool success, ) = protocolContract.call(
            abi.encodeWithSelector(withdrawSelector, allocated)
        );
        
        if (success) {
            // Check token balance increase
            uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
            amountWithdrawn = balanceAfter - balanceBefore;
            
            // Update allocation tracking
            allocations[token].protocolAllocations[protocolId] = 0;
            allocations[token].totalWithdrawn += amountWithdrawn;
            protocolPerformance[protocolId].totalAllocated -= allocated;
            
            // Transfer withdrawn amount to strategy controller
            IERC20(tokenAddress).safeTransfer(strategyController, amountWithdrawn);
        }
        
        return amountWithdrawn;
    }
    
    /**
     * @dev Authorize a user to call restricted functions
     * @param user User address
     * @param status Authorization status
     */
    function setUserAuthorization(address user, bool status) external onlyOwner {
        authorizedUsers[user] = status;
        emit UserAuthorized(user, status);
    }
    
    /**
     * @dev Set strategy controller address
     * @param _strategyController New strategy controller address
     */
    function setStrategyController(address _strategyController) external onlyOwner {
        require(_strategyController != address(0), "Invalid address");
        strategyController = _strategyController;
    }
    
    /**
     * @dev Pause the optimizer
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the optimizer
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get protocol performance metrics
     * @param protocolId Protocol ID
     * @return performance Protocol performance metrics
     */
    function getProtocolPerformance(string calldata protocolId) 
        external 
        view 
        returns (
            uint256 historicalAPY,
            uint256 currentAPY,
            uint256 riskScore,
            uint256 totalAllocated,
            uint256 totalProfit,
            uint256 volatility,
            bool isActive
        ) 
    {
        ProtocolPerformance memory performance = protocolPerformance[protocolId];
        
        return (
            performance.historicalAPY,
            performance.currentAPY,
            performance.riskScore,
            performance.totalAllocated,
            performance.totalProfit,
            performance.volatility,
            performance.isActive
        );
    }
    
    /**
     * @dev Get strategy details
     * @param strategyId Strategy ID
     * @return strategy Strategy details
     */
    function getStrategy(string calldata strategyId) 
        external 
        view 
        returns (
            string memory name,
            string[] memory protocolIds,
            uint256[] memory allocationPercentages,
            uint256 projectedAPY,
            OptimizationMode risk,
            uint256 lastUpdated,
            bool active
        ) 
    {
        YieldStrategy storage strategy = strategies[strategyId];
        
        return (
            strategy.name,
            strategy.protocolIds,
            strategy.allocationPercentages,
            strategy.projectedAPY,
            strategy.risk,
            strategy.lastUpdated,
            strategy.active
        );
    }
    
    /**
     * @dev Get token allocation details
     * @param token Token symbol
     * @return totalAllocated Total amount allocated
     * @return totalWithdrawn Total amount withdrawn
     * @return totalProfit Total profit generated
     * @return isActive Whether the token is active
     */
    function getTokenAllocation(string calldata token) 
        external 
        view 
        returns (
            uint256 totalAllocated,
            uint256 totalWithdrawn,
            uint256 totalProfit,
            bool isActive
        ) 
    {
        TokenAllocation storage allocation = allocations[token];
        
        return (
            allocation.totalAllocated,
            allocation.totalWithdrawn,
            allocation.totalProfit,
            allocation.isActive
        );
    }
    
    /**
     * @dev Get all supported tokens
     * @return tokens Array of supported token symbols
     */
    function getSupportedTokens() external view returns (string[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev Get all supported protocols
     * @return protocols Array of supported protocol IDs
     */
    function getSupportedProtocols() external view returns (string[] memory) {
        return supportedProtocols;
    }
    
    /**
     * @dev Get all strategy IDs
     * @return strategies Array of strategy IDs
     */
    function getStrategyIds() external view returns (string[] memory) {
        return strategyIds;
    }
    
    /**
     * @dev Run AI optimization algorithm to reallocate funds
     * @param protocolIds Array of protocol IDs
     * @param currentAllocations Current allocation percentages
     * @param mode Optimization mode
     * @return newAllocations New allocation percentages
     */
    function _runAIOptimization(
        string[] memory protocolIds,
        uint256[] memory currentAllocations,
        OptimizationMode mode
    ) 
        internal 
        view 
        returns (uint256[] memory newAllocations) 
    {
        // Initialize result array
        newAllocations = new uint256[](protocolIds.length);
        
        // Get market conditions
        uint256 volatility = marketCondition.volatilityIndex;
        uint256 trend = marketCondition.trendDirection;
        uint256 liquidity = marketCondition.liquidityScore;
        
        // Get AI confidence
        uint256 confidence = aiPredictor.confidenceScore;
        
        // Parameters for different optimization modes
        uint256 riskTolerance;
        uint256 maxAllocationPerProtocol;
        uint256 minAllocationPerProtocol;
        
        if (mode == OptimizationMode.Aggressive) {
            riskTolerance = 80;
            maxAllocationPerProtocol = 5000; // Up to 50% in one protocol
            minAllocationPerProtocol = 500;  // At least 5% in each protocol
        } else if (mode == OptimizationMode.Balanced) {
            riskTolerance = 50;
            maxAllocationPerProtocol = 3500; // Up to 35% in one protocol
            minAllocationPerProtocol = 1000; // At least 10% in each protocol
        } else if (mode == OptimizationMode.Conservative) {
            riskTolerance = 30;
            maxAllocationPerProtocol = 2500; // Up to 25% in one protocol
            minAllocationPerProtocol = 1500; // At least 15% in each protocol
        } else { // Risk_Averse
            riskTolerance = 10;
            maxAllocationPerProtocol = 2000; // Up to 20% in one protocol
            minAllocationPerProtocol = 2000; // At least 20% in each protocol
        }
        
        // First pass: Adjust allocations based on protocol performance and risk
        uint256 totalScore = 0;
        uint256[] memory scores = new uint256[](protocolIds.length);
        
        for (uint256 i = 0; i < protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[protocolIds[i]];
            
            // Calculate score based on APY, risk score, and market conditions
            uint256 apyScore = performance.currentAPY;
            uint256 riskAdjustment = 100 - performance.riskScore;
            
            // Adjust for market conditions
            uint256 volatilityFactor = 100;
            if (performance.volatility > volatility) {
                // Protocol more volatile than market
                volatilityFactor = 100 - (performance.volatility - volatility) / 2;
            }
            
            // Trend adjustment - favor up trend for aggressive, down trend for conservative
            uint256 trendFactor = 100;
            if (mode == OptimizationMode.Aggressive || mode == OptimizationMode.Balanced) {
                trendFactor = 80 + trend / 5; // 80-100
            } else {
                trendFactor = 120 - trend / 5; // 100-120
            }
            
            // Calculate combined score
            uint256 score = apyScore * riskAdjustment * volatilityFactor * trendFactor / 1000000;
            
            // Apply confidence factor - lower confidence means stay closer to current allocation
            if (confidence < 80) {
                uint256 inertiaFactor = 80 - confidence; // 0-30
                score = (score * (100 - inertiaFactor) + currentAllocations[i] * inertiaFactor) / 100;
            }
            
            scores[i] = score;
            totalScore += score;
        }
        
        // Second pass: Calculate new allocations based on scores
        uint256 totalAllocation = 0;
        
        if (totalScore > 0) {
            for (uint256 i = 0; i < protocolIds.length; i++) {
                // Raw allocation based on score proportion
                uint256 rawAllocation = scores[i] * 10000 / totalScore;
                
                // Apply constraints
                if (rawAllocation < minAllocationPerProtocol) {
                    newAllocations[i] = minAllocationPerProtocol;
                } else if (rawAllocation > maxAllocationPerProtocol) {
                    newAllocations[i] = maxAllocationPerProtocol;
                } else {
                    newAllocations[i] = rawAllocation;
                }
                
                totalAllocation += newAllocations[i];
            }
        }
        
        // Final pass: Normalize to ensure total is exactly 10000 (100%)
        if (totalAllocation != 10000) {
            // Find the protocol with the highest score to adjust
            uint256 highestScoreIndex = 0;
            for (uint256 i = 1; i < protocolIds.length; i++) {
                if (scores[i] > scores[highestScoreIndex]) {
                    highestScoreIndex = i;
                }
            }
            
            // Adjust the highest score protocol to make total exactly 10000
            if (totalAllocation < 10000) {
                newAllocations[highestScoreIndex] += (10000 - totalAllocation);
            } else {
                // Ensure we don't go below minimum
                uint256 excess = totalAllocation - 10000;
                if (newAllocations[highestScoreIndex] - excess >= minAllocationPerProtocol) {
                    newAllocations[highestScoreIndex] -= excess;
                } else {
                    // Distribute the reduction across all protocols proportionally
                    for (uint256 i = 0; i < protocolIds.length; i++) {
                        uint256 reduction = excess * newAllocations[i] / totalAllocation;
                        if (newAllocations[i] - reduction >= minAllocationPerProtocol) {
                            newAllocations[i] -= reduction;
                            excess -= reduction;
                        }
                    }
                    
                    // If there's still excess, take from the highest allocation
                    if (excess > 0) {
                        uint256 highestAllocationIndex = 0;
                        for (uint256 i = 1; i < protocolIds.length; i++) {
                            if (newAllocations[i] > newAllocations[highestAllocationIndex]) {
                                highestAllocationIndex = i;
                            }
                        }
                        newAllocations[highestAllocationIndex] -= excess;
                    }
                }
            }
        }
        
        return newAllocations;
    }
    
    /**
     * @dev Extract revert reason from a failed call
     * @param data Error data
     * @return reason Revert reason string
     */
    function _extractRevertReason(bytes memory data) internal pure returns (string memory) {
        // If the data length is less than 68 bytes, it's not a standard error message
        if (data.length < 68) {
            return "Unknown error";
        }
        
        // Extract the reason string
        bytes memory revertData = new bytes(data.length - 4);
        for (uint256 i = 4; i < data.length; i++) {
            revertData[i - 4] = data[i];
        }
        
        // Convert to a string
        (string memory reason) = abi.decode(revertData, (string));
        return reason;
    }
}
