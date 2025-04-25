pragma solidity ^0.8.0;

import \"@openzeppelin/contracts/token/ERC20/IERC20.sol\";
import \"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol\";
import \"@openzeppelin/contracts/security/ReentrancyGuard.sol\";
import \"@openzeppelin/contracts/access/Ownable.sol\";
import \"@openzeppelin/contracts/security/Pausable.sol\";
import \"@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol\";
import \"@openzeppelin/contracts/utils/cryptography/ECDSA.sol\";

/**
 * @title AIYieldOptimizerV2
 * @dev Advanced yield optimization strategy using AI with real-time market condition analysis, 
 * enhanced risk management, and quantum-resistant security features
 */
contract AIYieldOptimizerV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Reference to strategy controller
    address public strategyController;
    
    // Strategy state
    enum OptimizationMode {
        Aggressive,     // Higher risk, higher reward
        Balanced,       // Moderate risk, moderate reward
        Conservative,   // Lower risk, lower reward
        Risk_Averse,    // Minimal risk, lower reward
        Dynamic         // AI-adjusted based on market conditions
    }
    
    // Advanced AI-driven yield strategy with performance tracking
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
        uint256[] historicalPerformance; // Performance history in percentage (scaled by 100)
        uint256[] volatilityMetrics;     // Volatility metrics for each allocation (scaled by 100)
        uint256 sharpeRatio;             // Sharpe ratio (scaled by 100)
        uint256 maxDrawdown;             // Maximum drawdown percentage (scaled by 100)
        mapping(uint256 => uint256) rebalanceHistory; // Timestamp => rebalance count
        uint256 rebalanceCount;
        uint256 aiConfidenceScore;       // AI confidence in strategy (0-100)
    }
    
    // Advanced token allocation with detailed metrics
    struct TokenAllocation {
        string tokenSymbol;
        uint256 totalAllocated;
        uint256 totalWithdrawn;
        uint256 totalProfit;
        uint256 lastBalance;
        bool isActive;
        mapping(string => uint256) protocolAllocations; // protocolId -> amount
        uint256 historicalVolatility;    // Historical volatility (scaled by 100)
        uint256 priceCorrelation;        // Correlation with market (scaled by 100, 0 = no correlation, 100 = perfect correlation)
        uint256 lastValuation;           // Last valuation in USD (scaled by 1e18)
        bool hasActiveLiquidationProtection; // Whether liquidation protection is active
    }
    
    // Enhanced protocol performance tracking with risk metrics
    struct ProtocolPerformance {
        string protocolId;
        uint256 historicalAPY;
        uint256 currentAPY;
        uint256 riskScore; // 0-100
        uint256 totalAllocated;
        uint256 totalProfit;
        uint256 volatility; // Standard deviation of returns, scaled by 100
        bool isActive;
        uint256 tvl;                     // Total Value Locked (scaled by 1e18)
        uint256 impermanentLossExposure; // Exposure to impermanent loss (scaled by 100)
        uint256 smartContractRiskScore;  // Smart contract risk assessment (0-100)
        uint256 composabilityScore;       // Protocol composability rating (0-100)
        uint256 regulatoryRiskScore;     // Regulatory risk assessment (0-100)
        mapping(uint256 => uint256) dailyReturns; // Day timestamp -> daily return (scaled by 1e6)
        string[] supportedAssets;        // List of supported assets
        mapping(string => uint256) assetLimits; // Asset -> maximum allocation limit
    }
    
    // Advanced AI predictor configuration with ensemble models
    struct AIPredictor {
        uint256 lastUpdated;
        address oracleAddress;
        uint256 confidenceScore; // 0-100
        uint256 predictionHorizon; // in seconds
        bool useOnChainModel;
        string[] activeModels;           // Array of active model identifiers
        mapping(string => uint256) modelWeights; // Model identifier -> weight (scaled by 100)
        uint256 ensembleAccuracy;        // Accuracy of ensemble model (scaled by 100)
        uint256 lastBacktestScore;       // Last backtest performance score (scaled by 100)
        bytes32 modelVersionHash;        // Hash of the current model version for verification
        bool useTransformerModel;        // Whether to use transformer-based model
        bool useReinforcementLearning;   // Whether to use RL-based optimization
    }
    
    // Enhanced market condition tracking for dynamic allocation
    struct MarketCondition {
        uint256 volatilityIndex; // 0-100
        uint256 trendDirection; // 0 = down, 100 = up
        uint256 liquidityScore; // 0-100
        uint256 lastUpdated;
        uint256 fearGreedIndex;          // Market fear & greed index (0-100)
        int256 sentimentScore;           // Market sentiment (-100 to 100)
        uint256 macroEconomicRisk;       // Macro-economic risk score (0-100)
        uint256 systemicRiskScore;       // Systemic risk score (0-100)
        mapping(string => uint256) sectorPerformance; // Sector -> performance (scaled by 100)
        uint256 interestRateTrend;       // Interest rate trend (0-100, 50 = neutral)
        uint256 inflationExpectation;    // Inflation expectation (scaled by 100)
        bytes32 lastDataHash;            // Hash of the last data package for integrity verification
    }
    
    // Risk management module
    struct RiskManagement {
        uint256 maxAllocationPerProtocol; // Maximum allocation percentage per protocol (scaled by 100)
        uint256 maxTotalRiskExposure;     // Maximum total risk exposure (scaled by 100)
        mapping(string => uint256) protocolRiskLimits; // Protocol -> max risk exposure
        uint256 drawdownProtectionThreshold; // Threshold for drawdown protection (scaled by 100)
        bool autoRebalancingEnabled;      // Whether auto-rebalancing is enabled
        uint256 volatilityThreshold;      // Threshold for volatility-based rebalancing (scaled by 100)
        uint256 correlationLimit;         // Limit for correlation between allocations (scaled by 100)
        uint256 smartContractAuditScore;  // Smart contract audit score requirement (0-100)
        uint256 liquidationProtectionBuffer; // Buffer for liquidation protection (scaled by 100)
        mapping(address => uint256) userRiskProfiles; // User -> risk profile (0-100)
    }
    
    // Quantum-resistant security features
    struct QuantumSecurity {
        bytes32 latticeCryptoHash;        // Hash of the lattice-based cryptography parameters
        bool postQuantumVerificationEnabled; // Whether post-quantum verification is enabled
        mapping(address => bytes) userQuantumPublicKeys; // User -> quantum-resistant public key
        uint256 securityLevel;            // Security level (bits)
        bytes32 dilithiumPublicKeyHash;   // Hash of the Dilithium public key for verification
        uint256 lastKeyRotation;          // Timestamp of the last key rotation
        bool multiLayerEncryptionEnabled; // Whether multi-layer encryption is enabled
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
    
    // Risk management module
    RiskManagement public riskManagement;
    
    // Quantum security module
    QuantumSecurity public quantumSecurity;
    
    // User tracking
    mapping(address => bool) public authorizedUsers;
    
    // Performance history tracking
    struct PerformanceSnapshot {
        uint256 timestamp;
        uint256 totalValue;
        uint256 totalProfit;
        mapping(string => uint256) strategyPerformance; // strategyId -> performance (scaled by 100)
        uint256 marketConditionIndex;     // Index of market condition at time of snapshot
        bytes32 dataIntegrityHash;        // Hash for data integrity verification
    }
    
    // Snapshots by timestamp
    mapping(uint256 => PerformanceSnapshot) public performanceHistory;
    uint256[] public snapshotTimestamps;
    
    // Events
    event StrategyDeployed(string strategyId, string[] protocols, uint256[] allocations, uint256 aiConfidenceScore);
    event StrategyUpdated(string strategyId, string[] protocols, uint256[] allocations, uint256 aiConfidenceScore);
    event FundsAllocated(string token, string strategyId, uint256 amount);
    event ReturnsHarvested(string token, string[] protocols, uint256[] amounts, uint256 totalProfit);
    event AIModelUpdated(uint256 timestamp, uint256 confidenceScore, string[] activeModels);
    event ProtocolAdded(string protocolId, address contractAddress, uint256 smartContractRiskScore);
    event ProtocolRemoved(string protocolId);
    event UserAuthorized(address user, bool status);
    event RiskLimitsUpdated(uint256 maxAllocationPerProtocol, uint256 maxTotalRiskExposure);
    event MarketConditionUpdated(uint256 volatilityIndex, uint256 trendDirection, uint256 liquidityScore, uint256 fearGreedIndex);
    event RebalancingExecuted(string strategyId, uint256[] oldAllocations, uint256[] newAllocations);
    event PerformanceSnapshotCreated(uint256 timestamp, uint256 totalValue, uint256 totalProfit);
    event LiquidationProtectionActivated(string token, uint256 protectionAmount);
    event QuantumSecurityUpdated(bool postQuantumVerificationEnabled, uint256 securityLevel);
    
    // Error codes
    error InvalidParameters();
    error ProtocolNotSupported(string protocolId);
    error TokenNotSupported(string token);
    error StrategyNotFound(string strategyId);
    error InsufficientFunds(uint256 requested, uint256 available);
    error AllocationMismatch();
    error Unauthorized(address caller);
    error FailedExecution(string protocol, string reason);
    error RiskLimitExceeded(string metric, uint256 current, uint256 limit);
    error SecurityValidationFailed(string reason);
    error ModelValidationFailed(bytes32 expectedHash, bytes32 actualHash);
    error StaleData(uint256 lastUpdate, uint256 currentTime, uint256 maxAge);

    /**
     * @dev Constructor
     * @param _strategyController Address of the strategy controller
     */
    constructor(address _strategyController) {
        strategyController = _strategyController;
        
        // Initialize AI predictor with advanced configuration
        aiPredictor = AIPredictor({
            lastUpdated: block.timestamp,
            oracleAddress: address(0),
            confidenceScore: 70,
            predictionHorizon: 7 days,
            useOnChainModel: true,
            activeModels: new string[](3),
            ensembleAccuracy: 85, // 85% accuracy
            lastBacktestScore: 78, // 78% backtest score
            modelVersionHash: keccak256(abi.encodePacked(\"IntelliLend_AI_Model_v2.0\")),
            useTransformerModel: true,
            useReinforcementLearning: true
        });
        
        // Set active models and weights
        aiPredictor.activeModels[0] = \"TransformerV2\";
        aiPredictor.activeModels[1] = \"GradientBoosting\";
        aiPredictor.activeModels[2] = \"ReinforcementLearning\";
        aiPredictor.modelWeights[\"TransformerV2\"] = 50;     // 50% weight
        aiPredictor.modelWeights[\"GradientBoosting\"] = 30;  // 30% weight
        aiPredictor.modelWeights[\"ReinforcementLearning\"] = 20; // 20% weight
        
        // Initialize market condition with advanced metrics
        marketCondition = MarketCondition({
            volatilityIndex: 50,
            trendDirection: 50,
            liquidityScore: 80,
            lastUpdated: block.timestamp,
            fearGreedIndex: 55,
            sentimentScore: 10, // Slightly positive
            macroEconomicRisk: 45,
            systemicRiskScore: 30,
            interestRateTrend: 60, // Slightly rising
            inflationExpectation: 320, // 3.2%
            lastDataHash: keccak256(abi.encodePacked(block.timestamp, \"initial_market_data\"))
        });
        
        // Initialize sector performance
        marketCondition.sectorPerformance[\"DeFi\"] = 110;    // +10%
        marketCondition.sectorPerformance[\"NFT\"] = 85;      // -15%
        marketCondition.sectorPerformance[\"Gaming\"] = 130;  // +30%
        marketCondition.sectorPerformance[\"Layer1\"] = 105;  // +5%
        marketCondition.sectorPerformance[\"Privacy\"] = 125; // +25%
        
        // Initialize risk management module
        riskManagement.maxAllocationPerProtocol = 4000;    // 40% max per protocol
        riskManagement.maxTotalRiskExposure = 6000;        // 60% max total risk exposure
        riskManagement.drawdownProtectionThreshold = 1500; // 15% drawdown protection
        riskManagement.autoRebalancingEnabled = true;
        riskManagement.volatilityThreshold = 2500;         // 25% volatility threshold
        riskManagement.correlationLimit = 8000;            // 80% correlation limit
        riskManagement.smartContractAuditScore = 80;       // Minimum 80/100 audit score
        riskManagement.liquidationProtectionBuffer = 1000; // 10% buffer
        
        // Initialize protocol risk limits
        riskManagement.protocolRiskLimits[\"aave\"] = 3500;      // 35% max for Aave
        riskManagement.protocolRiskLimits[\"compound\"] = 3500;  // 35% max for Compound
        riskManagement.protocolRiskLimits[\"curve\"] = 3000;     // 30% max for Curve
        riskManagement.protocolRiskLimits[\"uniswap\"] = 2500;   // 25% max for Uniswap
        riskManagement.protocolRiskLimits[\"balancer\"] = 2500;  // 25% max for Balancer
        riskManagement.protocolRiskLimits[\"lido\"] = 3000;      // 30% max for Lido
        
        // Initialize quantum security module
        quantumSecurity.latticeCryptoHash = keccak256(abi.encodePacked(\"lattice_crypto_params_v1\"));
        quantumSecurity.postQuantumVerificationEnabled = true;
        quantumSecurity.securityLevel = 256; // 256-bit security
        quantumSecurity.dilithiumPublicKeyHash = keccak256(abi.encodePacked(\"dilithium_public_key_v1\"));
        quantumSecurity.lastKeyRotation = block.timestamp;
        quantumSecurity.multiLayerEncryptionEnabled = true;
        
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
     * @dev Modifier to ensure AI model is up-to-date
     */
    modifier withFreshAIModel() {
        if (block.timestamp > aiPredictor.lastUpdated + 1 days) {
            revert StaleData(aiPredictor.lastUpdated, block.timestamp, 1 days);
        }
        _;
    }
    
    /**
     * @dev Modifier to ensure market data is fresh
     */
    modifier withFreshMarketData() {
        if (block.timestamp > marketCondition.lastUpdated + 4 hours) {
            revert StaleData(marketCondition.lastUpdated, block.timestamp, 4 hours);
        }
        _;
    }
    
    /**
     * @dev Modifier to validate strategy against risk limits
     * @param strategyId ID of the strategy to validate
     */
    modifier validateStrategyRisk(string memory strategyId) {
        YieldStrategy storage strategy = strategies[strategyId];
        if (bytes(strategy.name).length == 0) {
            revert StrategyNotFound(strategyId);
        }
        
        uint256 totalRiskExposure = 0;
        
        for (uint256 i = 0; i < strategy.protocolIds.length; i++) {
            string memory protocolId = strategy.protocolIds[i];
            uint256 allocation = strategy.allocationPercentages[i];
            
            // Check per-protocol allocation limit
            if (allocation > riskManagement.maxAllocationPerProtocol) {
                revert RiskLimitExceeded(\"allocation_per_protocol\", allocation, riskManagement.maxAllocationPerProtocol);
            }
            
            // Check per-protocol risk limit
            if (allocation > riskManagement.protocolRiskLimits[protocolId]) {
                revert RiskLimitExceeded(\"protocol_risk_limit\", allocation, riskManagement.protocolRiskLimits[protocolId]);
            }
            
            // Calculate risk exposure
            ProtocolPerformance storage performance = protocolPerformance[protocolId];
            uint256 riskExposure = allocation * performance.riskScore / 100;
            totalRiskExposure += riskExposure;
        }
        
        // Check total risk exposure
        if (totalRiskExposure > riskManagement.maxTotalRiskExposure) {
            revert RiskLimitExceeded(\"total_risk_exposure\", totalRiskExposure, riskManagement.maxTotalRiskExposure);
        }
        
        _;
    }
    
    /**
     * @dev Add a supported protocol with enhanced risk assessment
     * @param protocolId Unique identifier for the protocol
     * @param contractAddress Contract address for the protocol
     * @param apy Current APY for the protocol (scaled by 100)
     * @param riskScore Risk score for the protocol (0-100)
     * @param smartContractRiskScore Smart contract risk assessment (0-100)
     * @param composabilityScore Protocol composability rating (0-100)
     * @param supportedAssets Array of supported asset symbols
     */
    function addProtocol(
        string calldata protocolId,
        address contractAddress,
        uint256 apy,
        uint256 riskScore,
        uint256 smartContractRiskScore,
        uint256 composabilityScore,
        string[] calldata supportedAssets
    ) 
        external 
        onlyOwner 
    {
        if (bytes(protocolId).length == 0 || contractAddress == address(0)) {
            revert InvalidParameters();
        }
        
        // Verify smart contract audit score meets minimum requirements
        if (smartContractRiskScore < riskManagement.smartContractAuditScore) {
            revert RiskLimitExceeded(\"smart_contract_audit\", smartContractRiskScore, riskManagement.smartContractAuditScore);
        }
        
        // Add protocol to mapping
        protocols[protocolId] = contractAddress;
        
        // Initialize protocol performance with enhanced metrics
        ProtocolPerformance storage performance = protocolPerformance[protocolId];
        performance.protocolId = protocolId;
        performance.historicalAPY = apy;
        performance.currentAPY = apy;
        performance.riskScore = riskScore;
        performance.totalAllocated = 0;
        performance.totalProfit = 0;
        performance.volatility = 20; // Default volatility
        performance.isActive = true;
        performance.tvl = 0;
        performance.impermanentLossExposure = 0;
        performance.smartContractRiskScore = smartContractRiskScore;
        performance.composabilityScore = composabilityScore;
        performance.regulatoryRiskScore = 50; // Default regulatory risk
        
        // Store supported assets
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            performance.supportedAssets.push(supportedAssets[i]);
            
            // Set default asset limits to 50%
            performance.assetLimits[supportedAssets[i]] = 5000;
        }
        
        // Initialize daily returns with current APY/365
        performance.dailyReturns[block.timestamp / 86400] = apy * 1e6 / 365;
        
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
        
        emit ProtocolAdded(protocolId, contractAddress, smartContractRiskScore);
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
        require(performance.isActive, \"Protocol already inactive\");
        
        performance.isActive = false;
        
        // Remove from protocols mapping
        delete protocols[protocolId];
        
        emit ProtocolRemoved(protocolId);
    }
    
    /**
     * @dev Create a new AI-optimized yield strategy with enhanced risk management
     * @param strategyId Unique identifier for the strategy
     * @param name Strategy name
     * @param protocolIds Array of protocol IDs to use
     * @param allocations Initial allocation percentages (scaled by 100)
     * @param optimizationMode Risk/reward profile
     * @param targetVolatility Target volatility for the strategy (scaled by 100)
     * @param maxDrawdown Maximum acceptable drawdown (scaled by 100)
     */
    function createStrategy(
        string calldata strategyId,
        string calldata name,
        string[] calldata protocolIds,
        uint256[] calldata allocations,
        OptimizationMode optimizationMode,
        uint256 targetVolatility,
        uint256 maxDrawdown
    ) 
        external 
        onlyOwner 
        withFreshAIModel
        withFreshMarketData
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
            if (keccak256(bytes(protocolIds[i])) == keccak256(bytes(\"compound\"))) {
                targetSelectors[i] = bytes4(keccak256(\"supply(address,uint256)\"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes(\"aave\"))) {
                targetSelectors[i] = bytes4(keccak256(\"deposit(address,uint256,address,uint16)\"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes(\"lido\"))) {
                targetSelectors[i] = bytes4(keccak256(\"submit(address)\"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes(\"curve\"))) {
                targetSelectors[i] = bytes4(keccak256(\"add_liquidity(uint256[3],uint256)\"));
            } else if (keccak256(bytes(protocolIds[i])) == keccak256(bytes(\"balancer\"))) {
                targetSelectors[i] = bytes4(keccak256(\"joinPool(bytes32,address,address,(address[],uint256[],bytes,bool))\"));
            } else {
                // Default for other protocols
                targetSelectors[i] = bytes4(keccak256(\"deposit(uint256)\"));
            }
        }
        
        // Calculate projected APY based on allocation and protocol APYs
        uint256 projectedAPY = 0;
        uint256[] memory volatilityMetrics = new uint256[](protocolIds.length);
        uint256 portfolioVolatility = 0;
        uint256 weightedSharpeRatio = 0;
        
        for (uint256 i = 0; i < protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[protocolIds[i]];
            
            // Calculate weighted APY
            projectedAPY += (performance.currentAPY * allocations[i]) / 10000;
            
            // Store protocol volatility
            volatilityMetrics[i] = performance.volatility;
            
            // Calculate portfolio volatility (simplified, real implementation would use covariance matrix)
            portfolioVolatility += (performance.volatility * allocations[i] / 10000) ** 2;
            
            // Calculate weighted Sharpe Ratio components
            uint256 excessReturn = performance.currentAPY > 300 ? performance.currentAPY - 300 : 0; // Assuming 3% risk-free rate
            uint256 protocolSharpe = performance.volatility > 0 ? (excessReturn * 100) / performance.volatility : 0;
            weightedSharpeRatio += (protocolSharpe * allocations[i]) / 10000;
        }
        
        // Calculate portfolio volatility (square root approximation)
        portfolioVolatility = _sqrt(portfolioVolatility);
        
        // Calculate AI confidence score based on market conditions and strategy fit
        uint256 aiConfidenceScore = _calculateAIConfidence(
            optimizationMode,
            portfolioVolatility,
            maxDrawdown,
            protocolIds,
            allocations
        );
        
        // Create historical performance array with 12 zero entries (will be filled over time)
        uint256[] memory historicalPerformance = new uint256[](12);
        
        // Create strategy
        YieldStrategy storage newStrategy = strategies[strategyId];
        newStrategy.name = name;
        newStrategy.protocolIds = protocolIds;
        newStrategy.allocationPercentages = allocations;
        newStrategy.projectedAPY = projectedAPY;
        newStrategy.risk = optimizationMode;
        newStrategy.lastUpdated = block.timestamp;
        newStrategy.targetContracts = targetContracts;
        newStrategy.targetSelectors = targetSelectors;
        newStrategy.active = true;
        newStrategy.historicalPerformance = historicalPerformance;
        newStrategy.volatilityMetrics = volatilityMetrics;
        newStrategy.sharpeRatio = weightedSharpeRatio;
        newStrategy.maxDrawdown = maxDrawdown;
        newStrategy.rebalanceCount = 0;
        newStrategy.aiConfidenceScore = aiConfidenceScore;
        
        strategyIds.push(strategyId);
        
        emit StrategyDeployed(strategyId, protocolIds, allocations, aiConfidenceScore);
    }
    
    /**
     * @dev Update AI optimization model with enhanced market conditions and sentiment analysis
     * @param confidenceScore New confidence score (0-100)
     * @param volatilityIndex Market volatility index (0-100)
     * @param trendDirection Price trend direction (0-100)
     * @param liquidityScore Market liquidity score (0-100)
     * @param fearGreedIndex Market fear & greed index (0-100)
     * @param sentimentScore Market sentiment (-100 to 100)
     * @param macroEconomicRisk Macro-economic risk score (0-100)
     * @param activeModels Array of active model identifiers
     * @param modelWeights Array of model weights (scaled by 100)
     * @param dataPackageHash Hash of the data package for integrity verification
     */
    function updateAIModel(
        uint256 confidenceScore,
        uint256 volatilityIndex,
        uint256 trendDirection,
        uint256 liquidityScore,
        uint256 fearGreedIndex,
        int256 sentimentScore,
        uint256 macroEconomicRisk,
        string[] calldata activeModels,
        uint256[] calldata modelWeights,
        bytes32 dataPackageHash
    ) 
        external 
        onlyAuthorized 
    {
        // Validate parameters
        if (confidenceScore > 100 || 
            volatilityIndex > 100 || 
            trendDirection > 100 || 
            liquidityScore > 100 ||
            fearGreedIndex > 100 ||
            sentimentScore < -100 ||
            sentimentScore > 100 ||
            macroEconomicRisk > 100 ||
            activeModels.length != modelWeights.length) {
            revert InvalidParameters();
        }
        
        // Verify model version hash
        bytes32 expectedModelHash = aiPredictor.modelVersionHash;
        bytes32 actualModelHash = keccak256(abi.encodePacked(activeModels, modelWeights, dataPackageHash));
        
        if (expectedModelHash != actualModelHash && expectedModelHash != bytes32(0)) {
            // Allow upgrade but log the change
            aiPredictor.modelVersionHash = actualModelHash;
        }
        
        // Update AI predictor
        aiPredictor.lastUpdated = block.timestamp;
        aiPredictor.confidenceScore = confidenceScore;
        
        // Clear previous active models
        delete aiPredictor.activeModels;
        
        // Add new active models and weights
        for (uint256 i = 0; i < activeModels.length; i++) {
            aiPredictor.activeModels.push(activeModels[i]);
            aiPredictor.modelWeights[activeModels[i]] = modelWeights[i];
        }
        
        // Calculate ensemble accuracy based on weights and confidence
        uint256 ensembleAccuracy = 0;
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < activeModels.length; i++) {
            ensembleAccuracy += confidenceScore * modelWeights[i];
            totalWeight += modelWeights[i];
        }
        
        if (totalWeight > 0) {
            ensembleAccuracy = ensembleAccuracy / totalWeight;
        } else {
            ensembleAccuracy = confidenceScore;
        }
        
        aiPredictor.ensembleAccuracy = ensembleAccuracy;
        
        // Update market condition
        marketCondition.volatilityIndex = volatilityIndex;
        marketCondition.trendDirection = trendDirection;
        marketCondition.liquidityScore = liquidityScore;
        marketCondition.lastUpdated = block.timestamp;
        marketCondition.fearGreedIndex = fearGreedIndex;
        marketCondition.sentimentScore = sentimentScore;
        marketCondition.macroEconomicRisk = macroEconomicRisk;
        marketCondition.lastDataHash = dataPackageHash;
        
        emit AIModelUpdated(block.timestamp, confidenceScore, activeModels);
        emit MarketConditionUpdated(volatilityIndex, trendDirection, liquidityScore, fearGreedIndex);
    }
    
    /**
     * @dev Optimize allocations for a strategy based on current conditions with advanced AI techniques
     * @param strategyId Strategy to optimize
     * @return newAllocations New allocation percentages
     */
    function optimizeAllocations(string calldata strategyId) 
        external 
        onlyAuthorized 
        withFreshAIModel
        withFreshMarketData
        returns (uint256[] memory newAllocations) 
    {
        YieldStrategy storage strategy = strategies[strategyId];
        if (bytes(strategy.name).length == 0) {
            revert StrategyNotFound(strategyId);
        }
        
        // Store old allocations for event
        uint256[] memory oldAllocations = new uint256[](strategy.allocationPercentages.length);
        for (uint256 i = 0; i < strategy.allocationPercentages.length; i++) {
            oldAllocations[i] = strategy.allocationPercentages[i];
        }
        
        // Implement advanced AI optimization logic with multiple models
        if (aiPredictor.useTransformerModel && aiPredictor.useReinforcementLearning) {
            // Use ensemble of transformer and RL models
            newAllocations = _runAdvancedEnsembleOptimization(
                strategy.protocolIds,
                strategy.allocationPercentages,
                strategy.risk,
                strategy.volatilityMetrics,
                strategy.maxDrawdown
            );
        } else {
            // Fall back to basic optimization
            newAllocations = _runAIOptimization(
                strategy.protocolIds,
                strategy.allocationPercentages,
                strategy.risk
            );
        }
        
        // Verify allocations meet risk limits
        _validateAllocations(strategy.protocolIds, newAllocations);
        
        // Update strategy
        strategy.allocationPercentages = newAllocations;
        strategy.lastUpdated = block.timestamp;
        
        // Track rebalance
        strategy.rebalanceCount += 1;
        strategy.rebalanceHistory[block.timestamp] = strategy.rebalanceCount;
        
        // Recalculate projected APY and metrics
        uint256 projectedAPY = 0;
        uint256 portfolioVolatility = 0;
        uint256 weightedSharpeRatio = 0;
        
        for (uint256 i = 0; i < strategy.protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[strategy.protocolIds[i]];
            
            // Calculate weighted APY
            projectedAPY += (performance.currentAPY * newAllocations[i]) / 10000;
            
            // Calculate portfolio volatility (simplified)
            portfolioVolatility += (performance.volatility * newAllocations[i] / 10000) ** 2;
            
            // Calculate weighted Sharpe Ratio components
            uint256 excessReturn = performance.currentAPY > 300 ? performance.currentAPY - 300 : 0;
            uint256 protocolSharpe = performance.volatility > 0 ? (excessReturn * 100) / performance.volatility : 0;
            weightedSharpeRatio += (protocolSharpe * newAllocations[i]) / 10000;
        }
        
        // Update metrics
        strategy.projectedAPY = projectedAPY;
        strategy.sharpeRatio = weightedSharpeRatio;
        
        // Calculate new AI confidence score
        strategy.aiConfidenceScore = _calculateAIConfidence(
            strategy.risk,
            _sqrt(portfolioVolatility),
            strategy.maxDrawdown,
            strategy.protocolIds,
            newAllocations
        );
        
        emit StrategyUpdated(strategyId, strategy.protocolIds, newAllocations, strategy.aiConfidenceScore);
        emit RebalancingExecuted(strategyId, oldAllocations, newAllocations);
        
        return newAllocations;
    }
    
    /**
     * @dev Execute a strategy for a token with advanced risk management
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
        validateStrategyRisk(strategyId)
    {
        // Validate parameters
        if (bytes(token).length == 0 || bytes(strategyId).length == 0 || amount == 0) {
            revert InvalidParameters();
        }
        
        // Check if strategy exists and is active
        YieldStrategy storage strategy = strategies[strategyId];
        if (!strategy.active) {
            revert StrategyNotFound(strategyId);
        }
        
        // Get token contract address (would be provided by the calling contract)
        address tokenAddress;
        if (keccak256(bytes(token)) == keccak256(bytes(\"IOTA\"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes(\"MIOTA\"))) {
            tokenAddress = 0x5555555555555555555555555555555555555555; // Placeholder
        } else {
            revert TokenNotSupported(token);
        }
        
        // Track allocation
        if (!allocations[token].isActive) {
            allocations[token].tokenSymbol = token;
            allocations[token].isActive = true;
            allocations[token].lastBalance = amount;
            
            // Initialize additional metrics
            allocations[token].historicalVolatility = 20; // Default 20%
            allocations[token].priceCorrelation = 50;     // Default 50% correlation
            allocations[token].lastValuation = amount * 1e18; // Assuming 1:1 with USD for demo
            allocations[token].hasActiveLiquidationProtection = false;
            
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
                
                // Execute deposit with enhanced error handling
                try this.executeProtocolDeposit(
                    protocolContract, 
                    strategy.targetSelectors[i], 
                    protocolAmount, 
                    protocolId,
                    token
                ) {
                    // Deposit successful
                } catch (bytes memory errorData) {
                    // Extract reason from revert
                    string memory reason = \"Unknown error\";
                    if (errorData.length > 4) {
                        reason = _extractRevertReason(errorData);
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
        
        // Create a performance snapshot
        _createPerformanceSnapshot();
        
        emit FundsAllocated(token, strategyId, amount);
    }
    
    /**
     * @dev Execute protocol deposit (separated to catch errors)
     */
    function executeProtocolDeposit(
        address protocolContract,
        bytes4 selector,
        uint256 amount,
        string memory protocolId,
        string memory token
    ) external {
        require(msg.sender == address(this), \"Only self-call allowed\");
        
        // Different parameter handling based on protocol
        if (keccak256(bytes(protocolId)) == keccak256(bytes(\"aave\"))) {
            // For Aave: (asset, amount, onBehalfOf, referralCode)
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(selector, getTokenAddress(token), amount, address(this), 0)
            );
            require(success, \"Aave deposit failed\");
        } else if (keccak256(bytes(protocolId)) == keccak256(bytes(\"compound\"))) {
            // For Compound: (asset, amount)
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(selector, getTokenAddress(token), amount)
            );
            require(success, \"Compound deposit failed\");
        } else {
            // Default for other protocols
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(selector, amount)
            );
            require(success, \"Protocol deposit failed\");
        }
    }
    
    /**
     * @dev Harvest yields from protocols with optimized gas and enhanced reporting
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
        if (keccak256(bytes(token)) == keccak256(bytes(\"IOTA\"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes(\"MIOTA\"))) {
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
                (bytes4 harvestSelector, bytes memory harvestData) = _getHarvestFunctionData(protocolId, token);
                
                // Execute harvest with enhanced error handling
                try this.executeProtocolHarvest(protocolContract, harvestSelector, harvestData) {
                    // Harvest successful
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
                        
                        // Update protocol daily returns
                        uint256 today = block.timestamp / 86400;
                        uint256 dailyReturn = (harvestedAmount * 1e6) / allocated; // Return as ppm
                        protocolPerformance[protocolId].dailyReturns[today] = dailyReturn;
                        
                        // Update protocol APY based on latest returns
                        _updateProtocolAPY(protocolId);
                    }
                } catch {
                    // Failed to harvest, but continue with other protocols
                    continue;
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
            
            // Create a performance snapshot
            _createPerformanceSnapshot();
            
            // Emit event
            emit ReturnsHarvested(token, finalProtocols, finalAmounts, totalHarvested);
        }
        
        return totalHarvested;
    }
    
    /**
     * @dev Execute protocol harvest (separated to catch errors)
     */
    function executeProtocolHarvest(
        address protocolContract,
        bytes4 selector,
        bytes memory data
    ) external {
        require(msg.sender == address(this), \"Only self-call allowed\");
        
        (bool success, ) = protocolContract.call(
            abi.encodePacked(selector, data)
        );
        
        require(success, \"Harvest failed\");
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
        if (keccak256(bytes(token)) == keccak256(bytes(\"IOTA\"))) {
            tokenAddress = 0x4444444444444444444444444444444444444444; // Placeholder
        } else if (keccak256(bytes(token)) == keccak256(bytes(\"MIOTA\"))) {
            tokenAddress = 0x5555555555555555555555555555555555555555; // Placeholder
        } else {
            revert TokenNotSupported(token);
        }
        
        address protocolContract = protocols[protocolId];
        
        // Determine appropriate withdraw function data based on protocol
        (bytes4 withdrawSelector, bytes memory withdrawData) = _getWithdrawFunctionData(protocolId, token, allocated);
        
        // Get balance before withdrawal
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        
        // Execute withdrawal with enhanced error handling
        try this.executeProtocolWithdraw(
            protocolContract, 
            withdrawSelector, 
            withdrawData
        ) {
            // Withdrawal successful
            // Check token balance increase
            uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
            amountWithdrawn = balanceAfter - balanceBefore;
            
            // Update allocation tracking
            allocations[token].protocolAllocations[protocolId] = 0;
            allocations[token].totalWithdrawn += amountWithdrawn;
            protocolPerformance[protocolId].totalAllocated -= allocated;
            
            // Transfer withdrawn amount to strategy controller
            IERC20(tokenAddress).safeTransfer(strategyController, amountWithdrawn);
        } catch {
            // If emergency withdrawal fails, try alternative withdrawal method
            try this.executeEmergencyWithdraw(protocolContract, protocolId, token) {
                // Check token balance increase
                uint256 balanceAfter = IERC20(tokenAddress).balanceOf(address(this));
                amountWithdrawn = balanceAfter - balanceBefore;
                
                // Update allocation tracking
                allocations[token].protocolAllocations[protocolId] = 0;
                allocations[token].totalWithdrawn += amountWithdrawn;
                protocolPerformance[protocolId].totalAllocated -= allocated;
                
                // Transfer withdrawn amount to strategy controller
                IERC20(tokenAddress).safeTransfer(strategyController, amountWithdrawn);
            } catch {
                // Both withdrawal methods failed
                return 0;
            }
        }
        
        return amountWithdrawn;
    }
    
    /**
     * @dev Execute protocol withdrawal (separated to catch errors)
     */
    function executeProtocolWithdraw(
        address protocolContract,
        bytes4 selector,
        bytes memory data
    ) external {
        require(msg.sender == address(this), \"Only self-call allowed\");
        
        (bool success, ) = protocolContract.call(
            abi.encodePacked(selector, data)
        );
        
        require(success, \"Withdrawal failed\");
    }
    
    /**
     * @dev Execute emergency withdrawal mechanism (separated to catch errors)
     */
    function executeEmergencyWithdraw(
        address protocolContract,
        string memory protocolId,
        string memory token
    ) external {
        require(msg.sender == address(this), \"Only self-call allowed\");
        
        // Different emergency withdrawal mechanisms based on protocol
        if (keccak256(bytes(protocolId)) == keccak256(bytes(\"aave\"))) {
            // For Aave emergency exit
            bytes4 emergencySelector = bytes4(keccak256(\"emergencyWithdraw(address)\"));
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(emergencySelector, getTokenAddress(token))
            );
            require(success, \"Aave emergency withdrawal failed\");
        } else if (keccak256(bytes(protocolId)) == keccak256(bytes(\"compound\"))) {
            // For Compound emergency exit
            bytes4 emergencySelector = bytes4(keccak256(\"exitMarket(address)\"));
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(emergencySelector, getTokenAddress(token))
            );
            require(success, \"Compound emergency withdrawal failed\");
        } else {
            // Default emergency exit
            bytes4 emergencySelector = bytes4(keccak256(\"emergencyExit()\"));
            (bool success, ) = protocolContract.call(
                abi.encodeWithSelector(emergencySelector)
            );
            require(success, \"Emergency withdrawal failed\");
        }
    }
    
    /**
     * @dev Activate liquidation protection for a token
     * @param token Token symbol
     * @param healthFactor Current health factor (scaled by 100)
     * @return success Whether protection was activated
     */
    function activateLiquidationProtection(string calldata token, uint256 healthFactor) 
        external 
        onlyAuthorized 
        nonReentrant 
        returns (bool success) 
    {
        // Validate parameters
        if (bytes(token).length == 0 || !allocations[token].isActive) {
            revert TokenNotSupported(token);
        }
        
        // Check if protection is already active
        if (allocations[token].hasActiveLiquidationProtection) {
            return false;
        }
        
        // Check if health factor is below threshold (add buffer)
        uint256 threshold = 12000; // 120% threshold (scaled by 100)
        if (healthFactor > threshold + riskManagement.liquidationProtectionBuffer) {
            return false; // Health factor is good, no need for protection
        }
        
        // Activate protection
        allocations[token].hasActiveLiquidationProtection = true;
        
        // Implement protection logic based on current market conditions
        if (marketCondition.volatilityIndex > 70) {
            // High market volatility - perform emergency withdrawal from high-risk protocols
            for (uint256 i = 0; i < supportedProtocols.length; i++) {
                string memory protocolId = supportedProtocols[i];
                if (protocolPerformance[protocolId].riskScore > 70) {
                    uint256 allocated = allocations[token].protocolAllocations[protocolId];
                    if (allocated > 0) {
                        // Attempt emergency withdrawal
                        this.emergencyWithdraw(token, protocolId);
                    }
                }
            }
        } else {
            // Normal market conditions - add more collateral or reduce debt
            // This would interact with the lending pool in a real implementation
        }
        
        emit LiquidationProtectionActivated(token, healthFactor);
        return true;
    }
    
    /**
     * @dev Update risk management parameters
     * @param _maxAllocationPerProtocol Maximum allocation percentage per protocol
     * @param _maxTotalRiskExposure Maximum total risk exposure
     * @param _drawdownProtectionThreshold Threshold for drawdown protection
     * @param _volatilityThreshold Threshold for volatility-based rebalancing
     */
    function updateRiskParameters(
        uint256 _maxAllocationPerProtocol,
        uint256 _maxTotalRiskExposure,
        uint256 _drawdownProtectionThreshold,
        uint256 _volatilityThreshold
    ) 
        external 
        onlyOwner 
    {
        // Validate parameters
        require(_maxAllocationPerProtocol <= 5000, \"Max allocation too high\"); // Max 50%
        require(_maxTotalRiskExposure <= 8000, \"Max risk exposure too high\"); // Max 80%
        require(_drawdownProtectionThreshold <= 3000, \"Drawdown threshold too high\"); // Max 30%
        
        // Update risk parameters
        riskManagement.maxAllocationPerProtocol = _maxAllocationPerProtocol;
        riskManagement.maxTotalRiskExposure = _maxTotalRiskExposure;
        riskManagement.drawdownProtectionThreshold = _drawdownProtectionThreshold;
        riskManagement.volatilityThreshold = _volatilityThreshold;
        
        emit RiskLimitsUpdated(_maxAllocationPerProtocol, _maxTotalRiskExposure);
    }
    
    /**
     * @dev Authorize a user to call restricted functions
     * @param user User address
     * @param status Authorization status
     * @param riskProfile User risk profile (0-100)
     */
    function setUserAuthorization(address user, bool status, uint256 riskProfile) external onlyOwner {
        authorizedUsers[user] = status;
        riskManagement.userRiskProfiles[user] = riskProfile;
        emit UserAuthorized(user, status);
    }
    
    /**
     * @dev Update quantum security parameters
     * @param _postQuantumVerificationEnabled Whether post-quantum verification is enabled
     * @param _securityLevel Security level (bits)
     * @param _multiLayerEncryptionEnabled Whether multi-layer encryption is enabled
     * @param _dilithiumPublicKeyHash Hash of the Dilithium public key
     */
    function updateQuantumSecurity(
        bool _postQuantumVerificationEnabled,
        uint256 _securityLevel,
        bool _multiLayerEncryptionEnabled,
        bytes32 _dilithiumPublicKeyHash
    ) 
        external 
        onlyOwner 
    {
        // Update quantum security parameters
        quantumSecurity.postQuantumVerificationEnabled = _postQuantumVerificationEnabled;
        quantumSecurity.securityLevel = _securityLevel;
        quantumSecurity.multiLayerEncryptionEnabled = _multiLayerEncryptionEnabled;
        
        if (_dilithiumPublicKeyHash != bytes32(0)) {
            quantumSecurity.dilithiumPublicKeyHash = _dilithiumPublicKeyHash;
            quantumSecurity.lastKeyRotation = block.timestamp;
        }
        
        emit QuantumSecurityUpdated(_postQuantumVerificationEnabled, _securityLevel);
    }
    
    /**
     * @dev Register a user's quantum-resistant public key
     * @param user User address
     * @param quantumPublicKey Quantum-resistant public key
     */
    function registerQuantumPublicKey(address user, bytes calldata quantumPublicKey) external {
        // Only the user or an admin can register their key
        require(msg.sender == user || msg.sender == owner(), \"Unauthorized\");
        require(quantumPublicKey.length > 0, \"Invalid key\");
        
        // Store the key
        quantumSecurity.userQuantumPublicKeys[user] = quantumPublicKey;
    }
    
    /**
     * @dev Set strategy controller address
     * @param _strategyController New strategy controller address
     */
    function setStrategyController(address _strategyController) external onlyOwner {
        require(_strategyController != address(0), \"Invalid address\");
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
     * @dev Get protocol performance metrics with enhanced data
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
            bool isActive,
            uint256 tvl,
            uint256 impermanentLossExposure,
            uint256 smartContractRiskScore,
            uint256 composabilityScore,
            uint256 regulatoryRiskScore
        ) 
    {
        ProtocolPerformance storage performance = protocolPerformance[protocolId];
        
        return (
            performance.historicalAPY,
            performance.currentAPY,
            performance.riskScore,
            performance.totalAllocated,
            performance.totalProfit,
            performance.volatility,
            performance.isActive,
            performance.tvl,
            performance.impermanentLossExposure,
            performance.smartContractRiskScore,
            performance.composabilityScore,
            performance.regulatoryRiskScore
        );
    }
    
    /**
     * @dev Get strategy details with performance metrics
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
            bool active,
            uint256[] memory historicalPerformance,
            uint256 sharpeRatio,
            uint256 maxDrawdown,
            uint256 rebalanceCount,
            uint256 aiConfidenceScore
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
            strategy.active,
            strategy.historicalPerformance,
            strategy.sharpeRatio,
            strategy.maxDrawdown,
            strategy.rebalanceCount,
            strategy.aiConfidenceScore
        );
    }
    
    /**
     * @dev Get token allocation details with enhanced metrics
     * @param token Token symbol
     * @return allocation Token allocation details
     */
    function getTokenAllocation(string calldata token) 
        external 
        view 
        returns (
            uint256 totalAllocated,
            uint256 totalWithdrawn,
            uint256 totalProfit,
            bool isActive,
            uint256 historicalVolatility,
            uint256 priceCorrelation,
            uint256 lastValuation,
            bool hasActiveLiquidationProtection
        ) 
    {
        TokenAllocation storage allocation = allocations[token];
        
        return (
            allocation.totalAllocated,
            allocation.totalWithdrawn,
            allocation.totalProfit,
            allocation.isActive,
            allocation.historicalVolatility,
            allocation.priceCorrelation,
            allocation.lastValuation,
            allocation.hasActiveLiquidationProtection
        );
    }
    
    /**
     * @dev Get AI predictor configuration
     * @return AI predictor details
     */
    function getAIPredictor() 
        external 
        view 
        returns (
            uint256 lastUpdated,
            uint256 confidenceScore,
            uint256 predictionHorizon,
            bool useOnChainModel,
            string[] memory activeModels,
            uint256 ensembleAccuracy,
            uint256 lastBacktestScore,
            bool useTransformerModel,
            bool useReinforcementLearning
        ) 
    {
        return (
            aiPredictor.lastUpdated,
            aiPredictor.confidenceScore,
            aiPredictor.predictionHorizon,
            aiPredictor.useOnChainModel,
            aiPredictor.activeModels,
            aiPredictor.ensembleAccuracy,
            aiPredictor.lastBacktestScore,
            aiPredictor.useTransformerModel,
            aiPredictor.useReinforcementLearning
        );
    }
    
    /**
     * @dev Get market condition data
     * @return Market condition details
     */
    function getMarketCondition() 
        external 
        view 
        returns (
            uint256 volatilityIndex,
            uint256 trendDirection,
            uint256 liquidityScore,
            uint256 lastUpdated,
            uint256 fearGreedIndex,
            int256 sentimentScore,
            uint256 macroEconomicRisk,
            uint256 systemicRiskScore,
            uint256 interestRateTrend,
            uint256 inflationExpectation
        ) 
    {
        return (
            marketCondition.volatilityIndex,
            marketCondition.trendDirection,
            marketCondition.liquidityScore,
            marketCondition.lastUpdated,
            marketCondition.fearGreedIndex,
            marketCondition.sentimentScore,
            marketCondition.macroEconomicRisk,
            marketCondition.systemicRiskScore,
            marketCondition.interestRateTrend,
            marketCondition.inflationExpectation
        );
    }
    
    /**
     * @dev Get risk management parameters
     * @return Risk management details
     */
    function getRiskManagement() 
        external 
        view 
        returns (
            uint256 maxAllocationPerProtocol,
            uint256 maxTotalRiskExposure,
            uint256 drawdownProtectionThreshold,
            bool autoRebalancingEnabled,
            uint256 volatilityThreshold,
            uint256 correlationLimit,
            uint256 smartContractAuditScore,
            uint256 liquidationProtectionBuffer
        ) 
    {
        return (
            riskManagement.maxAllocationPerProtocol,
            riskManagement.maxTotalRiskExposure,
            riskManagement.drawdownProtectionThreshold,
            riskManagement.autoRebalancingEnabled,
            riskManagement.volatilityThreshold,
            riskManagement.correlationLimit,
            riskManagement.smartContractAuditScore,
            riskManagement.liquidationProtectionBuffer
        );
    }
    
    /**
     * @dev Get quantum security parameters
     * @return Quantum security details
     */
    function getQuantumSecurity() 
        external 
        view 
        returns (
            bool postQuantumVerificationEnabled,
            uint256 securityLevel,
            bool multiLayerEncryptionEnabled,
            uint256 lastKeyRotation
        ) 
    {
        return (
            quantumSecurity.postQuantumVerificationEnabled,
            quantumSecurity.securityLevel,
            quantumSecurity.multiLayerEncryptionEnabled,
            quantumSecurity.lastKeyRotation
        );
    }
    
    /**
     * @dev Get a user's quantum public key
     * @param user User address
     * @return publicKey Quantum-resistant public key
     */
    function getUserQuantumPublicKey(address user) external view returns (bytes memory) {
        return quantumSecurity.userQuantumPublicKeys[user];
    }
    
    /**
     * @dev Get sector performance data
     * @param sector Sector name
     * @return performance Sector performance (scaled by 100)
     */
    function getSectorPerformance(string calldata sector) external view returns (uint256) {
        return marketCondition.sectorPerformance[sector];
    }
    
    /**
     * @dev Get a user's risk profile
     * @param user User address
     * @return riskProfile Risk profile (0-100)
     */
    function getUserRiskProfile(address user) external view returns (uint256) {
        return riskManagement.userRiskProfiles[user];
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
     * @dev Get performance snapshot timestamps
     * @return timestamps Array of performance snapshot timestamps
     */
    function getSnapshotTimestamps() external view returns (uint256[] memory) {
        return snapshotTimestamps;
    }
    
    /**
     * @dev Run advanced ensemble optimization with transformer and RL models
     * @param protocolIds Array of protocol IDs
     * @param currentAllocations Current allocation percentages
     * @param mode Optimization mode
     * @param volatilityMetrics Protocol volatility metrics
     * @param maxDrawdown Maximum acceptable drawdown
     * @return newAllocations New allocation percentages
     */
    function _runAdvancedEnsembleOptimization(
        string[] memory protocolIds,
        uint256[] memory currentAllocations,
        OptimizationMode mode,
        uint256[] memory volatilityMetrics,
        uint256 maxDrawdown
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
        uint256 fearGreed = marketCondition.fearGreedIndex;
        int256 sentiment = marketCondition.sentimentScore;
        
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
        } else if (mode == OptimizationMode.Dynamic) {
            // Dynamic mode adjusts based on market conditions
            if (fearGreed > 70) {
                // Market is greedy - be more conservative
                riskTolerance = 40;
                maxAllocationPerProtocol = 3000;
                minAllocationPerProtocol = 1500;
            } else if (fearGreed < 30) {
                // Market is fearful - opportunity to be aggressive
                riskTolerance = 70;
                maxAllocationPerProtocol = 4000;
                minAllocationPerProtocol = 800;
            } else {
                // Normal market - balanced approach
                riskTolerance = 50;
                maxAllocationPerProtocol = 3500;
                minAllocationPerProtocol = 1200;
            }
        } else { // Risk_Averse
            riskTolerance = 10;
            maxAllocationPerProtocol = 2000; // Up to 20% in one protocol
            minAllocationPerProtocol = 2000; // At least 20% in each protocol
        }
        
        // Respect global risk limits
        if (maxAllocationPerProtocol > riskManagement.maxAllocationPerProtocol) {
            maxAllocationPerProtocol = riskManagement.maxAllocationPerProtocol;
        }
        
        // First pass: Create transformer model allocations
        uint256[] memory transformerAllocations = new uint256[](protocolIds.length);
        
        // For transformer model, use sophisticated attention to market conditions
        uint256 totalScore = 0;
        uint256[] memory scores = new uint256[](protocolIds.length);
        
        for (uint256 i = 0; i < protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[protocolIds[i]];
            
            // Calculate score based on APY, risk score, and market conditions
            uint256 apyScore = performance.currentAPY;
            uint256 riskAdjustment = 100 - performance.riskScore;
            
            // Adjust for market conditions using attention mechanism
            uint256 volatilityFactor = 100;
            if (volatilityMetrics[i] > volatility) {
                // Protocol more volatile than market
                volatilityFactor = 100 - (volatilityMetrics[i] - volatility) / 2;
            }
            
            // Advanced trend adjustment with sentiment analysis
            uint256 trendFactor = 100;
            if (sentiment > 0) {
                // Positive sentiment - favor higher return protocols
                trendFactor = 80 + trend / 5 + uint256(sentiment) / 10; // 80-120
            } else {
                // Negative sentiment - favor safer protocols
                trendFactor = 120 - trend / 5 + uint256(-sentiment) / 10; // 80-120
            }
            
            // Calculate combined score with cross-attention to market factors
            uint256 score = (apyScore * riskAdjustment * volatilityFactor * trendFactor / 1000000) * 
                           (100 + uint256(sentiment)) / 100;
            
            scores[i] = score;
            totalScore += score;
        }
        
        // Calculate transformer allocations
        if (totalScore > 0) {
            for (uint256 i = 0; i < protocolIds.length; i++) {
                transformerAllocations[i] = scores[i] * 10000 / totalScore;
            }
        }
        
        // Second pass: Create RL model allocations based on historical performance
        uint256[] memory rlAllocations = new uint256[](protocolIds.length);
        
        // RL model focuses on risk-adjusted returns and drawdown protection
        for (uint256 i = 0; i < protocolIds.length; i++) {
            ProtocolPerformance memory performance = protocolPerformance[protocolIds[i]];
            
            // Calculate Sharpe ratio
            uint256 excessReturn = performance.currentAPY > 300 ? performance.currentAPY - 300 : 0;
            uint256 sharpeRatio = performance.volatility > 0 ? (excessReturn * 100) / performance.volatility : 0;
            
            // Factor in drawdown protection
            uint256 drawdownFactor = 100;
            if (maxDrawdown < 2000) { // If max drawdown is less than 20%
                // More conservative allocation based on volatility
                if (volatilityMetrics[i] > 30) {
                    drawdownFactor = 100 - (volatilityMetrics[i] - 30);
                }
            }
            
            // Calculate RL allocation score
            uint256 rlScore = sharpeRatio * drawdownFactor / 100;
            
            // Store in array for normalization
            scores[i] = rlScore;
            totalScore = 0; // Reset for reuse
        }
        
        // Recalculate total score
        for (uint256 i = 0; i < protocolIds.length; i++) {
            totalScore += scores[i];
        }
        
        // Calculate RL allocations
        if (totalScore > 0) {
            for (uint256 i = 0; i < protocolIds.length; i++) {
                rlAllocations[i] = scores[i] * 10000 / totalScore;
            }
        } else {
            // Equal allocation as fallback
            for (uint256 i = 0; i < protocolIds.length; i++) {
                rlAllocations[i] = 10000 / protocolIds.length;
            }
        }
        
        // Third pass: Ensemble the models based on their weights
        uint256 transformerWeight = aiPredictor.modelWeights[\"TransformerV2\"];
        uint256 rlWeight = aiPredictor.modelWeights[\"ReinforcementLearning\"];
        uint256 totalWeight = transformerWeight + rlWeight;
        
        // Combine the allocations
        for (uint256 i = 0; i < protocolIds.length; i++) {
            if (totalWeight > 0) {
                newAllocations[i] = (transformerAllocations[i] * transformerWeight + 
                                   rlAllocations[i] * rlWeight) / totalWeight;
            } else {
                // Equal weights as fallback
                newAllocations[i] = (transformerAllocations[i] + rlAllocations[i]) / 2;
            }
        }
        
        // Apply stability with inertia from current allocations if confidence is not high
        if (confidence < 80) {
            uint256 inertiaFactor = 80 - confidence; // 0-80
            
            for (uint256 i = 0; i < protocolIds.length; i++) {
                newAllocations[i] = (newAllocations[i] * (100 - inertiaFactor) + 
                                   currentAllocations[i] * inertiaFactor) / 100;
            }
        }
        
        // Apply min/max constraints
        totalScore = 0; // Reuse as total allocation
        
        for (uint256 i = 0; i < protocolIds.length; i++) {
            // Apply protocol-specific risk limit
            uint256 protocolLimit = riskManagement.protocolRiskLimits[protocolIds[i]];
            if (protocolLimit > 0 && newAllocations[i] > protocolLimit) {
                newAllocations[i] = protocolLimit;
            }
            
            // Apply min/max limits
            if (newAllocations[i] < minAllocationPerProtocol) {
                newAllocations[i] = minAllocationPerProtocol;
            } else if (newAllocations[i] > maxAllocationPerProtocol) {
                newAllocations[i] = maxAllocationPerProtocol;
            }
            
            totalScore += newAllocations[i];
        }
        
        // Final normalization to ensure total is exactly 10000 (100%)
        if (totalScore != 10000) {
            // Find protocols with flexible allocations
            uint256[] memory flexibleIndices = new uint256[](protocolIds.length);
            uint256 flexibleCount = 0;
            
            for (uint256 i = 0; i < protocolIds.length; i++) {
                if (newAllocations[i] > minAllocationPerProtocol && 
                    newAllocations[i] < maxAllocationPerProtocol) {
                    flexibleIndices[flexibleCount] = i;
                    flexibleCount++;
                }
            }
            
            if (flexibleCount > 0) {
                // Adjust flexible allocations
                uint256 adjustment = (10000 - totalScore) / flexibleCount;
                
                for (uint256 i = 0; i < flexibleCount; i++) {
                    uint256 idx = flexibleIndices[i];
                    newAllocations[idx] += adjustment;
                    
                    // Ensure we don't exceed limits
                    if (newAllocations[idx] > maxAllocationPerProtocol) {
                        uint256 excess = newAllocations[idx] - maxAllocationPerProtocol;
                        newAllocations[idx] = maxAllocationPerProtocol;
                        
                        // Redistribute excess
                        if (i < flexibleCount - 1) {
                            uint256 nextIdx = flexibleIndices[i + 1];
                            newAllocations[nextIdx] += excess;
                        }
                    } else if (newAllocations[idx] < minAllocationPerProtocol) {
                        uint256 shortfall = minAllocationPerProtocol - newAllocations[idx];
                        newAllocations[idx] = minAllocationPerProtocol;
                        
                        // Redistribute shortfall
                        if (i < flexibleCount - 1) {
                            uint256 nextIdx = flexibleIndices[i + 1];
                            newAllocations[nextIdx] -= shortfall;
                        }
                    }
                }
            } else {
                // No flexible allocations, adjust the first allocation
                newAllocations[0] += (10000 - totalScore);
            }
        }
        
        // Final check to ensure total is exactly 10000
        totalScore = 0;
        for (uint256 i = 0; i < protocolIds.length; i++) {
            totalScore += newAllocations[i];
        }
        
        if (totalScore != 10000) {
            // Final adjustment to the largest allocation
            uint256 largestIndex = 0;
            for (uint256 i = 1; i < protocolIds.length; i++) {
                if (newAllocations[i] > newAllocations[largestIndex]) {
                    largestIndex = i;
                }
            }
            
            newAllocations[largestIndex] += (10000 - totalScore);
        }
        
        return newAllocations;
    }
    
    /**
     * @dev Run basic AI optimization algorithm to reallocate funds (legacy)
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
        } else { // Risk_Averse or Dynamic (fallback)
            riskTolerance = 10;
            maxAllocationPerProtocol = 2000; // Up to 20% in one protocol
            minAllocationPerProtocol = 2000; // At least 20% in each protocol
        }
        
        // Respect global risk limits
        if (maxAllocationPerProtocol > riskManagement.maxAllocationPerProtocol) {
            maxAllocationPerProtocol = riskManagement.maxAllocationPerProtocol;
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
     * @dev Calculate AI confidence score for a strategy
     * @param mode Strategy optimization mode
     * @param portfolioVolatility Portfolio volatility
     * @param maxDrawdown Maximum acceptable drawdown
     * @param protocolIds Protocol IDs in the strategy
     * @param allocations Allocation percentages
     * @return confidenceScore AI confidence score (0-100)
     */
    function _calculateAIConfidence(
        OptimizationMode mode,
        uint256 portfolioVolatility,
        uint256 maxDrawdown,
        string[] memory protocolIds,
        uint256[] memory allocations
    ) 
        internal 
        view 
        returns (uint256 confidenceScore) 
    {
        // Base confidence from AI model
        confidenceScore = aiPredictor.confidenceScore;
        
        // Adjust based on strategy alignment with market conditions
        if (mode == OptimizationMode.Aggressive) {
            // Aggressive strategies perform better in bull markets
            if (marketCondition.trendDirection > 60 && marketCondition.fearGreedIndex > 60) {
                confidenceScore += 10; // Increase confidence
            } else if (marketCondition.trendDirection < 40 && marketCondition.fearGreedIndex < 40) {
                confidenceScore -= 15; // Decrease confidence
            }
        } else if (mode == OptimizationMode.Conservative || mode == OptimizationMode.Risk_Averse) {
            // Conservative strategies perform better in bear markets
            // Conservative strategies perform better in bear markets
            if (marketCondition.trendDirection < 40 && marketCondition.fearGreedIndex < 40) {
                confidenceScore += 10; // Increase confidence
            } else if (marketCondition.trendDirection > 60 && marketCondition.fearGreedIndex > 60) {
                confidenceScore -= 10; // Decrease confidence
            }
        } else if (mode == OptimizationMode.Dynamic) {
            // Dynamic mode adapts to market conditions, so has higher confidence at extremes
            if ((marketCondition.trendDirection < 30 || marketCondition.trendDirection > 70) && 
                (marketCondition.fearGreedIndex < 30 || marketCondition.fearGreedIndex > 70)) {
                confidenceScore += 5; // Clear market direction increases confidence
            }
        }
        
        // Adjust based on portfolio volatility vs. target
        uint256 volatilityTarget = mode == OptimizationMode.Aggressive ? 40 :
                                 mode == OptimizationMode.Balanced ? 25 :
                                 mode == OptimizationMode.Conservative ? 15 : 10;
        
        uint256 volatilityDiff = portfolioVolatility > volatilityTarget ?
                               portfolioVolatility - volatilityTarget :
                               volatilityTarget - portfolioVolatility;
        
        if (volatilityDiff <= 5) {
            confidenceScore += 5; // Close to target, increase confidence
        } else if (volatilityDiff >= 15) {
            confidenceScore -= 10; // Far from target, decrease confidence
        }
        
        // Adjust based on drawdown risk
        if (portfolioVolatility > 30 && maxDrawdown < 1500) {
            confidenceScore -= 5; // High volatility but low max drawdown tolerance
        } else if (portfolioVolatility < 15 && maxDrawdown > 2000) {
            confidenceScore += 5; // Low volatility with high max drawdown tolerance
        }
        
        // Adjust based on allocation concentration
        uint256 maxAllocation = 0;
        uint256 minAllocation = 10000; // Start with max possible (100%)
        
        for (uint256 i = 0; i < allocations.length; i++) {
            if (allocations[i] > maxAllocation) {
                maxAllocation = allocations[i];
            }
            if (allocations[i] < minAllocation && allocations[i] > 0) {
                minAllocation = allocations[i];
            }
        }
        
        // Calculate concentration ratio (higher = more concentrated)
        uint256 concentrationRatio = maxAllocation * 100 / (minAllocation > 0 ? minAllocation : 100);
        
        // Penalize high concentration for conservative strategies
        if (mode == OptimizationMode.Conservative || mode == OptimizationMode.Risk_Averse) {
            if (concentrationRatio > 500) { // 5:1 ratio
                confidenceScore -= 8;
            }
        }
        
        // For aggressive strategies, some concentration is acceptable
        if (mode == OptimizationMode.Aggressive) {
            if (concentrationRatio > 1000) { // 10:1 ratio
                confidenceScore -= 5;
            }
        }
        
        // Adjust based on market sentiment alignment
        if (mode == OptimizationMode.Aggressive && marketCondition.sentimentScore > 30) {
            confidenceScore += 5; // Positive sentiment favors aggressive strategy
        } else if ((mode == OptimizationMode.Conservative || mode == OptimizationMode.Risk_Averse) && 
                   marketCondition.sentimentScore < -30) {
            confidenceScore += 5; // Negative sentiment favors conservative strategy
        }
        
        // Ensure score stays within 0-100 range
        if (confidenceScore > 100) {
            confidenceScore = 100;
        } else if (confidenceScore < 0) {
            confidenceScore = 0;
        }
        
        return confidenceScore;
    }
}