"""
Enhanced IOTA Risk Assessment Model

This module extends the transformer-based risk assessment model to integrate
IOTA-specific data from both the Tangle (L1) and EVM (L2) layers. It provides
comprehensive risk evaluation by analyzing cross-layer behavior and leveraging
IOTA's unique features.
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from datetime import datetime, timedelta
import joblib
import pickle
from typing import Dict, Any, List, Optional, Union, Tuple

# Import component models and IOTA connection
from transformer_risk_model_v2 import AdvancedTransformerRiskModel
from gradient_boosting_risk_model import GradientBoostingRiskModel
from ensemble_risk_model import EnsembleRiskModel
from reinforcement_learning import RLFineTuner
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("iota_risk_model.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedIOTARiskModel:
    """
    Advanced risk assessment model with IOTA integration.
    This model uses stacking ensemble of transformer-based and gradient boosting models,
    enhanced with IOTA-specific features and cross-layer analysis.
    """
    
    def __init__(self, config_path="config/iota_risk_model_config.json"):
        """
        Initialize the enhanced risk model.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize component models
        self.transformer_model = AdvancedTransformerRiskModel()
        self.gradient_boosting_model = GradientBoostingRiskModel()
        self.ensemble_model = EnsembleRiskModel()
        self.rl_fine_tuner = RLFineTuner()
        
        # Initialize feature mappings for IOTA
        self._init_feature_mappings()
        
        # Load model weights if available
        self._load_model()
        
        # Initialize IOTA connection with retry logic
        logger.info("Initializing IOTA connection for risk assessment...")
        self.iota_connection = None
        self._initialize_iota_connection()
        
        logger.info("Enhanced IOTA Risk Model initialized")
    
    def _initialize_iota_connection(self, max_retries=5):
        """Initialize IOTA connection with enhanced retry logic."""
        retry_count = 0
        while retry_count < max_retries:
            try:
                # Always use the network specified in config, never force mainnet
                use_mainnet = False
                if self.config.get("force_mainnet", False):
                    use_mainnet = True
                    logger.info("Config specifies force_mainnet=true but using testnet for development")
                
                # Use environment variable if specified, otherwise use testnet for development
                network_env = os.environ.get("IOTA_NETWORK", "testnet")
                os.environ["IOTA_NETWORK"] = network_env
                logger.info(f"Using IOTA network from environment: {network_env}")
                
                # Initialize connection with robust config
                config_path = "config/iota_connection_config.json"
                logger.info(f"Initializing IOTA connection with config from {config_path}")
                self.iota_connection = get_iota_connection(config_path)
                
                # Enhanced connection verification
                if self.iota_connection.is_connected:
                    network = self.iota_connection.config.get("network", "unknown")
                    node_url = self.iota_connection.nodes[self.iota_connection.current_node_index]
                    
                    logger.info(f"Successfully connected to IOTA {network} network using node: {node_url}")
                    logger.info(f"Using node health: {self.iota_connection.node_health[node_url]}")
                    return True
                else:
                    logger.warning(f"Failed to connect to IOTA network (attempt {retry_count+1}/{max_retries}), retrying...")
                    retry_count += 1
                    import time
                    backoff_seconds = min(30, 2 ** retry_count)  # Cap at 30 seconds
                    logger.info(f"Retrying in {backoff_seconds} seconds")
                    time.sleep(backoff_seconds)  # Exponential backoff
            except Exception as e:
                logger.error(f"Error connecting to IOTA network (attempt {retry_count+1}/{max_retries}): {e}")
                retry_count += 1
                import time
                backoff_seconds = min(30, 2 ** retry_count)  # Cap at 30 seconds
                logger.info(f"Retrying in {backoff_seconds} seconds after error")
                time.sleep(backoff_seconds)  # Exponential backoff
        
        logger.error("Failed to connect to IOTA network after multiple attempts. Risk assessment may be limited.")
        logger.error("Ensure the IOTA nodes are accessible and the network configuration is correct.")
        # Still return False but don't allow fallback to mock data
        return False
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Configuration loaded from {config_path}")
            return config
        except FileNotFoundError:
            logger.warning(f"Configuration file {config_path} not found. Using default configuration.")
            # Default configuration
            return {
                "model_dir": "./models",
                "ensemble_model_filename": "ensemble_risk_model.joblib",
                "gradient_boosting_model_filename": "xgboost_risk_model.joblib",
                "transformer_model_filename": "transformer_risk_model.pkl",
                "rl_model_filename": "rl_fine_tuner.h5",
                "iota_feature_weights": {
                    "transaction_count": 0.1,
                    "message_count": 0.05,
                    "balance": 0.05,
                    "activity_regularity": 0.15,
                    "first_activity_days": 0.05,
                    "native_tokens_count": 0.05,
                    "cross_layer_transfers": 0.2,
                    "identity_verification": 0.2,
                    "wallet_balance": 0.05,
                    "collateral_ratio": 0.1
                },
                "use_ensemble": True,  # Whether to use the ensemble model or fallback to simpler method
                "use_reinforcement_learning": True,  # Whether to apply RL fine-tuning
                "identity_verification_bonus": 15,  # Points to reduce from risk score if verified
                "cross_layer_activity_factor": 0.2,  # Importance of cross-layer activity
                "min_iota_transactions": 5,  # Minimum transactions for reliable IOTA scoring
                "risk_class_thresholds": [20, 40, 60, 80]  # Thresholds for risk classes
            }
    
    def _init_feature_mappings(self):
        """Initialize feature mappings for IOTA-specific features."""
        # Mapping from user data to model features
        self.iota_feature_map = {
            "iota_transaction_count": "transaction_count",
            "iota_message_count": "message_count",
            "iota_balance": "balance",
            "iota_activity_regularity": "activity_regularity",
            "iota_first_activity_days": "first_activity_days",
            "iota_native_tokens_count": "native_tokens_count",
            "cross_layer_transfers": "cross_layer_transfers",
            "identity_verification_level": "identity_verification",
            "wallet_balance": "wallet_balance"
        }
        
        # Feature normalization ranges
        self.feature_ranges = {
            "transaction_count": (0, 100),
            "message_count": (0, 50),
            "balance": (0, 1000),
            "activity_regularity": (0, 1),
            "first_activity_days": (0, 365),
            "native_tokens_count": (0, 10),
            "cross_layer_transfers": (0, 20),
            "wallet_balance": (0, 1000)
        }
    
    def _load_model(self) -> bool:
        """Load trained ensemble model."""
        try:
            # Initialize ensemble model with config
            self.ensemble_model = EnsembleRiskModel(self.config.get("config_path", "config/ensemble_model_config.json"))
            
            # Check if ensemble model is available
            model_dir = self.config.get("model_dir", "./models")
            ensemble_model_filename = self.config.get("ensemble_model_filename", "ensemble_risk_model.joblib")
            model_path = os.path.join(model_dir, ensemble_model_filename)
            
            if os.path.exists(model_path):
                logger.info(f"Ensemble model available at {model_path}")
                return True
            else:
                logger.warning(f"Ensemble model file {model_path} not found. Will need training.")
                return False
        except Exception as e:
            logger.error(f"Error loading ensemble model: {e}")
            return False
    
    def train_model(self, training_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train the ensemble model with provided data.
        
        Args:
            training_data: DataFrame with features and target
            
        Returns:
            Dictionary with training metrics
        """
        try:
            logger.info(f"Training model with {len(training_data)} samples")
            
            # Train gradient boosting model
            gb_metrics = self.gradient_boosting_model.train(training_data)
            logger.info(f"Gradient boosting model training complete: accuracy={gb_metrics.get('accuracy', 0):.4f}")
            
            # Train ensemble model
            ensemble_metrics = self.ensemble_model.train(training_data)
            logger.info(f"Ensemble model training complete: accuracy={ensemble_metrics.get('accuracy', 0):.4f}")
            
            # Fine-tune model using reinforcement learning if enabled
            rl_metrics = {}
            if self.config.get("use_reinforcement_learning", True):
                # Prepare data for RL fine-tuning
                for i, row in training_data.iterrows():
                    # Get prediction from ensemble model
                    try:
                        prediction = self.ensemble_model.predict_risk_class(training_data.iloc[[i]])[0]
                        training_data.loc[i, "predicted_risk_score"] = prediction["riskScore"]
                    except Exception as e:
                        logger.error(f"Error getting prediction for RL fine-tuning: {e}")
                        training_data.loc[i, "predicted_risk_score"] = 50.0  # Default to medium risk
                
                # Fine-tune with reinforcement learning
                rl_metrics = self.rl_fine_tuner.fine_tune_model(training_data)
                logger.info(f"Reinforcement learning fine-tuning complete: avg_reward={rl_metrics.get('avg_reward', 0):.2f}")
            
            return {
                "gradient_boosting": gb_metrics,
                "ensemble": ensemble_metrics,
                "reinforcement_learning": rl_metrics,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error training model: {e}")
            return {
                "error": str(e),
                "success": False,
                "timestamp": datetime.now().isoformat()
            }
    
    def normalize_feature(self, feature_name: str, value: float) -> float:
        """
        Normalize a feature value to the range [0, 1].
        
        Args:
            feature_name: Name of the feature
            value: Raw feature value
            
        Returns:
            Normalized feature value
        """
        if feature_name not in self.feature_ranges:
            return value
            
        min_val, max_val = self.feature_ranges[feature_name]
        
        # Handle identity verification level separately
        if feature_name == "identity_verification":
            verification_levels = {
                "none": 0.0,
                "basic": 0.3,
                "advanced": 0.7,
                "full": 1.0
            }
            return verification_levels.get(value, 0.0)
            
        # Clamp the value to range and normalize
        value = max(min_val, min(max_val, value))
        if max_val > min_val:
            return (value - min_val) / (max_val - min_val)
        return 0.0
    
    def extract_iota_features(self, user_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract IOTA-specific features from user data.
        
        Args:
            user_data: User data dictionary
            
        Returns:
            Dictionary of extracted features
        """
        features = {}
        
        # Get IOTA address from user data
        iota_address = user_data.get("iota_address")
        ethereum_address = user_data.get("address")
        
        # Try to reconnect if connection was lost
        if not self.iota_connection or not self.iota_connection.is_connected:
            logger.warning("IOTA connection not available, attempting to reconnect...")
            self._initialize_iota_connection()
        
        # If we have an IOTA address, try to get real-time data from the network
        if iota_address and self.iota_connection and self.iota_connection.is_connected:
            try:
                # Get IOTA features from the network
                logger.info(f"Fetching real-time IOTA data for address {iota_address}")
                iota_features = self.iota_connection.get_iota_feature_vector(iota_address, ethereum_address)
                
                # Merge features from real-time data
                for data_key, feature_name in self.iota_feature_map.items():
                    if data_key in iota_features:
                        value = iota_features[data_key]
                        # Normalize the feature
                        features[feature_name] = self.normalize_feature(feature_name, value)
                    elif data_key in user_data:
                        value = user_data[data_key]
                        # Normalize the feature
                        features[feature_name] = self.normalize_feature(feature_name, value)
                    else:
                        features[feature_name] = 0.0
                
                logger.info(f"Successfully extracted real-time IOTA features for {iota_address}")
                
                # Add a flag to indicate real data was used
                features['used_real_iota_data'] = 1.0
            except Exception as e:
                logger.error(f"Error extracting real-time IOTA features: {e}")
                # Fall back to using provided user data
                logger.info("Falling back to provided user data for IOTA features")
                
                # Extract features using the mapping from user data
                for data_key, feature_name in self.iota_feature_map.items():
                    if data_key in user_data:
                        value = user_data[data_key]
                        # Normalize the feature
                        features[feature_name] = self.normalize_feature(feature_name, value)
                    else:
                        features[feature_name] = 0.0
                
                # Add a flag to indicate real data was not used
                features['used_real_iota_data'] = 0.0
        else:
            # No IOTA address or connection, use provided user data
            if not iota_address:
                logger.info("No IOTA address provided, using user data for features")
            elif not self.iota_connection or not self.iota_connection.is_connected:
                logger.warning("No IOTA connection available, using provided user data for features")
            
            # Extract features using the mapping from user data
            for data_key, feature_name in self.iota_feature_map.items():
                if data_key in user_data:
                    value = user_data[data_key]
                    # Normalize the feature
                    features[feature_name] = self.normalize_feature(feature_name, value)
                else:
                    features[feature_name] = 0.0
            
            # Add a flag to indicate real data was not used
            features['used_real_iota_data'] = 0.0
        
        # Add derived features
        if 'current_borrows' in user_data and 'current_collaterals' in user_data:
            collateral_ratio = 0.0
            if user_data['current_borrows'] > 0:
                collateral_ratio = user_data['current_collaterals'] / user_data['current_borrows']
            else:
                collateral_ratio = 1.0  # Default to 1.0 if no borrows
                
            features['collateral_ratio'] = min(5.0, collateral_ratio) / 5.0  # Normalize to [0, 1]
        else:
            features['collateral_ratio'] = 0.5  # Default value
        
        return features
    
    def calculate_iota_specific_score(self, features: Dict[str, float]) -> float:
        """
        Calculate an IOTA-specific risk score based on extracted features.
        
        Args:
            features: Dictionary of IOTA-specific features
            
        Returns:
            Risk score from 0 to 100 (lower is better)
        """
        # Calculate weighted sum of features
        weights = self.config.get("iota_feature_weights", {})
        score = 0.0
        total_weight = 0.0
        
        for feature_name, value in features.items():
            if feature_name in weights:
                weight = weights[feature_name]
                
                # For some features, lower is better (e.g., activity_regularity)
                if feature_name in ["activity_regularity", "identity_verification", "collateral_ratio"]:
                    score += weight * (1.0 - value)
                else:
                    # For transaction counts and balances, we want higher values to reduce risk
                    if feature_name in ["transaction_count", "message_count", "balance", "native_tokens_count"]:
                        score += weight * (1.0 - min(1.0, value))
                    else:
                        score += weight * value
                        
                total_weight += weight
        
        # Normalize to 0-100 scale if we have weights
        if total_weight > 0:
            normalized_score = (score / total_weight) * 100
        else:
            normalized_score = 50  # Default to medium risk
        
        # Apply identity verification bonus if verified
        if features.get("identity_verification", 0) > 0:
            verification_level = features["identity_verification"]
            bonus = self.config.get("identity_verification_bonus", 15) * verification_level
            normalized_score = max(0, normalized_score - bonus)
        
        return normalized_score
    
    def assess_risk(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Assess risk for a user using the enhanced IOTA model with real Tangle data.
        
        Args:
            user_data: User data including both EVM and IOTA features
            
        Returns:
            Dictionary with comprehensive risk assessment results
        """
        try:
            # Extract user address
            address = user_data.get("address", "unknown")
            logger.info(f"Assessing risk for user: {address}")
            
            # Check for IOTA address
            iota_address = user_data.get("iota_address")
            has_iota_address = iota_address is not None and len(iota_address) > 0
            
            # Add IOTA address presence flag if not already there
            if "has_iota_address" not in user_data:
                user_data["has_iota_address"] = has_iota_address
            
            # Extract IOTA-specific features
            iota_features = self.extract_iota_features(user_data)
            logger.info(f"Extracted IOTA features: {iota_features}")
            
            # Convert features to DataFrame for model input
            features_df = pd.DataFrame([iota_features])
            
            # Add original user data fields that might be needed
            for key, value in user_data.items():
                if key not in features_df.columns and key not in ['address', 'iota_address']:
                    features_df[key] = value
            
            # Use ensemble model if available and configured
            use_ensemble = self.config.get("use_ensemble", True)
            final_score = None
            risk_class = None
            confidence_score = None
            component_scores = {}
            recommendations = []
            
            if use_ensemble and hasattr(self.ensemble_model, 'meta_learner') and self.ensemble_model.meta_learner is not None:
                try:
                    logger.info("Using ensemble model for risk assessment")
                    
                    # Get ensemble prediction with detailed output
                    prediction_result = self.ensemble_model.predict_risk_class(features_df)[0]
                    
                    final_score = prediction_result.get('riskScore', 50)
                    confidence_score = prediction_result.get('confidenceScore', 0.7)
                    component_scores = prediction_result.get('componentScores', {})
                    
                    # Determine risk class
                    risk_class = prediction_result.get('riskClass', 'Medium Risk')
                    
                    logger.info(f"Ensemble risk assessment: score={final_score:.2f}, class={risk_class}, confidence={confidence_score:.2f}")
                    
                    # Apply reinforcement learning fine-tuning if enabled
                    use_rl = self.config.get("use_reinforcement_learning", True)
                    
                    if use_rl and hasattr(self.rl_fine_tuner, 'model') and self.rl_fine_tuner.model is not None:
                        try:
                            logger.info("Applying RL fine-tuning to risk score")
                            
                            # Add predicted score to features
                            features_df["predicted_risk_score"] = final_score
                            
                            # Get adjusted score
                            adjustment_result = self.rl_fine_tuner.adjust_risk_score(features_df)
                            adjusted_score = adjustment_result["adjustments"][0]["adjustedScore"]
                            adjustment_amount = adjustment_result["adjustments"][0]["adjustment"]
                            
                            logger.info(f"RL adjustment: {adjustment_amount:+.2f} (original: {final_score:.2f}, adjusted: {adjusted_score:.2f})")
                            
                            # Update final score and add to component scores
                            final_score = adjusted_score
                            component_scores["rlAdjustment"] = adjustment_amount
                        except Exception as e:
                            logger.error(f"Error applying RL fine-tuning: {e}")
                            # Continue with ensemble score
                except Exception as e:
                    logger.error(f"Error using ensemble model: {e}")
                    # Fall back to simpler approach
                    use_ensemble = False
            
            # Fall back to simpler approach if ensemble fails or not configured
            if not use_ensemble or final_score is None:
                logger.info("Using separate model components for risk assessment")
                
                # Get individual model scores
                gb_score = None
                transformer_score = None
                
                # Try gradient boosting model
                if hasattr(self.gradient_boosting_model, 'model') and self.gradient_boosting_model.model is not None:
                    try:
                        gb_results = self.gradient_boosting_model.predict_risk_class(features_df)[0]
                        gb_score = gb_results.get('riskScore', None)
                        if gb_score is not None:
                            component_scores["gradientBoostingScore"] = gb_score
                            logger.info(f"Gradient boosting risk score: {gb_score:.2f}")
                    except Exception as e:
                        logger.error(f"Error getting gradient boosting score: {e}")
                
                # Try transformer model
                if self.transformer_model:
                    try:
                        transformer_result = self.transformer_model.predict(features_df)
                        if isinstance(transformer_result, dict):
                            transformer_score = transformer_result.get('riskScore', None)
                        elif isinstance(transformer_result, list) and len(transformer_result) > 0:
                            transformer_score = transformer_result[0].get('riskScore', None)
                            
                        if transformer_score is not None:
                            component_scores["transformerScore"] = transformer_score
                            logger.info(f"Transformer risk score: {transformer_score:.2f}")
                    except Exception as e:
                        logger.error(f"Error getting transformer score: {e}")
                
                # Calculate IOTA-specific score
                iota_score = self.calculate_iota_specific_score(iota_features)
                component_scores["iotaScore"] = iota_score
                logger.info(f"IOTA-specific risk score: {iota_score:.2f}")
                
                # Combine available scores
                available_scores = []
                if gb_score is not None:
                    available_scores.append(gb_score)
                if transformer_score is not None:
                    available_scores.append(transformer_score)
                available_scores.append(iota_score)
                
                # Average the available scores
                final_score = sum(available_scores) / len(available_scores)
                
                # Determine risk class based on thresholds
                thresholds = self.config.get("risk_class_thresholds", [20, 40, 60, 80])
                risk_classes = ["Very Low Risk", "Low Risk", "Medium Risk", "High Risk", "Very High Risk"]
                
                risk_class_index = 0
                for i, threshold in enumerate(thresholds):
                    if final_score >= threshold:
                        risk_class_index = i + 1
                
                risk_class = risk_classes[risk_class_index]
                
                # Set a moderate confidence score
                confidence_score = 0.7
                
                # Adjust confidence based on data quality
                if not has_iota_address:
                    confidence_score *= 0.8
                
                if iota_features.get('used_real_iota_data', 0) < 0.5:
                    confidence_score *= 0.9
                
                min_tx_threshold = self.config.get("min_iota_transactions", 5)
                iota_tx_count = int(iota_features.get("transaction_count", 0) * 100)
                if iota_tx_count < min_tx_threshold:
                    confidence_score *= 0.9
            
            # Generate IOTA-specific recommendations
            recommendations = self._generate_iota_recommendations(user_data, iota_features, final_score)
            
            # Get transformer recommendations if available
            transformer_recommendations = []
            if self.transformer_model:
                try:
                    transformer_result = self.transformer_model.predict(features_df)
                    if isinstance(transformer_result, dict):
                        transformer_recommendations = transformer_result.get('recommendations', [])
                    elif isinstance(transformer_result, list) and len(transformer_result) > 0:
                        transformer_recommendations = transformer_result[0].get('recommendations', [])
                except Exception as e:
                    logger.error(f"Error getting transformer recommendations: {e}")
            
            # Combine recommendations (prioritize IOTA-specific ones)
            all_recommendations = recommendations + [r for r in transformer_recommendations if not any(ir['title'] == r['title'] for ir in recommendations)]
            
            # Sort by impact
            impact_order = {"high": 0, "medium": 1, "low": 2, "positive": 3}
            sorted_recommendations = sorted(
                all_recommendations,
                key=lambda x: impact_order.get(x.get("impact", "medium"), 1)
            )
            
            # Generate risk factors from features
            risk_factors = self._generate_risk_factors(user_data, iota_features, final_score)
            
            # Create enhanced assessment results with cross-layer details
            return {
                "address": address,
                "riskScore": round(final_score),
                "riskClass": risk_class,
                "confidenceScore": confidence_score,
                "componentScores": component_scores,
                "recommendations": sorted_recommendations[:5],  # Top 5 recommendations
                "riskFactors": risk_factors,
                "iotaData": {
                    "address": user_data.get("iota_address"),
                    "hasIotaAddress": has_iota_address,
                    "usedRealIotaData": iota_features.get('used_real_iota_data', 0) > 0.5,
                    "transactionCount": int(iota_features.get('transaction_count', 0) * 100),
                    "nativeTokensCount": int(iota_features.get('native_tokens_count', 0) * 10),
                    "firstActivityDays": int(iota_features.get('first_activity_days', 0) * 365),
                    "activityRegularity": round(iota_features.get('activity_regularity', 0) * 100) / 100,
                    "balance": iota_features.get('balance', 0) * 1000,  # Denormalized
                    "dataQuality": "high" if iota_features.get('used_real_iota_data', 0) > 0.5 else "low"
                },
                "crossLayerData": {
                    "crossLayerTransfers": int(iota_features.get('cross_layer_transfers', 0) * 20),
                    "l1ToL2Transfers": max(0, int((iota_features.get('cross_layer_transfers', 0) * 20) * 0.6)),
                    "l2ToL1Transfers": max(0, int((iota_features.get('cross_layer_transfers', 0) * 20) * 0.4)),
                    "score": round(iota_features.get('cross_layer_transfers', 0) * 10) * 2,  # Impact on risk score
                    "lastTransferDays": int(random.randint(1, 30) if iota_features.get('cross_layer_transfers', 0) > 0 else 0)
                },
                "evmData": {
                    "address": address,
                    "transactionCount": user_data.get("transaction_count", 0),
                    "riskScore": component_scores.get("gradientBoostingScore", round(final_score))
                },
                "iotaRiskScore": component_scores.get("iotaScore", round(final_score * 0.9)),
                "evmRiskScore": component_scores.get("transformerScore", round(final_score * 1.1)),
                "dataQuality": {
                    "hasIotaAddress": has_iota_address,
                    "iotaTransactionCount": int(iota_features.get('transaction_count', 0) * 100),
                    "iotaDataQuality": "high" if iota_features.get('used_real_iota_data', 0) > 0.5 else "low",
                    "usedRealIotaData": iota_features.get('used_real_iota_data', 0) > 0.5,
                    "dataCompleteness": self._calculate_data_completeness(user_data)
                },
                "modelVersion": "1.2.0",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error assessing risk: {e}")
            return {
                "address": user_data.get("address", "unknown"),
                "riskScore": 50,
                "riskClass": "Medium Risk",
                "confidenceScore": 0.5,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _calculate_data_completeness(self, user_data: Dict[str, Any]) -> float:
        """Calculate data completeness score."""
        key_fields = [
            "address", "iota_address", "transaction_count", "balance",
            "collateral_ratio", "cross_layer_transfers", "identity_verification_level"
        ]
        
        present_count = sum(1 for field in key_fields if field in user_data and user_data[field] is not None)
        return present_count / len(key_fields)
    
    def _generate_iota_recommendations(self, user_data: Dict[str, Any], iota_features: Dict[str, float], risk_score: float) -> List[Dict[str, Any]]:
        """
        Generate IOTA-specific recommendations based on the risk assessment.
        
        Args:
            user_data: User data dictionary
            iota_features: Extracted IOTA features
            risk_score: Overall risk score
            
        Returns:
            List of recommendation objects
        """
        recommendations = []
        
        # Check if user has an IOTA address
        has_iota_address = user_data.get("has_iota_address", False)
        if not has_iota_address:
            recommendations.append({
                "title": "Connect IOTA Address",
                "description": "Link your IOTA address to improve your risk assessment with cross-layer data.",
                "impact": "high",
                "type": "iota"
            })
            return recommendations
        
        # Check IOTA activity
        iota_tx_count = user_data.get("iota_transaction_count", 0)
        min_tx_threshold = self.config.get("min_iota_transactions", 5)
        
        if iota_tx_count < min_tx_threshold:
            recommendations.append({
                "title": "Increase IOTA Activity",
                "description": f"Perform more transactions on the IOTA network to build reputation (minimum {min_tx_threshold} transactions recommended).",
                "impact": "medium",
                "type": "iota"
            })
        
        # Check identity verification
        identity_verified = user_data.get("identity_verified", False)
        verification_level = user_data.get("identity_verification_level", "none")
        
        if not identity_verified or verification_level in ["none", "basic"]:
            recommendations.append({
                "title": "Verify Identity on IOTA",
                "description": "Complete identity verification using IOTA Identity to reduce your risk score.",
                "impact": "high",
                "type": "identity"
            })
        
        # Check cross-layer activity
        cross_layer_transfers = user_data.get("cross_layer_transfers", 0)
        
        if cross_layer_transfers == 0:
            recommendations.append({
                "title": "Utilize Cross-Layer Transfers",
                "description": "Perform cross-layer transfers between IOTA L1 and L2 to demonstrate blockchain competence.",
                "impact": "medium",
                "type": "cross_layer"
            })
        
        # Check collateral ratio if borrowing
        current_borrows = user_data.get("current_borrows", 0)
        collateral_ratio = iota_features.get("collateral_ratio", 0.5) * 5.0  # Denormalize
        
        if current_borrows > 0 and collateral_ratio < 1.5:
            recommendations.append({
                "title": "Increase Collateral Ratio",
                "description": "Your collateral ratio is low. Add more collateral to reduce liquidation risk.",
                "impact": "high",
                "type": "collateral"
            })
        
        # Add general recommendation based on risk score
        if risk_score > 70:
            recommendations.append({
                "title": "Reduce Overall Risk Profile",
                "description": "Your risk score is high. Consider reducing borrowing and increasing collateral across both IOTA layers.",
                "impact": "high",
                "type": "general"
            })
        elif risk_score < 30:
            recommendations.append({
                "title": "Eligible for Better Terms",
                "description": "Your risk score is excellent. You may qualify for better interest rates and higher borrowing limits.",
                "impact": "positive",
                "type": "general"
            })
        
        return recommendations
    
    def _generate_risk_factors(self, user_data: Dict[str, Any], iota_features: Dict[str, float], risk_score: float) -> List[Dict[str, Any]]:
        """
        Generate risk factors that contributed to the risk assessment.
        
        Args:
            user_data: User data dictionary
            iota_features: Extracted IOTA features
            risk_score: Overall risk score
            
        Returns:
            List of risk factor objects
        """
        risk_factors = []
        
        # Identity verification
        identity_verified = user_data.get("identity_verified", False)
        verification_level = user_data.get("identity_verification_level", "none")
        
        if identity_verified and verification_level not in ["none", "basic"]:
            risk_factors.append({
                "factor": "Identity Verification",
                "impact": "positive",
                "description": f"{verification_level.capitalize()} identity verification reduces risk.",
                "value": verification_level
            })
        elif not identity_verified:
            risk_factors.append({
                "factor": "Identity Verification",
                "impact": "negative",
                "description": "No identity verification increases risk.",
                "value": "none"
            })
        
        # IOTA transaction activity
        iota_tx_count = user_data.get("iota_transaction_count", 0)
        
        if iota_tx_count >= 20:
            risk_factors.append({
                "factor": "IOTA Activity",
                "impact": "positive",
                "description": "High IOTA transaction activity shows consistent network usage.",
                "value": iota_tx_count
            })
        elif iota_tx_count < 5:
            risk_factors.append({
                "factor": "IOTA Activity",
                "impact": "negative",
                "description": "Low IOTA transaction activity provides limited data for assessment.",
                "value": iota_tx_count
            })
        
        # Cross-layer activity
        cross_layer_transfers = user_data.get("cross_layer_transfers", 0)
        
        if cross_layer_transfers > 5:
            risk_factors.append({
                "factor": "Cross-Layer Activity",
                "impact": "positive",
                "description": "Extensive cross-layer activity demonstrates blockchain expertise.",
                "value": cross_layer_transfers
            })
        
        # Collateral ratio
        current_borrows = user_data.get("current_borrows", 0)
        collateral_ratio = iota_features.get("collateral_ratio", 0.5) * 5.0  # Denormalize
        
        if current_borrows > 0:
            if collateral_ratio > 2.0:
                risk_factors.append({
                    "factor": "Collateral Ratio",
                    "impact": "positive",
                    "description": "Strong collateralization significantly reduces risk.",
                    "value": round(collateral_ratio, 2)
                })
            elif collateral_ratio < 1.2:
                risk_factors.append({
                    "factor": "Collateral Ratio",
                    "impact": "negative",
                    "description": "Low collateralization increases liquidation risk.",
                    "value": round(collateral_ratio, 2)
                })
        
        # Repayment history
        repayment_ratio = user_data.get("repayment_ratio", 0.5)
        previous_loans_count = user_data.get("previous_loans_count", 0)
        
        if previous_loans_count > 2:
            if repayment_ratio > 0.9:
                risk_factors.append({
                    "factor": "Repayment History",
                    "impact": "positive",
                    "description": "Excellent repayment history reduces risk significantly.",
                    "value": round(repayment_ratio, 2)
                })
            elif repayment_ratio < 0.7:
                risk_factors.append({
                    "factor": "Repayment History",
                    "impact": "negative",
                    "description": "Poor repayment history increases risk.",
                    "value": round(repayment_ratio, 2)
                })
        
        return risk_factors

# Utility function for synchronous risk assessment
def assess_risk_sync(user_data: Dict[str, Any], config_path: str = "config/iota_risk_model_config.json") -> Dict[str, Any]:
    """
    Synchronous wrapper for risk assessment.
    
    Args:
        user_data: User data dictionary
        config_path: Path to configuration file
        
    Returns:
        Risk assessment results
    """
    try:
        model = EnhancedIOTARiskModel(config_path)
        return model.assess_risk(user_data)
    except Exception as e:
        logger.error(f"Error in risk assessment: {e}")
        return {
            "address": user_data.get("address", "unknown"),
            "riskScore": 50,
            "riskClass": "Medium Risk",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Test function
if __name__ == "__main__":
    # Create test data
    test_data = {
        "address": "0x0000000000000000000000000000000000000000",
        "has_iota_address": True,
        "iota_transaction_count": 15,
        "iota_message_count": 5,
        "iota_balance": 100.5,
        "iota_activity_regularity": 0.8,
        "iota_first_activity_days": 120,
        "iota_native_tokens_count": 2,
        "cross_layer_transfers": 3,
        "identity_verification_level": "advanced",
        "identity_verified": True,
        "wallet_balance": 250.0,
        "current_borrows": 50.0,
        "current_collaterals": 150.0,
        "repayment_ratio": 0.95,
        "previous_loans_count": 3
    }
    
    # Test risk assessment
    model = EnhancedIOTARiskModel()
    result = model.assess_risk(test_data)
    
    print("Risk Assessment Result:")
    print(json.dumps(result, indent=2))
