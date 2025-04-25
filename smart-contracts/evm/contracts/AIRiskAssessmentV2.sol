// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IAIRiskAssessment.sol";

/**
 * @title AIRiskAssessmentV2
 * @dev Enhanced implementation of the AI-powered risk assessment system with advanced features
 * @notice This contract bridges the AI model with the blockchain by managing risk scores,
 * with advanced features like federated learning, model explainability, and anomaly detection
 */
contract AIRiskAssessmentV2 is IAIRiskAssessment, Ownable, Pausable {
    using ECDSA for bytes32;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // Enhanced State variables
    mapping(address => uint256) private userRiskScores;
    mapping(address => uint256) private lastAssessmentTimes;
    EnumerableSet.AddressSet private authorizedOracles;
    EnumerableSet.AddressSet private federatedLearningParticipants;
    
    // Risk metrics for each user with enhanced data
    struct EnhancedRiskMetrics {
        uint256 overallScore;
        uint256 repaymentScore;
        uint256 collateralScore;
        uint256 volatilityScore;
        uint256 activityScore;
        uint256 crossChainActivityScore;
        uint256 identityScore;
        uint256 marketCorrelationScore;
        uint256 lastUpdated;
        bytes32 explainabilityRoot; // Merkle root for explainability features
        mapping(bytes32 => int256) featureImportance; // Feature key => importance score
        uint256 anomalyScore; // Score indicating potential anomalous behavior (0-100)
        uint256 confidenceScore; // Model prediction confidence (0-100)
    }
    
    // Mapping for enhanced risk metrics
    mapping(address => EnhancedRiskMetrics) private userEnhancedMetrics;
    
    // Model information with enhanced versioning
    struct ModelInfo {
        bytes32 modelId;
        uint256 version;
        uint256 deploymentTime;
        bytes32 modelHash; // Hash of the model weights or architecture
        bytes32 datasetHash; // Hash of the training dataset
        uint256 accuracy; // Model accuracy score (0-100)
        uint256 f1Score; // Model F1 score (0-100)
        string metadataURI; // URI to model metadata (IPFS or similar)
    }
    
    ModelInfo public currentModel;
    mapping(bytes32 => ModelInfo) public modelHistory;
    EnumerableSet.Bytes32Set private modelVersions;
    
    // Federated learning updates
    struct ModelUpdate {
        bytes32 updateId;
        address participant;
        bytes32 modelId;
        bytes32 gradientsHash; // Hash of the gradients
        uint256 timestamp;
        bool accepted;
        uint256 weight; // Weight of this update in the federated averaging
    }
    
    mapping(bytes32 => ModelUpdate) public modelUpdates;
    EnumerableSet.Bytes32Set private pendingUpdates;
    
    // Enhanced oracle management
    struct OracleInfo {
        address oracleAddress;
        uint256 reputation; // Reputation score (0-100)
        uint256 assessmentsCount; // Number of assessments performed
        uint256 lastActive; // Last activity timestamp
        bool isActive;
    }
    
    mapping(address => OracleInfo) public oracleInfo;
    uint256 public minRequiredSignatures;
    
    // Enhanced rate and collateral factors
    struct AssetRiskProfile {
        uint256 baseCollateralFactor; // Base collateral factor (0-100)
        int256 dynamicAdjustment; // Dynamic adjustment based on market conditions
        uint256 volatilityIndex; // Volatility measure (0-100)
        uint256 liquidityIndex; // Liquidity measure (0-100)
        uint256 lastUpdated; // Last update timestamp
    }
    
    mapping(address => mapping(address => AssetRiskProfile)) private assetRiskProfiles; // user => asset => profile
    mapping(address => int256) private userRateAdjustments; // User => rate adjustment
    
    // Time series data for risk trends
    struct RiskDataPoint {
        uint256 timestamp;
        uint256 riskScore;
        bytes extraData; // Additional data for analysis
    }
    
    mapping(address => RiskDataPoint[]) private userRiskHistory;
    uint256 public constant MAX_HISTORY_POINTS = 100; // Maximum history points to store per user
    
    // Anomaly detection thresholds
    uint256 public anomalyDetectionThreshold = 80; // Threshold for triggering anomaly detection (0-100)
    uint256 public confidenceThreshold = 60; // Minimum confidence for score updates (0-100)
    
    // Events from the interface and new enhanced events
    event ModelUpdateSubmitted(bytes32 indexed updateId, address indexed participant, bytes32 indexed modelId);
    event ModelUpdateAccepted(bytes32 indexed updateId, address indexed participant, bytes32 indexed modelId);
    event ModelUpdateRejected(bytes32 indexed updateId, address indexed participant, bytes32 indexed modelId);
    event ModelAggregated(bytes32 indexed oldModelId, bytes32 indexed newModelId, uint256 updateCount);
    event AnomalyDetected(address indexed user, uint256 anomalyScore, uint256 timestamp);
    event FederatedParticipantAdded(address indexed participant, uint256 timestamp);
    event FederatedParticipantRemoved(address indexed participant, uint256 timestamp);
    event RiskExplainabilityUpdated(address indexed user, bytes32 explainabilityRoot, uint256 timestamp);
    
    /**
     * @dev Constructor to initialize the enhanced risk assessment system
     * @param _initialOracles Initial set of oracle addresses
     * @param _minSignatures Minimum number of oracle signatures required for updates
     * @param _modelId Initial model identifier
     * @param _modelVersion Initial model version
     * @param _modelHash Hash of the initial model
     * @param _datasetHash Hash of the initial training dataset
     */
    constructor(
        address[] memory _initialOracles,
        uint256 _minSignatures,
        bytes32 _modelId,
        uint256 _modelVersion,
        bytes32 _modelHash,
        bytes32 _datasetHash
    ) {
        require(_initialOracles.length >= _minSignatures, "Min signatures must be <= oracle count");
        require(_minSignatures > 0, "Min signatures must be > 0");
        
        for (uint256 i = 0; i < _initialOracles.length; i++) {
            authorizedOracles.add(_initialOracles[i]);
            
            // Initialize oracle info
            oracleInfo[_initialOracles[i]] = OracleInfo({
                oracleAddress: _initialOracles[i],
                reputation: 80, // Start with decent reputation
                assessmentsCount: 0,
                lastActive: block.timestamp,
                isActive: true
            });
        }
        
        minRequiredSignatures = _minSignatures;
        
        // Initialize the model
        currentModel = ModelInfo({
            modelId: _modelId,
            version: _modelVersion,
            deploymentTime: block.timestamp,
            modelHash: _modelHash,
            datasetHash: _datasetHash,
            accuracy: 85, // Initial accuracy (placeholder)
            f1Score: 80, // Initial F1 score (placeholder)
            metadataURI: "" // No metadata URI yet
        });
        
        // Store in history
        modelHistory[_modelId] = currentModel;
        modelVersions.add(_modelId);
        
        emit RiskModelUpdated(_modelId, _modelVersion, block.timestamp);
    }
    
    /**
     * @dev Modifier to restrict access to authorized oracles
     */
    modifier onlyOracle() {
        require(authorizedOracles.contains(msg.sender), "Caller is not an authorized oracle");
        
        // Update oracle activity timestamp
        oracleInfo[msg.sender].lastActive = block.timestamp;
        _;
    }
    
    /**
     * @dev Modifier to restrict access to federated learning participants
     */
    modifier onlyFederatedParticipant() {
        require(federatedLearningParticipants.contains(msg.sender), "Caller is not a federated learning participant");
        _;
    }
    
    /**
     * @dev Returns the current risk score for a user with enhanced data
     * @param user The address of the user
     * @return score The risk score (0-100, where 0 is lowest risk and 100 is highest)
     * @return confidence The confidence score of the prediction (0-100)
     * @return timestamp When the score was last updated
     */
    function getUserRiskScoreEnhanced(address user) external view returns (
        uint256 score,
        uint256 confidence,
        uint256 timestamp
    ) {
        EnhancedRiskMetrics storage metrics = userEnhancedMetrics[user];
        return (
            userRiskScores[user],
            metrics.confidenceScore > 0 ? metrics.confidenceScore : 70, // Default confidence
            lastAssessmentTimes[user]
        );
    }
    
    /**
     * @dev Returns the current risk score for a user
     * @param user The address of the user
     * @return score The risk score (0-100, where 0 is lowest risk and 100 is highest)
     */
    function getUserRiskScore(address user) external view override returns (uint256 score) {
        return userRiskScores[user];
    }
    
    /**
     * @dev Requests an assessment of a user's risk profile with enhanced data
     * @param user The address of the user to assess
     * @param dataURI URI pointing to additional data for assessment (optional)
     * @param requestType Type of assessment requested (normal, deep, emergency)
     * @return requestId The unique identifier for this assessment request
     */
    function assessUserRiskEnhanced(
        address user,
        string calldata dataURI,
        uint8 requestType
    ) external returns (bytes32 requestId) {
        // Generate a unique request ID
        requestId = keccak256(abi.encodePacked(user, block.timestamp, block.number, dataURI, requestType));
        
        // Emit the enhanced assessment request event
        emit RiskAssessmentRequested(user, requestId, block.timestamp);
        
        return requestId;
    }
    
    /**
     * @dev Requests an assessment of a user's risk profile
     * @param user The address of the user to assess
     * @return requestId The unique identifier for this assessment request
     */
    function assessUserRisk(address user) external override returns (bytes32 requestId) {
        // Generate a unique request ID
        requestId = keccak256(abi.encodePacked(user, block.timestamp, block.number));
        
        // Emit the assessment request event
        emit RiskAssessmentRequested(user, requestId, block.timestamp);
        
        return requestId;
    }
    
    /**
     * @dev Updates a user's risk score with enhanced explainability and confidence data
     * @param user The address of the user
     * @param score The new risk score (0-100)
     * @param confidence The confidence score (0-100)
     * @param anomalyScore The anomaly detection score (0-100)
     * @param explainabilityRoot Merkle root for feature importance
     * @param featureKeys Keys for important features
     * @param featureValues Importance values for features
     * @param extraData Additional risk metrics encoded as bytes
     * @return success Whether the update was successful
     */
    function updateUserRiskScoreEnhanced(
        address user,
        uint256 score,
        uint256 confidence,
        uint256 anomalyScore,
        bytes32 explainabilityRoot,
        bytes32[] calldata featureKeys,
        int256[] calldata featureValues,
        bytes calldata extraData
    ) external onlyOracle whenNotPaused returns (bool success) {
        require(score <= 100, "Score must be between 0 and 100");
        require(confidence <= 100, "Confidence must be between 0 and 100");
        require(anomalyScore <= 100, "Anomaly score must be between 0 and 100");
        require(featureKeys.length == featureValues.length, "Feature arrays length mismatch");
        require(confidence >= confidenceThreshold, "Confidence below threshold");
        
        // Store old score for the event
        uint256 oldScore = userRiskScores[user];
        
        // Update user's risk score
        userRiskScores[user] = score;
        lastAssessmentTimes[user] = block.timestamp;
        
        // Update enhanced metrics
        EnhancedRiskMetrics storage metrics = userEnhancedMetrics[user];
        metrics.overallScore = score;
        metrics.anomalyScore = anomalyScore;
        metrics.confidenceScore = confidence;
        metrics.explainabilityRoot = explainabilityRoot;
        metrics.lastUpdated = block.timestamp;
        
        // Store feature importance values
        for (uint256 i = 0; i < featureKeys.length; i++) {
            metrics.featureImportance[featureKeys[i]] = featureValues[i];
        }
        
        // Parse additional risk metrics if provided
        if (extraData.length > 0) {
            // Decode the enhanced data - expected format is:
            // (
            //    uint256 repaymentScore,
            //    uint256 collateralScore,
            //    uint256 volatilityScore,
            //    uint256 activityScore,
            //    uint256 crossChainActivityScore,
            //    uint256 identityScore,
            //    uint256 marketCorrelationScore,
            //    int256 rateAdjustment
            // )
            (
                uint256 repaymentScore,
                uint256 collateralScore,
                uint256 volatilityScore,
                uint256 activityScore,
                uint256 crossChainActivityScore,
                uint256 identityScore,
                uint256 marketCorrelationScore,
                int256 rateAdjustment
            ) = abi.decode(extraData, (
                uint256, uint256, uint256, uint256, uint256, uint256, uint256, int256
            ));
            
            // Update detailed metrics
            metrics.repaymentScore = repaymentScore;
            metrics.collateralScore = collateralScore;
            metrics.volatilityScore = volatilityScore;
            metrics.activityScore = activityScore;
            metrics.crossChainActivityScore = crossChainActivityScore;
            metrics.identityScore = identityScore;
            metrics.marketCorrelationScore = marketCorrelationScore;
            
            // Update rate adjustment
            userRateAdjustments[user] = rateAdjustment;
        }
        
        // Add to risk history
        _addRiskHistoryPoint(user, score, extraData);
        
        // Check for anomalies
        if (anomalyScore >= anomalyDetectionThreshold) {
            emit AnomalyDetected(user, anomalyScore, block.timestamp);
        }
        
        // Emit events
        emit RiskScoreUpdated(user, oldScore, score, block.timestamp);
        emit RiskExplainabilityUpdated(user, explainabilityRoot, block.timestamp);
        
        // Update oracle reputation and count
        oracleInfo[msg.sender].assessmentsCount = oracleInfo[msg.sender].assessmentsCount.add(1);
        
        return true;
    }
    
    /**
     * @dev Updates a user's risk score
     * @param user The address of the user
     * @param score The new risk score (0-100)
     * @param data Additional data used in the risk assessment
     * @return success Whether the update was successful
     */
    function updateUserRiskScore(
        address user, 
        uint256 score, 
        bytes calldata data
    ) external override onlyOracle whenNotPaused returns (bool success) {
        require(score <= 100, "Score must be between 0 and 100");
        
        // Store old score for the event
        uint256 oldScore = userRiskScores[user];
        
        // Update user's risk score
        userRiskScores[user] = score;
        lastAssessmentTimes[user] = block.timestamp;
        
        // Parse additional risk metrics if provided
        if (data.length > 0) {
            // Decode the data - expected format is:
            // (uint256 repaymentScore, uint256 collateralScore, uint256 volatilityScore, uint256 activityScore, int256 rateAdjustment)
            (
                uint256 repaymentScore,
                uint256 collateralScore,
                uint256 volatilityScore,
                uint256 activityScore,
                int256 rateAdjustment
            ) = abi.decode(data, (uint256, uint256, uint256, uint256, int256));
            
            // Update risk metrics (legacy format)
            EnhancedRiskMetrics storage metrics = userEnhancedMetrics[user];
            metrics.overallScore = score;
            metrics.repaymentScore = repaymentScore;
            metrics.collateralScore = collateralScore;
            metrics.volatilityScore = volatilityScore;
            metrics.activityScore = activityScore;
            metrics.lastUpdated = block.timestamp;
            
            // Set reasonable defaults for enhanced metrics
            metrics.crossChainActivityScore = 50;
            metrics.identityScore = 50;
            metrics.marketCorrelationScore = 50;
            metrics.confidenceScore = 70;
            metrics.anomalyScore = 20;
            
            // Update rate adjustment
            userRateAdjustments[user] = rateAdjustment;
        }
        
        // Add to risk history
        _addRiskHistoryPoint(user, score, data);
        
        // Emit the risk score update event
        emit RiskScoreUpdated(user, oldScore, score, block.timestamp);
        
        // Update oracle reputation and count
        oracleInfo[msg.sender].assessmentsCount = oracleInfo[msg.sender].assessmentsCount.add(1);
        
        return true;
    }
    
    /**
     * @dev Add a risk history data point for a user
     * @param user The address of the user
     * @param score The risk score
     * @param extraData Additional data
     */
    function _addRiskHistoryPoint(address user, uint256 score, bytes memory extraData) internal {
        RiskDataPoint[] storage history = userRiskHistory[user];
        
        // Add new data point
        if (history.length >= MAX_HISTORY_POINTS) {
            // Shift array to remove oldest point
            for (uint256 i = 0; i < history.length - 1; i++) {
                history[i] = history[i + 1];
            }
            // Replace last element
            history[history.length - 1] = RiskDataPoint({
                timestamp: block.timestamp,
                riskScore: score,
                extraData: extraData
            });
        } else {
            // Add new point
            history.push(RiskDataPoint({
                timestamp: block.timestamp,
                riskScore: score,
                extraData: extraData
            }));
        }
    }
    
    /**
     * @dev Get risk score history for a user
     * @param user The address of the user
     * @param maxPoints Maximum number of points to return (0 for all)
     * @return timestamps Array of timestamps
     * @return scores Array of risk scores
     */
    function getRiskHistory(address user, uint256 maxPoints) external view returns (
        uint256[] memory timestamps,
        uint256[] memory scores
    ) {
        RiskDataPoint[] storage history = userRiskHistory[user];
        uint256 count = maxPoints > 0 ? Math.min(maxPoints, history.length) : history.length;
        
        timestamps = new uint256[](count);
        scores = new uint256[](count);
        
        // Fill arrays from newest to oldest
        for (uint256 i = 0; i < count; i++) {
            uint256 index = history.length - 1 - i;
            timestamps[i] = history[index].timestamp;
            scores[i] = history[index].riskScore;
        }
        
        return (timestamps, scores);
    }
    
    /**
     * @dev Submit a federated learning model update
     * @param modelId Target model ID
     * @param gradientsHash Hash of the gradients
     * @param dataPointsCount Number of data points used
     * @param signature Signature of the participant
     * @return updateId The ID of the submitted update
     */
    function submitModelUpdate(
        bytes32 modelId,
        bytes32 gradientsHash,
        uint256 dataPointsCount,
        bytes calldata signature
    ) external onlyFederatedParticipant whenNotPaused returns (bytes32 updateId) {
        require(modelId == currentModel.modelId, "Model ID mismatch");
        
        // Verify signature (signed message = keccak256(modelId, gradientsHash, dataPointsCount))
        bytes32 messageHash = keccak256(abi.encodePacked(modelId, gradientsHash, dataPointsCount));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address signer = ethSignedMessageHash.recover(signature);
        
        require(signer == msg.sender, "Invalid signature");
        
        // Generate update ID
        updateId = keccak256(abi.encodePacked(
            modelId,
            gradientsHash,
            msg.sender,
            block.timestamp
        ));
        
        // Store update
        modelUpdates[updateId] = ModelUpdate({
            updateId: updateId,
            participant: msg.sender,
            modelId: modelId,
            gradientsHash: gradientsHash,
            timestamp: block.timestamp,
            accepted: false,
            weight: dataPointsCount // Weight based on number of data points
        });
        
        // Add to pending updates
        pendingUpdates.add(updateId);
        
        emit ModelUpdateSubmitted(updateId, msg.sender, modelId);
        
        return updateId;
    }
    
    /**
     * @dev Process federated learning updates and aggregate into a new model
     * @param updateIds IDs of the updates to process
     * @param newModelId ID for the new model
     * @param newModelHash Hash of the new model weights
     * @param newAccuracy Accuracy of the new model
     * @param newF1Score F1 score of the new model
     * @param metadataURI URI for model metadata
     * @return success Whether the aggregation was successful
     */
    function aggregateModelUpdates(
        bytes32[] calldata updateIds,
        bytes32 newModelId,
        bytes32 newModelHash,
        uint256 newAccuracy,
        uint256 newF1Score,
        string calldata metadataURI
    ) external onlyOwner whenNotPaused returns (bool success) {
        require(updateIds.length > 0, "No updates to process");
        require(newAccuracy <= 100, "Accuracy must be 0-100");
        require(newF1Score <= 100, "F1 score must be 0-100");
        
        // Process each update
        for (uint256 i = 0; i < updateIds.length; i++) {
            bytes32 updateId = updateIds[i];
            require(pendingUpdates.contains(updateId), "Update not pending");
            
            ModelUpdate storage update = modelUpdates[updateId];
            update.accepted = true;
            
            // Remove from pending updates
            pendingUpdates.remove(updateId);
            
            emit ModelUpdateAccepted(updateId, update.participant, update.modelId);
        }
        
        // Create new model version
        ModelInfo memory newModel = ModelInfo({
            modelId: newModelId,
            version: currentModel.version + 1,
            deploymentTime: block.timestamp,
            modelHash: newModelHash,
            datasetHash: currentModel.datasetHash, // Keep same dataset hash
            accuracy: newAccuracy,
            f1Score: newF1Score,
            metadataURI: metadataURI
        });
        
        // Store old model ID
        bytes32 oldModelId = currentModel.modelId;
        
        // Update current model
        currentModel = newModel;
        
        // Add to history
        modelHistory[newModelId] = newModel;
        modelVersions.add(newModelId);
        
        emit RiskModelUpdated(newModelId, newModel.version, block.timestamp);
        emit ModelAggregated(oldModelId, newModelId, updateIds.length);
        
        return true;
    }
    
    /**
     * @dev Reject a federated learning update
     * @param updateId ID of the update to reject
     * @param reason Reason code for rejection
     * @return success Whether the rejection was successful
     */
    function rejectModelUpdate(bytes32 updateId, uint8 reason) external onlyOwner returns (bool success) {
        require(pendingUpdates.contains(updateId), "Update not pending");
        
        ModelUpdate storage update = modelUpdates[updateId];
        pendingUpdates.remove(updateId);
        
        emit ModelUpdateRejected(updateId, update.participant, update.modelId);
        
        return true;
    }
    
    /**
     * @dev Add a participant to the federated learning system
     * @param participant The address of the participant to add
     */
    function addFederatedParticipant(address participant) external onlyOwner {
        require(!federatedLearningParticipants.contains(participant), "Participant already exists");
        federatedLearningParticipants.add(participant);
        
        emit FederatedParticipantAdded(participant, block.timestamp);
    }
    
    /**
     * @dev Remove a participant from the federated learning system
     * @param participant The address of the participant to remove
     */
    function removeFederatedParticipant(address participant) external onlyOwner {
        require(federatedLearningParticipants.contains(participant), "Participant does not exist");
        federatedLearningParticipants.remove(participant);
        
        emit FederatedParticipantRemoved(participant, block.timestamp);
    }
    
    /**
     * @dev Returns the timestamp of the last risk assessment for a user
     * @param user The address of the user
     * @return timestamp The timestamp of the last assessment
     */
    function getLastAssessmentTime(address user) external view override returns (uint256 timestamp) {
        return lastAssessmentTimes[user];
    }
    
    /**
     * @dev Returns the current version of the risk model
     * @return modelId The identifier of the risk model
     * @return version The current version of the model
     * @return lastUpdated The timestamp of the last model update
     */
    function getRiskModelInfo() external view override returns (
        bytes32 modelId,
        uint256 version,
        uint256 lastUpdated
    ) {
        return (currentModel.modelId, currentModel.version, currentModel.deploymentTime);
    }
    
    /**
     * @dev Get enhanced model information
     * @return modelId The model ID
     * @return version The model version
     * @return deploymentTime When the model was deployed
     * @return modelHash Hash of the model
     * @return accuracy Model accuracy
     * @return f1Score Model F1 score
     * @return metadataURI URI to model metadata
     */
    function getEnhancedModelInfo() external view returns (
        bytes32 modelId,
        uint256 version,
        uint256 deploymentTime,
        bytes32 modelHash,
        uint256 accuracy,
        uint256 f1Score,
        string memory metadataURI
    ) {
        return (
            currentModel.modelId,
            currentModel.version,
            currentModel.deploymentTime,
            currentModel.modelHash,
            currentModel.accuracy,
            currentModel.f1Score,
            currentModel.metadataURI
        );
    }
    
    /**
     * @dev Returns detailed risk metrics for a user
     * @param user The address of the user
     * @return overallScore The overall risk score (0-100)
     * @return repaymentScore The repayment history score component (0-100)
     * @return collateralScore The collateral quality score component (0-100)
     * @return volatilityScore The wallet volatility score component (0-100)
     * @return activityScore The on-chain activity score component (0-100)
     */
    function getUserRiskMetrics(address user) external view override returns (
        uint256 overallScore,
        uint256 repaymentScore,
        uint256 collateralScore,
        uint256 volatilityScore,
        uint256 activityScore
    ) {
        EnhancedRiskMetrics storage metrics = userEnhancedMetrics[user];
        
        // If user has no detailed metrics yet, use the overall score for all components
        if (metrics.lastUpdated == 0) {
            uint256 score = userRiskScores[user];
            return (score, score, score, score, score);
        }
        
        return (
            metrics.overallScore,
            metrics.repaymentScore,
            metrics.collateralScore,
            metrics.volatilityScore,
            metrics.activityScore
        );
    }
    
    /**
     * @dev Get enhanced risk metrics for a user
     * @param user The address of the user
     * @return metrics Array of metric values:
     *   [0] = overallScore
     *   [1] = repaymentScore
     *   [2] = collateralScore
     *   [3] = volatilityScore
     *   [4] = activityScore
     *   [5] = crossChainActivityScore
     *   [6] = identityScore
     *   [7] = marketCorrelationScore
     *   [8] = anomalyScore
     *   [9] = confidenceScore
     * @return lastUpdated Timestamp of last update
     * @return explainabilityRoot Merkle root for explainability
     */
    function getEnhancedRiskMetrics(address user) external view returns (
        uint256[10] memory metrics,
        uint256 lastUpdated,
        bytes32 explainabilityRoot
    ) {
        EnhancedRiskMetrics storage userMetrics = userEnhancedMetrics[user];
        
        // If user has no detailed metrics yet, use the overall score for all components
        if (userMetrics.lastUpdated == 0) {
            uint256 score = userRiskScores[user];
            metrics[0] = score; // overallScore
            metrics[1] = score; // repaymentScore
            metrics[2] = score; // collateralScore
            metrics[3] = score; // volatilityScore
            metrics[4] = score; // activityScore
            metrics[5] = 50;    // crossChainActivityScore (default)
            metrics[6] = 50;    // identityScore (default)
            metrics[7] = 50;    // marketCorrelationScore (default)
            metrics[8] = 20;    // anomalyScore (default)
            metrics[9] = 70;    // confidenceScore (default)
            lastUpdated = lastAssessmentTimes[user];
            explainabilityRoot = bytes32(0);
        } else {
            metrics[0] = userMetrics.overallScore;
            metrics[1] = userMetrics.repaymentScore;
            metrics[2] = userMetrics.collateralScore;
            metrics[3] = userMetrics.volatilityScore;
            metrics[4] = userMetrics.activityScore;
            metrics[5] = userMetrics.crossChainActivityScore;
            metrics[6] = userMetrics.identityScore;
            metrics[7] = userMetrics.marketCorrelationScore;
            metrics[8] = userMetrics.anomalyScore;
            metrics[9] = userMetrics.confidenceScore;
            lastUpdated = userMetrics.lastUpdated;
            explainabilityRoot = userMetrics.explainabilityRoot;
        }
        
        return (metrics, lastUpdated, explainabilityRoot);
    }
    
    /**
     * @dev Verify an explainability proof for a feature
     * @param user The address of the user
     * @param featureKey The feature key
     * @param featureValue The feature importance value
     * @param proof Merkle proof verifying the feature
     * @return isValid Whether the proof is valid
     */
    function verifyFeatureImportance(
        address user,
        bytes32 featureKey,
        int256 featureValue,
        bytes32[] calldata proof
    ) external view returns (bool isValid) {
        EnhancedRiskMetrics storage metrics = userEnhancedMetrics[user];
        if (metrics.explainabilityRoot == bytes32(0)) return false;
        
        // Create leaf node
        bytes32 leaf = keccak256(abi.encodePacked(featureKey, featureValue));
        
        // Verify the proof
        return MerkleProof.verify(proof, metrics.explainabilityRoot, leaf);
    }
    
    /**
     * @dev Get feature importance for a specific feature
     * @param user The address of the user
     * @param featureKey The feature key
     * @return importance The importance value for the feature
     */
    function getFeatureImportance(address user, bytes32 featureKey) external view returns (int256 importance) {
        return userEnhancedMetrics[user].featureImportance[featureKey];
    }
    
    /**
     * @dev Returns the recommended interest rate adjustment based on risk
     * @param user The address of the user
     * @return adjustment The recommended interest rate adjustment (in basis points)
     */
    function getRecommendedRateAdjustment(address user) external view override returns (int256 adjustment) {
        return userRateAdjustments[user];
    }
    
    /**
     * @dev Returns the recommended collateral factor based on risk
     * @param user The address of the user
     * @param asset The address of the collateral asset
     * @return factor The recommended collateral factor (0-100, representing 0-100%)
     */
    function getRecommendedCollateralFactor(
        address user, 
        address asset
    ) external view override returns (uint256 factor) {
        AssetRiskProfile storage profile = assetRiskProfiles[user][asset];
        
        // If asset has a custom profile, use that
        if (profile.lastUpdated > 0) {
            int256 adjustedFactor = int256(profile.baseCollateralFactor) + profile.dynamicAdjustment;
            
            // Ensure it's within valid range
            if (adjustedFactor < 0) return 0;
            if (adjustedFactor > 90) return 90;
            return uint256(adjustedFactor);
        }
        
        // Otherwise, calculate based on risk score
        uint256 riskScore = userRiskScores[user];
        
        // Higher risk = lower collateral factor (higher collateral requirement)
        // Base collateral factor is 75%, reduced by up to 25% for high risk
        if (riskScore <= 20) {
            return 75; // Very low risk: 75%
        } else if (riskScore <= 40) {
            return 70; // Low risk: 70%
        } else if (riskScore <= 60) {
            return 65; // Medium risk: 65%
        } else if (riskScore <= 80) {
            return 60; // High risk: 60%
        } else {
            return 50; // Very high risk: 50%
        }
    }
    
    /**
     * @dev Updates a user's asset risk profile
     * @param user The address of the user
     * @param asset The address of the asset
     * @param baseCollateralFactor Base collateral factor (0-100)
     * @param dynamicAdjustment Dynamic adjustment (-50 to +10)
     * @param volatilityIndex Volatility measure (0-100)
     * @param liquidityIndex Liquidity measure (0-100)
     */
    function updateAssetRiskProfile(
        address user,
        address asset,
        uint256 baseCollateralFactor,
        int256 dynamicAdjustment,
        uint256 volatilityIndex,
        uint256 liquidityIndex
    ) external onlyOracle whenNotPaused {
        require(baseCollateralFactor <= 90, "Base factor must be <= 90%");
        require(dynamicAdjustment >= -50 && dynamicAdjustment <= 10, "Invalid adjustment range");
        require(volatilityIndex <= 100, "Volatility must be 0-100");
        require(liquidityIndex <= 100, "Liquidity must be 0-100");
        
        assetRiskProfiles[user][asset] = AssetRiskProfile({
            baseCollateralFactor: baseCollateralFactor,
            dynamicAdjustment: dynamicAdjustment,
            volatilityIndex: volatilityIndex,
            liquidityIndex: liquidityIndex,
            lastUpdated: block.timestamp
        });
    }
    
    /**
     * @dev Get asset risk profile
     * @param user The address of the user
     * @param asset The address of the asset
     * @return baseCollateralFactor Base collateral factor
     * @return dynamicAdjustment Dynamic adjustment
     * @return volatilityIndex Volatility index
     * @return liquidityIndex Liquidity index
     * @return lastUpdated Timestamp of last update
     */
    function getAssetRiskProfile(address user, address asset) external view returns (
        uint256 baseCollateralFactor,
        int256 dynamicAdjustment,
        uint256 volatilityIndex,
        uint256 liquidityIndex,
        uint256 lastUpdated
    ) {
        AssetRiskProfile storage profile = assetRiskProfiles[user][asset];
        return (
            profile.baseCollateralFactor,
            profile.dynamicAdjustment,
            profile.volatilityIndex,
            profile.liquidityIndex,
            profile.lastUpdated
        );
    }
    
    /**
     * @dev Updates the risk model information
     * @param newModelId The new model identifier
     * @param newVersion The new model version
     * @param modelHash Hash of the model
     * @param datasetHash Hash of the training dataset
     * @param accuracy Model accuracy (0-100)
     * @param f1Score Model F1 score (0-100)
     * @param metadataURI URI to model metadata
     */
    function updateRiskModel(
        bytes32 newModelId, 
        uint256 newVersion,
        bytes32 modelHash,
        bytes32 datasetHash,
        uint256 accuracy,
        uint256 f1Score,
        string calldata metadataURI
    ) external onlyOwner {
        require(accuracy <= 100, "Accuracy must be 0-100");
        require(f1Score <= 100, "F1 score must be 0-100");
        
        // Create new model info
        ModelInfo memory newModel = ModelInfo({
            modelId: newModelId,
            version: newVersion,
            deploymentTime: block.timestamp,
            modelHash: modelHash,
            datasetHash: datasetHash,
            accuracy: accuracy,
            f1Score: f1Score,
            metadataURI: metadataURI
        });
        
        // Update current model
        currentModel = newModel;
        
        // Add to history
        modelHistory[newModelId] = newModel;
        modelVersions.add(newModelId);
        
        emit RiskModelUpdated(newModelId, newVersion, block.timestamp);
    }
    
    /**
     * @dev Adds a new oracle
     * @param oracle The address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
        require(!authorizedOracles.contains(oracle), "Oracle already exists");
        authorizedOracles.add(oracle);
        
        // Initialize oracle info
        oracleInfo[oracle] = OracleInfo({
            oracleAddress: oracle,
            reputation: 80, // Start with decent reputation
            assessmentsCount: 0,
            lastActive: block.timestamp,
            isActive: true
        });
    }
    
    /**
     * @dev Removes an oracle
     * @param oracle The address of the oracle to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles.contains(oracle), "Oracle does not exist");
        require(authorizedOracles.length() > minRequiredSignatures, "Cannot remove oracle: minimum count would not be met");
        
        authorizedOracles.remove(oracle);
        oracleInfo[oracle].isActive = false;
    }
    
    /**
     * @dev Updates the minimum required signatures
     * @param newMinSignatures The new minimum number of signatures
     */
    function updateMinRequiredSignatures(uint256 newMinSignatures) external onlyOwner {
        require(newMinSignatures > 0, "Min signatures must be > 0");
        require(newMinSignatures <= authorizedOracles.length(), "Min signatures must be <= oracle count");
        
        minRequiredSignatures = newMinSignatures;
    }
    
    /**
     * @dev Update anomaly detection threshold
     * @param newThreshold New threshold (0-100)
     */
    function updateAnomalyThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold <= 100, "Threshold must be 0-100");
        anomalyDetectionThreshold = newThreshold;
    }
    
    /**
     * @dev Update confidence threshold
     * @param newThreshold New threshold (0-100)
     */
    function updateConfidenceThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold <= 100, "Threshold must be 0-100");
        confidenceThreshold = newThreshold;
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Checks if an address is an authorized oracle
     * @param oracle The address to check
     * @return isOracle Whether the address is an authorized oracle
     */
    function isAuthorizedOracle(address oracle) external view returns (bool isOracle) {
        return authorizedOracles.contains(oracle);
    }
    
    /**
     * @dev Gets all authorized oracle addresses
     * @return oracles Array of authorized oracle addresses
     */
    function getOracleAddresses() external view returns (address[] memory oracles) {
        uint256 count = authorizedOracles.length();
        oracles = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            oracles[i] = authorizedOracles.at(i);
        }
        
        return oracles;
    }
    
    /**
     * @dev Gets all federated learning participants
     * @return participants Array of participant addresses
     */
    function getFederatedParticipants() external view returns (address[] memory participants) {
        uint256 count = federatedLearningParticipants.length();
        participants = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            participants[i] = federatedLearningParticipants.at(i);
        }
        
        return participants;
    }
    
    /**
     * @dev Get all pending model updates
     * @return updateIds Array of update IDs
     */
    function getPendingModelUpdates() external view returns (bytes32[] memory updateIds) {
        uint256 count = pendingUpdates.length();
        updateIds = new bytes32[](count);
        
        for (uint256 i = 0; i < count; i++) {
            updateIds[i] = pendingUpdates.at(i);
        }
        
        return updateIds;
    }
    
    /**
     * @dev Get all model versions
     * @return versions Array of model IDs
     */
    function getModelVersions() external view returns (bytes32[] memory versions) {
        uint256 count = modelVersions.length();
        versions = new bytes32[](count);
        
        for (uint256 i = 0; i < count; i++) {
            versions[i] = modelVersions.at(i);
        }
        
        return versions;
    }
}
