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

# Import risk models and IOTA connection
from transformer_risk_model_v2 import AdvancedTransformerRiskModel
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
    This model builds on the transformer-based model and adds IOTA-specific
    features and cross-layer analysis.
    """
    
    def __init__(self, config_path="config/iota_risk_model_config.json"):
        """
        Initialize the enhanced risk model.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize transformer risk model
        self.transformer_model = AdvancedTransformerRiskModel()
        
        # Initialize feature mappings for IOTA
        self._init_feature_mappings()
        
        # Load model weights if available
        self._load_model()
        
        # Initialize IOTA connection with retry logic
        logger.info("Initializing IOTA connection for risk assessment...")
        self.iota_connection = None
        self._initialize_iota_connection()
        
        logger.info("Enhanced IOTA Risk Model initialized")
    
    def _initialize_iota_connection(self, max_retries=3):
        """Initialize IOTA connection with retry logic."""
        retry_count = 0
        while retry_count < max_retries:
            try:
                # Get IOTA connection
                self.iota_connection = get_iota_connection("config/iota_connection_config.json")
                
                # Check IOTA connection
                if self.iota_connection.is_connected:
                    logger.info("Connected to IOTA network for real-time risk assessment")
                    return True
                else:
                    logger.warning("Failed to connect to IOTA network, retrying...")
                    retry_count += 1
                    time.sleep(2 ** retry_count)  # Exponential backoff
            except Exception as e:
                logger.error(f"Error connecting to IOTA network (attempt {retry_count+1}/{max_retries}): {e}")
                retry_count += 1
                time.sleep(2 ** retry_count)  # Exponential backoff
        
        logger.warning("Failed to connect to IOTA network after multiple attempts, some features may be unavailable")
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
                "ensemble_weights": {
                    "transformer": 0.6,
                    "iota_specific": 0.4
                },
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
                "iota_importance_factor": 0.4,  # Weight for IOTA-specific features
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
    
    def _load_model(self):
        """Load trained model if available."""
        try:
            # Load transformer model
            model_dir = self.config.get("model_dir", "./models")
            model_path = os.path.join(model_dir, "enhanced_iota_risk_model.pkl")
            
            if os.path.exists(model_path):
                with open(model_path, 'rb') as f:
                    self.model_data = pickle.load(f)
                    
                # Set feature ranges from saved model
                if 'feature_ranges' in self.model_data:
                    self.feature_ranges = self.model_data['feature_ranges']
                    
                logger.info(f"Model loaded from {model_path}")
                return True
            else:
                logger.warning(f"Model file {model_path} not found.")
                return False
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self):
        """Save trained model."""
        try:
            model_dir = self.config.get("model_dir", "./models")
            os.makedirs(model_dir, exist_ok=True)
            
            model_path = os.path.join(model_dir, "enhanced_iota_risk_model.pkl")
            
            # Prepare model data
            model_data = {
                'feature_ranges': self.feature_ranges,
                'config': self.config,
                'version': '1.0',
                'timestamp': datetime.now().isoformat()
            }
            
            # Save model data
            with open(model_path, 'wb') as f:
                pickle.dump(model_data, f)
                
            logger.info(f"Model saved to {model_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False
    
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
        Assess risk for a user using the enhanced IOTA model.
        
        Args:
            user_data: User data including both EVM and IOTA features
            
        Returns:
            Dictionary with risk assessment results
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
            
            # Calculate IOTA-specific score
            iota_score = self.calculate_iota_specific_score(iota_features)
            logger.info(f"IOTA-specific risk score: {iota_score:.2f}")
            
            # Get transformer model score
            transformer_score = None
            transformer_confidence = 0.7  # Default confidence
            transformer_recommendations = []
            
            if self.transformer_model:
                try:
                    # Convert user_data to DataFrame for transformer model
                    user_df = pd.DataFrame([user_data])
                    transformer_result = self.transformer_model.predict(user_df)
                    
                    transformer_score = transformer_result['riskScore']
                    transformer_confidence = transformer_result.get('confidenceScore', 0.7)
                    transformer_recommendations = transformer_result.get('recommendations', [])
                    
                    logger.info(f"Transformer model risk score: {transformer_score:.2f}")
                except Exception as e:
                    logger.error(f"Error getting transformer score: {e}")
                    # Use IOTA score as fallback
                    transformer_score = iota_score
            else:
                logger.warning("Transformer model not available, using only IOTA scoring")
                transformer_score = iota_score
            
            # Combine scores with ensemble weights
            ensemble_weights = self.config.get("ensemble_weights", {"transformer": 0.6, "iota_specific": 0.4})
            
            combined_score = (
                ensemble_weights["transformer"] * transformer_score +
                ensemble_weights["iota_specific"] * iota_score
            )
            
            # Round to integer
            final_score = int(round(combined_score))
            
            # Calculate confidence based on data availability
            has_iota_address = user_data.get("has_iota_address", False)
            iota_tx_count = user_data.get("iota_transaction_count", 0)
            min_tx_threshold = self.config.get("min_iota_transactions", 5)
            
            iota_confidence = 0.6
            if has_iota_address:
                if iota_tx_count >= min_tx_threshold:
                    iota_confidence = 0.9
                elif iota_tx_count > 0:
                    iota_confidence = 0.75
            
            # Combine confidences
            combined_confidence = (
                ensemble_weights["transformer"] * transformer_confidence +
                ensemble_weights["iota_specific"] * iota_confidence
            )
            
            # Determine risk class
            thresholds = self.config.get("risk_class_thresholds", [20, 40, 60, 80])
            risk_classes = ["Very Low Risk", "Low Risk", "Medium Risk", "High Risk", "Very High Risk"]
            
            risk_class_index = 0
            for i, threshold in enumerate(thresholds):
                if final_score >= threshold:
                    risk_class_index = i + 1
            
            risk_class = risk_classes[risk_class_index]
            
            # Generate IOTA-specific recommendations
            iota_recommendations = self._generate_iota_recommendations(user_data, iota_features, final_score)
            
            # Combine recommendations (prioritize IOTA-specific ones)
            all_recommendations = iota_recommendations + [r for r in transformer_recommendations if not any(ir['title'] == r['title'] for ir in iota_recommendations)]
            
            # Sort by impact
            impact_order = {"high": 0, "medium": 1, "low": 2}
            sorted_recommendations = sorted(
                all_recommendations,
                key=lambda x: impact_order.get(x.get("impact", "medium"), 1)
            )
            
            # Generate risk factors from features
            risk_factors = self._generate_risk_factors(user_data, iota_features, final_score)
            
            # Return assessment results
            return {
                "address": address,
                "riskScore": final_score,
                "riskClass": risk_class,
                "confidenceScore": combined_confidence,
                "iotaScore": iota_score,
                "transformerScore": transformer_score,
                "recommendations": sorted_recommendations[:5],  # Top 5 recommendations
                "riskFactors": risk_factors,
                "dataQuality": {
                    "hasIotaAddress": has_iota_address,
                    "iotaTransactionCount": iota_tx_count,
                    "iotaDataQuality": "high" if iota_tx_count >= min_tx_threshold else "medium" if iota_tx_count > 0 else "low"
                },
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
