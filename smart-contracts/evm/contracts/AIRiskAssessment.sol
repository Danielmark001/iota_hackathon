// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "../interfaces/IAIRiskAssessment.sol";

/**
 * @title AIRiskAssessment
 * @dev Implementation of the AI-powered risk assessment system
 * @notice This contract bridges the AI model with the blockchain by managing risk scores
 */
contract AIRiskAssessment is IAIRiskAssessment, Ownable, Pausable {
    using ECDSA for bytes32;

    // State variables
    mapping(address => uint256) private userRiskScores;
    mapping(address => uint256) private lastAssessmentTimes;
    mapping(address => bool) private authorizedOracles;
    
    // Risk metrics for each user
    mapping(address => RiskMetrics) private userRiskMetrics;
    
    // Model information
    bytes32 public currentModelId;
    uint256 public currentModelVersion;
    uint256 public lastModelUpdate;
    
    // Pending assessments
    mapping(bytes32 => bool) private pendingAssessments;
    mapping(bytes32 => address) private assessmentToUser;
    
    // Oracle addresses
    address[] private oracleAddresses;
    uint256 public minRequiredSignatures;
    
    // Recommended rate and collateral adjustments
    mapping(address => int256) private recommendedRateAdjustments;
    mapping(address => mapping(address => uint256)) private recommendedCollateralFactors;
    
    // Struct to store detailed risk metrics
    struct RiskMetrics {
        uint256 overallScore;
        uint256 repaymentScore;
        uint256 collateralScore;
        uint256 volatilityScore;
        uint256 activityScore;
        uint256 lastUpdated;
    }
    
    // Events from the interface are inherited
    
    /**
     * @dev Constructor to initialize the risk assessment system
     * @param _initialOracles Initial set of oracle addresses
     * @param _minSignatures Minimum number of oracle signatures required for updates
     * @param _modelId Initial model identifier
     * @param _modelVersion Initial model version
     */
    constructor(
        address[] memory _initialOracles,
        uint256 _minSignatures,
        bytes32 _modelId,
        uint256 _modelVersion
    ) {
        require(_initialOracles.length >= _minSignatures, "Min signatures must be <= oracle count");
        require(_minSignatures > 0, "Min signatures must be > 0");
        
        oracleAddresses = _initialOracles;
        minRequiredSignatures = _minSignatures;
        
        for (uint256 i = 0; i < _initialOracles.length; i++) {
            authorizedOracles[_initialOracles[i]] = true;
        }
        
        currentModelId = _modelId;
        currentModelVersion = _modelVersion;
        lastModelUpdate = block.timestamp;
    }
    
    /**
     * @dev Modifier to restrict access to authorized oracles
     */
    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Caller is not an authorized oracle");
        _;
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
     * @dev Requests an assessment of a user's risk profile
     * @param user The address of the user to assess
     * @return requestId The unique identifier for this assessment request
     */
    function assessUserRisk(address user) external override returns (bytes32 requestId) {
        // Generate a unique request ID
        requestId = keccak256(abi.encodePacked(user, block.timestamp, block.number));
        
        // Store the pending assessment
        pendingAssessments[requestId] = true;
        assessmentToUser[requestId] = user;
        
        // Emit the assessment request event
        emit RiskAssessmentRequested(user, requestId, block.timestamp);
        
        return requestId;
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
            
            // Update risk metrics
            userRiskMetrics[user] = RiskMetrics({
                overallScore: score,
                repaymentScore: repaymentScore,
                collateralScore: collateralScore,
                volatilityScore: volatilityScore,
                activityScore: activityScore,
                lastUpdated: block.timestamp
            });
            
            // Update recommended rate adjustment
            recommendedRateAdjustments[user] = rateAdjustment;
        }
        
        // Emit the risk score update event
        emit RiskScoreUpdated(user, oldScore, score, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Updates a user's risk score with multiple oracle signatures
     * @param user The address of the user
     * @param score The new risk score (0-100)
     * @param requestId The request ID of the assessment
     * @param data Additional data used in the risk assessment
     * @param signatures Array of signatures from authorized oracles
     * @return success Whether the update was successful
     */
    function updateUserRiskScoreWithSignatures(
        address user,
        uint256 score,
        bytes32 requestId,
        bytes calldata data,
        bytes[] calldata signatures
    ) external whenNotPaused returns (bool success) {
        require(score <= 100, "Score must be between 0 and 100");
        require(pendingAssessments[requestId], "Assessment request not found or already processed");
        require(assessmentToUser[requestId] == user, "User does not match request");
        require(signatures.length >= minRequiredSignatures, "Not enough signatures");
        
        // Hash the message that was signed
        bytes32 messageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(requestId, user, score, this.updateUserRiskScoreWithSignatures.selector))
        ));
        
        // Verify signatures
        address[] memory signers = new address[](signatures.length);
        uint256 validSignatureCount = 0;
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = messageHash.recover(signatures[i]);
            
            // Check if this is a valid oracle and not a duplicate
            if (authorizedOracles[signer]) {
                bool isDuplicate = false;
                for (uint256 j = 0; j < validSignatureCount; j++) {
                    if (signers[j] == signer) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (!isDuplicate) {
                    signers[validSignatureCount] = signer;
                    validSignatureCount++;
                }
            }
        }
        
        require(validSignatureCount >= minRequiredSignatures, "Not enough valid signatures");
        
        // Store old score for the event
        uint256 oldScore = userRiskScores[user];
        
        // Update user's risk score
        userRiskScores[user] = score;
        lastAssessmentTimes[user] = block.timestamp;
        
        // Mark the assessment as processed
        pendingAssessments[requestId] = false;
        
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
            
            // Update risk metrics
            userRiskMetrics[user] = RiskMetrics({
                overallScore: score,
                repaymentScore: repaymentScore,
                collateralScore: collateralScore,
                volatilityScore: volatilityScore,
                activityScore: activityScore,
                lastUpdated: block.timestamp
            });
            
            // Update recommended rate adjustment
            recommendedRateAdjustments[user] = rateAdjustment;
        }
        
        // Emit the risk score update event
        emit RiskScoreUpdated(user, oldScore, score, block.timestamp);
        
        return true;
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
        return (currentModelId, currentModelVersion, lastModelUpdate);
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
        RiskMetrics memory metrics = userRiskMetrics[user];
        
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
     * @dev Returns the recommended interest rate adjustment based on risk
     * @param user The address of the user
     * @return adjustment The recommended interest rate adjustment (in basis points)
     */
    function getRecommendedRateAdjustment(address user) external view override returns (int256 adjustment) {
        return recommendedRateAdjustments[user];
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
        uint256 customFactor = recommendedCollateralFactors[user][asset];
        
        // If no custom factor is set, calculate based on risk score
        if (customFactor == 0) {
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
        
        return customFactor;
    }
    
    /**
     * @dev Updates a user's recommended collateral factor for a specific asset
     * @param user The address of the user
     * @param asset The address of the collateral asset
     * @param factor The recommended collateral factor (0-100)
     */
    function updateRecommendedCollateralFactor(
        address user,
        address asset,
        uint256 factor
    ) external onlyOracle whenNotPaused {
        require(factor <= 90, "Factor must be <= 90%");
        recommendedCollateralFactors[user][asset] = factor;
    }
    
    /**
     * @dev Updates the risk model information
     * @param newModelId The new model identifier
     * @param newVersion The new model version
     */
    function updateRiskModel(bytes32 newModelId, uint256 newVersion) external onlyOwner {
        currentModelId = newModelId;
        currentModelVersion = newVersion;
        lastModelUpdate = block.timestamp;
        
        emit RiskModelUpdated(newModelId, newVersion, block.timestamp);
    }
    
    /**
     * @dev Adds a new oracle
     * @param oracle The address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
        require(!authorizedOracles[oracle], "Oracle already exists");
        authorizedOracles[oracle] = true;
        oracleAddresses.push(oracle);
    }
    
    /**
     * @dev Removes an oracle
     * @param oracle The address of the oracle to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle does not exist");
        require(oracleAddresses.length > minRequiredSignatures, "Cannot remove oracle: minimum count would not be met");
        
        authorizedOracles[oracle] = false;
        
        // Remove from the array
        for (uint256 i = 0; i < oracleAddresses.length; i++) {
            if (oracleAddresses[i] == oracle) {
                // Replace with the last element and pop
                oracleAddresses[i] = oracleAddresses[oracleAddresses.length - 1];
                oracleAddresses.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Updates the minimum required signatures
     * @param newMinSignatures The new minimum number of signatures
     */
    function updateMinRequiredSignatures(uint256 newMinSignatures) external onlyOwner {
        require(newMinSignatures > 0, "Min signatures must be > 0");
        require(newMinSignatures <= oracleAddresses.length, "Min signatures must be <= oracle count");
        
        minRequiredSignatures = newMinSignatures;
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
        return authorizedOracles[oracle];
    }
    
    /**
     * @dev Gets all authorized oracle addresses
     * @return oracles Array of authorized oracle addresses
     */
    function getOracleAddresses() external view returns (address[] memory oracles) {
        return oracleAddresses;
    }
}
