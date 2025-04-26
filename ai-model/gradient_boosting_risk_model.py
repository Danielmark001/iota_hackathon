"""
Gradient Boosting Risk Assessment Model

This module implements a gradient boosting model for risk assessment using XGBoost.
It focuses on lending/borrowing risk prediction with IOTA-specific features.
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from datetime import datetime
from typing import Dict, Any, List, Optional, Union, Tuple
import joblib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("gradient_boosting_model.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class GradientBoostingRiskModel:
    """
    Gradient Boosting model for risk assessment using XGBoost.
    This model specializes in lending risk prediction with IOTA-specific features.
    """
    
    def __init__(self, config_path="config/gradient_boosting_config.json"):
        """
        Initialize the gradient boosting model.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize feature preprocessing
        self.scaler = StandardScaler()
        
        # Initialize XGBoost model
        self.model = None
        
        # Load model if available
        self._load_model()
        
        logger.info("Gradient Boosting Risk Model initialized")
    
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
                "model_filename": "xgboost_risk_model.joblib",
                "features": [
                    "transaction_count",
                    "message_count",
                    "balance",
                    "activity_regularity",
                    "first_activity_days",
                    "native_tokens_count",
                    "cross_layer_transfers",
                    "identity_verification",
                    "wallet_balance",
                    "collateral_ratio",
                    "repayment_ratio",
                    "previous_loans_count"
                ],
                "hyperparameters": {
                    "n_estimators": 100,
                    "max_depth": 5,
                    "learning_rate": 0.1,
                    "subsample": 0.8,
                    "colsample_bytree": 0.8,
                    "objective": "binary:logistic",
                    "eval_metric": "auc"
                },
                "target_column": "default_risk",
                "test_size": 0.2,
                "random_state": 42,
                "threshold": 0.5
            }
    
    def _load_model(self) -> bool:
        """Load trained model if available."""
        try:
            model_dir = self.config.get("model_dir", "./models")
            model_filename = self.config.get("model_filename", "xgboost_risk_model.joblib")
            model_path = os.path.join(model_dir, model_filename)
            
            if os.path.exists(model_path):
                self.model = joblib.load(model_path)
                logger.info(f"Model loaded from {model_path}")
                return True
            else:
                logger.warning(f"Model file {model_path} not found.")
                return False
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self) -> bool:
        """Save trained model."""
        try:
            if self.model is None:
                logger.error("No model to save")
                return False
                
            model_dir = self.config.get("model_dir", "./models")
            os.makedirs(model_dir, exist_ok=True)
            
            model_filename = self.config.get("model_filename", "xgboost_risk_model.joblib")
            model_path = os.path.join(model_dir, model_filename)
            
            joblib.dump(self.model, model_path)
            logger.info(f"Model saved to {model_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False
    
    def preprocess_features(self, data: pd.DataFrame, fit: bool = False) -> np.ndarray:
        """
        Preprocess features for model training or prediction.
        
        Args:
            data: DataFrame with features
            fit: Whether to fit the scaler (for training) or just transform (for prediction)
            
        Returns:
            Preprocessed features as numpy array
        """
        # Select features
        features = self.config.get("features", [])
        X = data[features].copy()
        
        # Handle missing values
        X.fillna(0, inplace=True)
        
        # Scale features
        if fit:
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)
            
        return X_scaled
    
    def train(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train the gradient boosting model.
        
        Args:
            data: DataFrame with features and target
            
        Returns:
            Dictionary with training metrics
        """
        target_column = self.config.get("target_column", "default_risk")
        
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")
        
        logger.info(f"Training model with {len(data)} samples")
        
        # Preprocess features
        X = self.preprocess_features(data, fit=True)
        y = data[target_column].values
        
        # Split data
        test_size = self.config.get("test_size", 0.2)
        random_state = self.config.get("random_state", 42)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        
        # Get hyperparameters
        hyperparameters = self.config.get("hyperparameters", {})
        
        # Train model
        self.model = xgb.XGBClassifier(**hyperparameters)
        self.model.fit(X_train, y_train, eval_set=[(X_test, y_test)], early_stopping_rounds=10)
        
        # Evaluate model
        y_pred = self.model.predict(X_test)
        threshold = self.config.get("threshold", 0.5)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        y_pred_binary = (y_pred_proba >= threshold).astype(int)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred_binary)
        precision = precision_score(y_test, y_pred_binary, zero_division=0)
        recall = recall_score(y_test, y_pred_binary, zero_division=0)
        f1 = f1_score(y_test, y_pred_binary, zero_division=0)
        
        logger.info(f"Model training complete with accuracy: {accuracy:.4f}")
        
        # Save model
        self.save_model()
        
        return {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "feature_importance": dict(zip(
                self.config.get("features", []),
                self.model.feature_importances_
            )),
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "trained_at": datetime.now().isoformat()
        }
    
    def hyperparameter_tuning(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Perform hyperparameter tuning using grid search.
        
        Args:
            data: DataFrame with features and target
            
        Returns:
            Dictionary with best parameters and performance metrics
        """
        target_column = self.config.get("target_column", "default_risk")
        
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")
        
        logger.info(f"Performing hyperparameter tuning with {len(data)} samples")
        
        # Preprocess features
        X = self.preprocess_features(data, fit=True)
        y = data[target_column].values
        
        # Split data
        test_size = self.config.get("test_size", 0.2)
        random_state = self.config.get("random_state", 42)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        
        # Define parameter grid
        param_grid = {
            'max_depth': [3, 5, 7],
            'learning_rate': [0.01, 0.1, 0.2],
            'n_estimators': [50, 100, 200],
            'subsample': [0.6, 0.8, 1.0],
            'colsample_bytree': [0.6, 0.8, 1.0]
        }
        
        # Create base model
        base_model = xgb.XGBClassifier(
            objective='binary:logistic',
            eval_metric='auc',
            use_label_encoder=False,
            random_state=random_state
        )
        
        # Perform grid search
        grid_search = GridSearchCV(
            estimator=base_model,
            param_grid=param_grid,
            cv=5,
            scoring='roc_auc',
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        # Get best parameters
        best_params = grid_search.best_params_
        logger.info(f"Best parameters: {best_params}")
        
        # Train model with best parameters
        self.model = xgb.XGBClassifier(**best_params, 
                                       objective='binary:logistic',
                                       eval_metric='auc',
                                       use_label_encoder=False)
        self.model.fit(X_train, y_train)
        
        # Evaluate model
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        threshold = self.config.get("threshold", 0.5)
        y_pred_binary = (y_pred_proba >= threshold).astype(int)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred_binary)
        precision = precision_score(y_test, y_pred_binary, zero_division=0)
        recall = recall_score(y_test, y_pred_binary, zero_division=0)
        f1 = f1_score(y_test, y_pred_binary, zero_division=0)
        
        logger.info(f"Tuned model accuracy: {accuracy:.4f}")
        
        # Update config with best parameters
        self.config["hyperparameters"].update(best_params)
        
        # Save model
        self.save_model()
        
        return {
            "best_parameters": best_params,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "feature_importance": dict(zip(
                self.config.get("features", []),
                self.model.feature_importances_
            )),
            "cv_results": grid_search.cv_results_,
            "best_score": grid_search.best_score_,
            "tuned_at": datetime.now().isoformat()
        }
    
    def predict(self, data: pd.DataFrame) -> np.ndarray:
        """
        Make predictions with the trained model.
        
        Args:
            data: DataFrame with features
            
        Returns:
            Array of predicted probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        # Preprocess features
        X = self.preprocess_features(data, fit=False)
        
        # Make predictions
        return self.model.predict_proba(X)[:, 1]
    
    def predict_risk_class(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Predict risk class and provide detailed output.
        
        Args:
            data: DataFrame with features
            
        Returns:
            List of dictionaries with risk scores and classes
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
            
        # Get risk probabilities
        risk_probs = self.predict(data)
        
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
            
            # Get feature importance for this prediction
            feature_importances = {}
            if hasattr(self.model, 'feature_importances_'):
                features = self.config.get("features", [])
                for j, feature in enumerate(features):
                    feature_importances[feature] = float(self.model.feature_importances_[j])
            
            results.append({
                "riskScore": float(score),
                "riskClass": risk_classes[risk_class_idx],
                "probability": float(risk_probs[i]),
                "featureImportance": feature_importances,
                "timestamp": datetime.now().isoformat()
            })
        
        return results
    
    def explain_prediction(self, data: pd.DataFrame, index: int = 0) -> Dict[str, Any]:
        """
        Explain a specific prediction using SHAP values.
        
        Args:
            data: DataFrame with features
            index: Index of the sample to explain
            
        Returns:
            Dictionary with explanation details
        """
        try:
            import shap
        except ImportError:
            logger.error("SHAP not installed. Run 'pip install shap' to enable prediction explanations.")
            return {"error": "SHAP not installed"}
        
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        # Get single sample to explain
        sample = data.iloc[[index]].copy()
        
        # Preprocess features
        X = self.preprocess_features(sample, fit=False)
        
        # Create explainer
        explainer = shap.TreeExplainer(self.model)
        
        # Calculate SHAP values
        shap_values = explainer.shap_values(X)
        
        # Get feature names
        features = self.config.get("features", [])
        
        # Create explanation
        explanation = {
            "baseValue": float(explainer.expected_value),
            "prediction": float(self.model.predict_proba(X)[0, 1]),
            "features": []
        }
        
        # Get SHAP values for class 1 (default risk)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # For binary classification, get class 1
        
        # Sort features by importance
        feature_importance = [(features[i], abs(shap_values[0][i])) for i in range(len(features))]
        feature_importance.sort(key=lambda x: x[1], reverse=True)
        
        # Add feature explanations
        for feature_name, importance in feature_importance:
            feature_idx = features.index(feature_name)
            feature_value = X[0, feature_idx]
            shap_value = float(shap_values[0][feature_idx])
            
            explanation["features"].append({
                "name": feature_name,
                "value": float(feature_value),
                "shapValue": shap_value,
                "importance": float(importance),
                "impact": "positive" if shap_value > 0 else "negative"
            })
        
        return explanation

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
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate target variable (simplified model)
    # Higher default risk if low collateral ratio and low repayment ratio
    df["default_risk"] = ((df["collateral_ratio"] < 1.5) & 
                           (df["repayment_ratio"] < 0.7) & 
                           (df["transaction_count"] < 5)).astype(int)
    
    # Initialize model
    model = GradientBoostingRiskModel()
    
    # Train model
    metrics = model.train(df)
    
    print("Training metrics:", metrics)
    
    # Make predictions
    test_sample = df.iloc[:5].copy()
    predictions = model.predict_risk_class(test_sample)
    
    print("\nPredictions:")
    for i, pred in enumerate(predictions):
        print(f"Sample {i}: Risk Score = {pred['riskScore']:.2f}, Class = {pred['riskClass']}")
        
    # Explain prediction
    explanation = model.explain_prediction(df, 0)
    
    print("\nExplanation for first sample:")
    print(f"Prediction: {explanation['prediction']:.4f}")
    print("Top features:")
    for feature in explanation["features"][:5]:
        print(f"- {feature['name']}: value={feature['value']:.4f}, impact={feature['impact']}, importance={feature['importance']:.4f}")
