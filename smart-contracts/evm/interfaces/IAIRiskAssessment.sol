// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAIRiskAssessment
 * @dev Interface for the AI-powered risk assessment system
 * @notice This interface defines the functions for interacting with the AI risk assessment oracle
 */
interface IAIRiskAssessment {
    /**
     * @dev Emitted when a user's risk score is updated
     * @param user The address of the user
     * @param oldScore The previous risk score
     * @param newScore The new risk score
     * @param timestamp The timestamp when the update occurred
     */
    event RiskScoreUpdated(
        address indexed user, 
        uint256 oldScore, 
        uint256 newScore, 
        uint256 timestamp
    );
    
    /**
     * @dev Emitted when a risk assessment is requested
     * @param user The address of the user
     * @param requestId The unique identifier for this assessment request
     * @param timestamp The timestamp when the request was made
     */
    event RiskAssessmentRequested(
        address indexed user,
        bytes32 indexed requestId,
        uint256 timestamp
    );
    
    /**
     * @dev Emitted when a risk model is updated
     * @param modelId The identifier of the risk model
     * @param modelVersion The new version of the model
     * @param timestamp The timestamp when the update occurred
     */
    event RiskModelUpdated(
        bytes32 indexed modelId,
        uint256 modelVersion,
        uint256 timestamp
    );

    /**
     * @dev Returns the current risk score for a user
     * @param user The address of the user
     * @return score The risk score (0-100, where 0 is lowest risk and 100 is highest)
     */
    function getUserRiskScore(address user) external view returns (uint256 score);
    
    /**
     * @dev Requests an assessment of a user's risk profile
     * @param user The address of the user to assess
     * @return requestId The unique identifier for this assessment request
     */
    function assessUserRisk(address user) external returns (bytes32 requestId);
    
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
    ) external returns (bool success);
    
    /**
     * @dev Returns the timestamp of the last risk assessment for a user
     * @param user The address of the user
     * @return timestamp The timestamp of the last assessment
     */
    function getLastAssessmentTime(address user) external view returns (uint256 timestamp);
    
    /**
     * @dev Returns the current version of the risk model
     * @return modelId The identifier of the risk model
     * @return version The current version of the model
     * @return lastUpdated The timestamp of the last model update
     */
    function getRiskModelInfo() external view returns (
        bytes32 modelId,
        uint256 version,
        uint256 lastUpdated
    );
    
    /**
     * @dev Returns detailed risk metrics for a user
     * @param user The address of the user
     * @return overallScore The overall risk score (0-100)
     * @return repaymentScore The repayment history score component (0-100)
     * @return collateralScore The collateral quality score component (0-100)
     * @return volatilityScore The wallet volatility score component (0-100)
     * @return activityScore The on-chain activity score component (0-100)
     */
    function getUserRiskMetrics(address user) external view returns (
        uint256 overallScore,
        uint256 repaymentScore,
        uint256 collateralScore,
        uint256 volatilityScore,
        uint256 activityScore
    );
    
    /**
     * @dev Returns the recommended interest rate adjustment based on risk
     * @param user The address of the user
     * @return adjustment The recommended interest rate adjustment (in basis points)
     */
    function getRecommendedRateAdjustment(address user) external view returns (int256 adjustment);
    
    /**
     * @dev Returns the recommended collateral factor based on risk
     * @param user The address of the user
     * @param asset The address of the collateral asset
     * @return factor The recommended collateral factor (0-100, representing 0-100%)
     */
    function getRecommendedCollateralFactor(
        address user, 
        address asset
    ) external view returns (uint256 factor);
}
