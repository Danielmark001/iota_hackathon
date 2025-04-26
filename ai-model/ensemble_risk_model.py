"""
Advanced Ensemble Risk Assessment Model

This module implements a stacking ensemble that combines multiple risk assessment models
for more accurate risk prediction across IOTA L1 and L2 layers.
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from datetime import datetime
from typing import Dict, Any, List, Optional, Union, Tuple
import joblib

# Import component models
from transformer_risk_model_v2 import AdvancedTransformerRiskModel
from gradient_boosting_risk_model import GradientBoostingRiskModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ensemble_model.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnsembleRiskModel:
    """
    Advanced stacking ensemble model that combines transformer-based, gradient boosting,
    and IOTA-specific models for comprehensive risk assessment.
    """
    
    def __init__(self, config_path="config/ensemble_model_config.json"):
        """
        Initialize the ensemble model.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize component models
        self.transformer_model = None
        self.gradient_boosting_model = None
        
        # Initialize meta-learner
        self.meta_learner = None
        
        # Load models
        self._initialize_models()
        
        logger.info("Ensemble Risk Model initialized")
    
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
                "transformer_model_path": "transformer_risk_model.pkl",
                "gradient_boosting_model_path": "xgboost_risk_model.joblib",
                "meta_learner": {
                    "type": "logistic_regression",
                    "params": {
                        "C": 1.0,
                        "penalty": "l2",
                        "solver": "lbfgs",
                        "max_iter": 1000,
                        "random_state": 42
                    }
                },
                "iota_specific_features": [
                    "transaction_count",
                    "message_count",
                    "balance",
                    "activity_regularity",
                    "first_activity_days",
                    "native_tokens_count",
                    "cross_layer_transfers",
                    "identity_verification",
                    "wallet_balance",
                    "collateral_ratio"
                ],
                "target_column": "default_risk",
                "test_size": 0.2,
                "random_state": 42,
                "threshold": 0.5,
                "use_uncertainty": true,
                "calibration_method": "isotonic"
            }
    
    def _initialize_models(self):
        """Initialize component models."""
        # Initialize transformer model
        try:
            transformer_model_path = os.path.join(
                self.config.get("model_dir", "./models"),
                self.config.get("transformer_model_path", "transformer_risk_model.pkl")
            )
            
            if os.path.exists(transformer_model_path):
                self.transformer_model = AdvancedTransformerRiskModel()
                self.transformer_model.load_model(transformer_model_path)
                logger.info(f"Transformer model loaded from {transformer_model_path}")
            else:
                self.transformer_model = AdvancedTransformerRiskModel()
                logger.warning(f"Transformer model file {transformer_model_path} not found. Creating new instance.")
        except Exception as e:
            logger.error(f"Error initializing transformer model: {e}")
            self.transformer_model = None
        
        # Initialize gradient boosting model
        try:
            gradient_boosting_model_path = os.path.join(
                self.config.get("model_dir", "./models"),
                self.config.get("gradient_boosting_model_path", "xgboost_risk_model.joblib")
            )
            
            self.gradient_boosting_model = GradientBoostingRiskModel()
            
            if os.path.exists(gradient_boosting_model_path):
                # Model will be loaded in the GradientBoostingRiskModel constructor
                logger.info(f"Gradient boosting model loaded from {gradient_boosting_model_path}")
            else:
                logger.warning(f"Gradient boosting model file {gradient_boosting_model_path} not found. Creating new instance.")
        except Exception as e:
            logger.error(f"Error initializing gradient boosting model: {e}")
            self.gradient_boosting_model = None
        
        # Load meta-learner if available
        try:
            meta_learner_path = os.path.join(
                self.config.get("model_dir", "./models"),
                self.config.get("ensemble_model_filename", "ensemble_risk_model.joblib")
            )
            
            if os.path.exists(meta_learner_path):
                self.meta_learner = joblib.load(meta_learner_path)
                logger.info(f"Meta-learner loaded from {meta_learner_path}")
            else:
                logger.warning(f"Meta-learner file {meta_learner_path} not found. Will be trained.")
        except Exception as e:
            logger.error(f"Error loading meta-learner: {e}")
            self.meta_learner = None
    
    def _init_meta_learner(self):
        """Initialize meta-learner model."""
        meta_learner_config = self.config.get("meta_learner", {})
        learner_type = meta_learner_config.get("type", "logistic_regression")
        learner_params = meta_learner_config.get("params", {})
        
        if learner_type == "logistic_regression":
            self.meta_learner = LogisticRegression(**learner_params)
        elif learner_type == "random_forest":
            self.meta_learner = RandomForestClassifier(**learner_params)
        else:
            logger.warning(f"Unknown meta-learner type: {learner_type}. Using logistic regression.")
            self.meta_learner = LogisticRegression(C=1.0, penalty="l2", solver="lbfgs", max_iter=1000)
    
    def save_model(self) -> bool:
        """Save trained ensemble model."""
        try:
            if self.meta_learner is None:
                logger.error("No meta-learner to save")
                return False
                
            model_dir = self.config.get("model_dir", "./models")
            os.makedirs(model_dir, exist_ok=True)
            
            model_filename = self.config.get("ensemble_model_filename", "ensemble_risk_model.joblib")
            model_path = os.path.join(model_dir, model_filename)
            
            joblib.dump(self.meta_learner, model_path)
            logger.info(f"Ensemble model saved to {model_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving ensemble model: {e}")
            return False
    
    def _get_base_predictions(self, data: pd.DataFrame) -> np.ndarray:
        """
        Get predictions from all base models.
        
        Args:
            data: DataFrame with features
            
        Returns:
            Array of predictions from all models
        """
        predictions = []
        
        # Get transformer model predictions if available
        if self.transformer_model is not None:
            try:
                transformer_preds = self.transformer_model.predict(data)
                if isinstance(transformer_preds, list):
                    transformer_preds = np.array([p.get('riskScore', 50) / 100.0 for p in transformer_preds])
                predictions.append(transformer_preds.reshape(-1, 1))
                logger.debug("Added transformer model predictions")
            except Exception as e:
                logger.error(f"Error getting transformer predictions: {e}")
                # Add zeros as placeholder
                predictions.append(np.zeros((len(data), 1)))
        else:
            # Add zeros as placeholder
            predictions.append(np.zeros((len(data), 1)))
        
        # Get gradient boosting model predictions if available
        if self.gradient_boosting_model is not None and self.gradient_boosting_model.model is not None:
            try:
                gb_preds = self.gradient_boosting_model.predict(data)
                predictions.append(gb_preds.reshape(-1, 1))
                logger.debug("Added gradient boosting model predictions")
            except Exception as e:
                logger.error(f"Error getting gradient boosting predictions: {e}")
                # Add zeros as placeholder
                predictions.append(np.zeros((len(data), 1)))
        else:
            # Add zeros as placeholder
            predictions.append(np.zeros((len(data), 1)))
        
        # Add IOTA-specific features (these will help the meta-learner learn when to trust which model)
        iota_features = self.config.get("iota_specific_features", [])
        if len(iota_features) > 0:
            try:
                # Check which features are actually in the data
                available_features = [f for f in iota_features if f in data.columns]
                if available_features:
                    iota_feats = data[available_features].values
                    predictions.append(iota_feats)
                    logger.debug(f"Added {len(available_features)} IOTA-specific features")
            except Exception as e:
                logger.error(f"Error adding IOTA-specific features: {e}")
        
        # Concatenate all predictions
        if len(predictions) > 0:
            return np.hstack(predictions)
        else:
            raise ValueError("No predictions available from any model")
    
    def train(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train the ensemble model.
        
        Args:
            data: DataFrame with features and target
            
        Returns:
            Dictionary with training metrics
        """
        target_column = self.config.get("target_column", "default_risk")
        
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")
        
        logger.info(f"Training ensemble model with {len(data)} samples")
        
        # Train component models if needed
        if self.transformer_model is None or (hasattr(self.transformer_model, 'model') and self.transformer_model.model is None):
            logger.warning("Transformer model not available, skipping training")
        
        if self.gradient_boosting_model is None or self.gradient_boosting_model.model is None:
            logger.info("Training gradient boosting model")
            self.gradient_boosting_model = GradientBoostingRiskModel()
            self.gradient_boosting_model.train(data)
        
        # Get base model predictions
        X_meta = self._get_base_predictions(data)
        y = data[target_column].values
        
        # Split data
        test_size = self.config.get("test_size", 0.2)
        random_state = self.config.get("random_state", 42)
        X_train, X_test, y_train, y_test = train_test_split(
            X_meta, y, test_size=test_size, random_state=random_state
        )
        
        # Initialize meta-learner if needed
        if self.meta_learner is None:
            self._init_meta_learner()
        
        # Train meta-learner
        self.meta_learner.fit(X_train, y_train)
        
        # Evaluate model
        y_pred_proba = self.meta_learner.predict_proba(X_test)[:, 1]
        threshold = self.config.get("threshold", 0.5)
        y_pred_binary = (y_pred_proba >= threshold).astype(int)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred_binary)
        precision = precision_score(y_test, y_pred_binary, zero_division=0)
        recall = recall_score(y_test, y_pred_binary, zero_division=0)
        f1 = f1_score(y_test, y_pred_binary, zero_division=0)
        
        logger.info(f"Ensemble model training complete with accuracy: {accuracy:.4f}")
        
        # Save model
        self.save_model()
        
        # Calculate model importance if meta-learner supports it
        model_importance = {}
        if hasattr(self.meta_learner, 'coef_'):
            coef = self.meta_learner.coef_[0]
            model_importance = {
                "transformer_model": abs(float(coef[0])),
                "gradient_boosting_model": abs(float(coef[1]))
            }
            
            # Add feature importance if used
            iota_features = self.config.get("iota_specific_features", [])
            available_features = [f for f in iota_features if f in data.columns]
            if available_features and len(coef) > 2:
                for i, feature in enumerate(available_features):
                    if i + 2 < len(coef):
                        model_importance[f"iota_feature_{feature}"] = abs(float(coef[i + 2]))
        
        return {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "model_importance": model_importance,
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "trained_at": datetime.now().isoformat()
        }
    
    def predict(self, data: pd.DataFrame) -> np.ndarray:
        """
        Make predictions with the trained ensemble model.
        
        Args:
            data: DataFrame with features
            
        Returns:
            Array of predicted probabilities
        """
        if self.meta_learner is None:
            raise ValueError("Meta-learner not trained or loaded")
        
        # Get base model predictions
        X_meta = self._get_base_predictions(data)
        
        # Make predictions
        return self.meta_learner.predict_proba(X_meta)[:, 1]
    
    def predict_with_uncertainty(self, data: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make predictions with uncertainty estimation.
        
        Args:
            data: DataFrame with features
            
        Returns:
            Tuple of (predictions, uncertainties)
        """
        if self.meta_learner is None:
            raise ValueError("Meta-learner not trained or loaded")
        
        # Get base model predictions
        X_meta = self._get_base_predictions(data)
        
        # Make predictions
        predictions = self.meta_learner.predict_proba(X_meta)[:, 1]
        
        # Calculate uncertainty
        uncertainties = self._calculate_uncertainty(data, X_meta)
        
        return predictions, uncertainties
    
    def _calculate_uncertainty(self, data: pd.DataFrame, X_meta: np.ndarray) -> np.ndarray:
        """
        Calculate prediction uncertainty.
        
        Args:
            data: Original data
            X_meta: Meta-features for ensemble
            
        Returns:
            Array of uncertainty scores
        """
        # Initialize uncertainties
        uncertainties = np.zeros(len(data))
        
        # Method 1: Model disagreement
        try:
            # Check if we have predictions from both models
            if X_meta.shape[1] >= 2:
                # Calculate disagreement between base models
                model_disagreement = np.abs(X_meta[:, 0] - X_meta[:, 1])
                uncertainties += model_disagreement
        except Exception as e:
            logger.error(f"Error calculating model disagreement: {e}")
        
        # Method 2: Distance from decision boundary for logistic regression
        try:
            if hasattr(self.meta_learner, 'decision_function'):
                # Decision function distance correlates with confidence
                decision_distances = np.abs(self.meta_learner.decision_function(X_meta))
                # Normalize and invert (smaller distance = higher uncertainty)
                max_distance = np.max(decision_distances) if len(decision_distances) > 0 else 1
                if max_distance > 0:
                    normalized_distances = decision_distances / max_distance
                    uncertainties += (1 - normalized_distances)
        except Exception as e:
            logger.error(f"Error calculating decision boundary distance: {e}")
        
        # Method 3: Data quality factors from IOTA features
        try:
            # Check for specific features that might indicate uncertainty
            if "used_real_iota_data" in data.columns:
                # Less confidence if we didn't use real IOTA data
                not_real_data_mask = (data["used_real_iota_data"] < 0.5).values
                uncertainties[not_real_data_mask] += 0.3
                
            if "transaction_count" in data.columns:
                # Less confidence with very few transactions
                low_tx_mask = (data["transaction_count"] < 5).values
                uncertainties[low_tx_mask] += 0.2
        except Exception as e:
            logger.error(f"Error applying data quality factors: {e}")
        
        # Normalize to [0, 1]
        uncertainties = np.clip(uncertainties, 0, 1)
        
        return uncertainties
    
    def predict_risk_class(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Predict risk class and provide detailed output.
        
        Args:
            data: DataFrame with features
            
        Returns:
            List of dictionaries with risk scores and classes
        """
        use_uncertainty = self.config.get("use_uncertainty", True)
        
        if use_uncertainty:
            risk_probs, uncertainties = self.predict_with_uncertainty(data)
        else:
            risk_probs = self.predict(data)
            uncertainties = np.zeros(len(data))
        
        # Convert to risk scores (0-100)
        risk_scores = risk_probs * 100
        
        # Determine risk classes based on thresholds
        thresholds = [20, 40, 60, 80]
        risk_classes = ["Very Low Risk", "Low Risk", "Medium Risk", "High Risk", "Very High Risk"]
        
        results = []
        for i, score in enumerate(risk_scores):
            # Determine risk class
            risk_class_idx = 0
            for j, threshold in enumerate(thresholds):
                if score >= threshold:
                    risk_class_idx = j + 1
            
            # Calculate confidence score
            confidence_score = 1.0 - uncertainties[i]
            
            # Get component model scores if available
            component_scores = {}
            try:
                X_meta = self._get_base_predictions(data.iloc[[i]])
                if X_meta.shape[1] >= 2:
                    component_scores = {
                        "transformerScore": float(X_meta[0, 0] * 100),
                        "gradientBoostingScore": float(X_meta[0, 1] * 100)
                    }
            except Exception as e:
                logger.error(f"Error getting component scores: {e}")
            
            results.append({
                "riskScore": float(score),
                "riskClass": risk_classes[risk_class_idx],
                "confidenceScore": float(confidence_score),
                "uncertainty": float(uncertainties[i]),
                "componentScores": component_scores,
                "timestamp": datetime.now().isoformat()
            })
        
        return results

# Test function
if __name__ == "__main__":
    # Create test data
    np.random.seed(42)
    n_samples = 1000
    
    # Generate synthetic data
    data = {
        "transaction_count": np.random.poisson(10, n_samples),
        "message_count": np.random.poisson(5, n_samples),
        "balance": np.random.exponential(100, n_samples),
        "activity_regularity": np.random.beta(5, 2, n_samples),
        "first_activity_days": np.random.randint(1, 365, n_samples),
        "native_tokens_count": np.random.poisson(2, n_samples),
        "cross_layer_transfers": np.random.poisson(3, n_samples),
        "identity_verification": np.random.choice([0, 0.3, 0.7, 1.0], n_samples),
        "wallet_balance": np.random.exponential(200, n_samples),
        "collateral_ratio": np.random.beta(5, 2, n_samples) * 5,
        "repayment_ratio": np.random.beta(8, 2, n_samples),
        "previous_loans_count": np.random.poisson(3, n_samples),
        "used_real_iota_data": np.random.choice([0, 1], n_samples, p=[0.2, 0.8])
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate target variable (simplified model)
    # Higher default risk if low collateral ratio and low repayment ratio
    df["default_risk"] = ((df["collateral_ratio"] < 1.5) & 
                           (df["repayment_ratio"] < 0.7) & 
                           (df["transaction_count"] < 5)).astype(int)
    
    # Initialize model
    model = EnsembleRiskModel()
    
    # Train model
    metrics = model.train(df)
    
    print("Training metrics:", metrics)
    
    # Make predictions
    test_sample = df.iloc[:5].copy()
    predictions = model.predict_risk_class(test_sample)
    
    print("\nPredictions:")
    for i, pred in enumerate(predictions):
        print(f"Sample {i}: Risk Score = {pred['riskScore']:.2f}, Class = {pred['riskClass']}, Confidence = {pred['confidenceScore']:.2f}")
        if 'componentScores' in pred and pred['componentScores']:
            print(f"  Component Scores: Transformer = {pred['componentScores'].get('transformerScore', 'N/A')}, Gradient Boosting = {pred['componentScores'].get('gradientBoostingScore', 'N/A')}")
