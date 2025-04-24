"""
Feature Processor

This module handles feature extraction, transformation, and normalization
for the IntelliLend risk assessment model.
"""

import os
import logging
import json
import datetime
import pickle
from typing import Dict, List, Optional, Union, Any
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from imblearn.over_sampling import SMOTE

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FeatureProcessor:
    """
    Class for preprocessing and engineering features for the risk assessment model
    """
    
    def __init__(
        self,
        feature_config_path: str = "../config/feature_config.json",
        model_dir: str = "../models",
        scaler_type: str = "robust",  # "standard", "minmax", or "robust"
        use_pca: bool = False,
        pca_components: int = 10,
        impute_strategy: str = "mean"  # "mean", "median", or "most_frequent"
    ):
        """
        Initialize the feature processor
        
        Args:
            feature_config_path: Path to the feature configuration file
            model_dir: Directory to store preprocessing models
            scaler_type: Type of scaler to use
            use_pca: Whether to use PCA for dimensionality reduction
            pca_components: Number of PCA components if use_pca is True
            impute_strategy: Strategy for imputing missing values
        """
        self.feature_config_path = feature_config_path
        self.model_dir = model_dir
        self.scaler_type = scaler_type
        self.use_pca = use_pca
        self.pca_components = pca_components
        self.impute_strategy = impute_strategy
        
        # Create model directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)
        
        # Load feature configuration
        self._load_feature_config()
        
        # Initialize preprocessors
        self._initialize_preprocessors()
    
    def _load_feature_config(self):
        """Load feature configuration from JSON file"""
        try:
            with open(self.feature_config_path, 'r') as f:
                self.feature_config = json.load(f)
                logger.info(f"Loaded feature configuration from {self.feature_config_path}")
        except FileNotFoundError:
            logger.warning(f"Feature configuration file not found at {self.feature_config_path}. Using default configuration.")
            # Default configuration
            self.feature_config = {
                "numerical_features": [
                    "wallet_age_days",
                    "transaction_count",
                    "avg_transaction_value",
                    "transaction_frequency",
                    "balance",
                    "balance_volatility",
                    "deposit_count",
                    "total_deposit_value",
                    "avg_deposit_value",
                    "last_deposit_days",
                    "deposit_frequency",
                    "borrow_count",
                    "total_borrow_value",
                    "avg_borrow_value",
                    "last_borrow_days",
                    "borrow_frequency",
                    "repay_count",
                    "total_repay_value",
                    "avg_repay_value",
                    "last_repay_days",
                    "repay_frequency",
                    "withdraw_count",
                    "total_withdraw_value",
                    "avg_withdraw_value",
                    "last_withdraw_days",
                    "withdraw_frequency",
                    "repayment_ratio",
                    "current_risk_score",
                    "cross_chain_networks_count",
                    "cross_chain_tx_count",
                    "cross_chain_volume",
                    "cross_chain_frequency"
                ],
                "categorical_features": [
                    "is_contract",
                    "active_borrows",
                    "using_as_collateral",
                    "has_cross_chain_activity"
                ],
                "target_feature": "risk_label",
                "feature_importance": {
                    "repayment_ratio": 0.25,
                    "balance_volatility": 0.15,
                    "transaction_frequency": 0.10,
                    "borrow_frequency": 0.10,
                    "deposit_frequency": 0.08,
                    "cross_chain_activity": 0.08,
                    "wallet_age_days": 0.05,
                    "active_borrows": 0.05,
                    "using_as_collateral": 0.04,
                    "cross_chain_volume": 0.03,
                    "last_repay_days": 0.03,
                    "avg_transaction_value": 0.02,
                    "is_contract": 0.02
                },
                "derived_features": [
                    {
                        "name": "borrow_to_deposit_ratio",
                        "formula": "total_borrow_value / (total_deposit_value + 1)",
                        "default_value": 0
                    },
                    {
                        "name": "collateral_utilization",
                        "formula": "total_borrow_value / (total_deposit_value * using_as_collateral + 1)",
                        "default_value": 0
                    },
                    {
                        "name": "activity_intensity",
                        "formula": "(transaction_count + deposit_count + borrow_count + repay_count + withdraw_count) / (wallet_age_days + 1)",
                        "default_value": 0
                    },
                    {
                        "name": "repayment_promptness",
                        "formula": "1 / (last_repay_days + 1)",
                        "default_value": 0
                    },
                    {
                        "name": "cross_chain_intensity",
                        "formula": "cross_chain_tx_count * cross_chain_frequency",
                        "default_value": 0
                    }
                ],
                "feature_scaling": {
                    "balance": {"log_transform": True},
                    "transaction_count": {"log_transform": True},
                    "total_deposit_value": {"log_transform": True},
                    "total_borrow_value": {"log_transform": True},
                    "total_repay_value": {"log_transform": True},
                    "total_withdraw_value": {"log_transform": True},
                    "wallet_age_days": {"log_transform": True},
                    "balance_volatility": {"clip_upper": 10.0}
                }
            }
    
    def _initialize_preprocessors(self):
        """Initialize preprocessing components"""
        logger.info("Initializing feature preprocessors")
        
        # Initialize imputer
        self.imputer = SimpleImputer(strategy=self.impute_strategy)
        
        # Initialize scaler based on selected type
        if self.scaler_type == "standard":
            self.scaler = StandardScaler()
        elif self.scaler_type == "minmax":
            self.scaler = MinMaxScaler()
        elif self.scaler_type == "robust":
            self.scaler = RobustScaler()
        else:
            raise ValueError(f"Unknown scaler type: {self.scaler_type}")
        
        # Initialize PCA if enabled
        if self.use_pca:
            self.pca = PCA(n_components=self.pca_components)
        else:
            self.pca = None
        
        # Build preprocessing pipeline
        pipeline_steps = [
            ('imputer', self.imputer),
            ('scaler', self.scaler)
        ]
        
        if self.use_pca:
            pipeline_steps.append(('pca', self.pca))
        
        self.preprocessing_pipeline = Pipeline(pipeline_steps)
    
    def fit(self, data: pd.DataFrame) -> "FeatureProcessor":
        """
        Fit the feature processor to training data
        
        Args:
            data: DataFrame containing training data
            
        Returns:
            Self for method chaining
        """
        logger.info("Fitting feature processor to training data")
        
        # Apply initial transformations
        processed_data = self._apply_transformations(data)
        
        # Get features list
        numerical_features = self.feature_config["numerical_features"] + [
            f["name"] for f in self.feature_config["derived_features"]
        ]
        categorical_features = self.feature_config["categorical_features"]
        
        # For now, just use numerical features for preprocessing
        # In a full implementation, we would handle categorical features properly
        features_subset = processed_data[numerical_features]
        
        # Fit preprocessing pipeline
        self.preprocessing_pipeline.fit(features_subset)
        
        # Save preprocessor
        self._save_preprocessor()
        
        return self
    
    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Transform data using the fitted preprocessor
        
        Args:
            data: DataFrame to transform
            
        Returns:
            Transformed DataFrame
        """
        logger.info("Transforming data with feature processor")
        
        # Apply initial transformations
        processed_data = self._apply_transformations(data)
        
        # Get features list
        numerical_features = self.feature_config["numerical_features"] + [
            f["name"] for f in self.feature_config["derived_features"]
        ]
        categorical_features = self.feature_config["categorical_features"]
        
        # For now, just use numerical features for preprocessing
        features_subset = processed_data[numerical_features]
        
        # Transform using preprocessing pipeline
        transformed_features = self.preprocessing_pipeline.transform(features_subset)
        
        # Convert back to DataFrame
        if self.use_pca:
            # If using PCA, column names are PCA components
            transformed_df = pd.DataFrame(
                transformed_features,
                index=processed_data.index,
                columns=[f"PC{i+1}" for i in range(self.pca_components)]
            )
        else:
            # If not using PCA, keep original column names
            transformed_df = pd.DataFrame(
                transformed_features,
                index=processed_data.index,
                columns=numerical_features
            )
        
        # Add categorical features back
        for cat_feature in categorical_features:
            if cat_feature in processed_data.columns:
                transformed_df[cat_feature] = processed_data[cat_feature]
        
        # Add target if present
        target_feature = self.feature_config["target_feature"]
        if target_feature in data.columns:
            transformed_df[target_feature] = data[target_feature]
        
        return transformed_df
    
    def fit_transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Fit the preprocessor to the data and transform it
        
        Args:
            data: DataFrame to fit and transform
            
        Returns:
            Transformed DataFrame
        """
        return self.fit(data).transform(data)
    
    def _apply_transformations(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Apply initial transformations to the data
        
        Args:
            data: DataFrame to transform
            
        Returns:
            Transformed DataFrame
        """
        # Create a copy to avoid modifying the original
        transformed_data = data.copy()
        
        # Apply feature scaling from config
        for feature, scaling in self.feature_config.get("feature_scaling", {}).items():
            if feature in transformed_data.columns:
                # Apply log transform if specified
                if scaling.get("log_transform", False):
                    # Add small constant to avoid log(0)
                    transformed_data[feature] = np.log1p(transformed_data[feature].clip(lower=0))
                
                # Apply clipping if specified
                if "clip_lower" in scaling:
                    lower = scaling["clip_lower"]
                    transformed_data[feature] = transformed_data[feature].clip(lower=lower)
                
                if "clip_upper" in scaling:
                    upper = scaling["clip_upper"]
                    transformed_data[feature] = transformed_data[feature].clip(upper=upper)
        
        # Create derived features
        for derived_feature in self.feature_config.get("derived_features", []):
            feature_name = derived_feature["name"]
            formula = derived_feature["formula"]
            default_value = derived_feature.get("default_value", 0)
            
            # Evaluate formula
            try:
                # This is a simplified approach - in a production system,
                # you'd want a safer way to evaluate formulas
                transformed_data[feature_name] = eval(formula, {"__builtins__": {}}, transformed_data)
                
                # Replace NaN with default value
                transformed_data[feature_name].fillna(default_value, inplace=True)
            except Exception as e:
                logger.error(f"Error computing derived feature {feature_name}: {e}")
                transformed_data[feature_name] = default_value
        
        return transformed_data
    
    def _save_preprocessor(self):
        """Save the preprocessor to disk"""
        model_path = os.path.join(self.model_dir, "feature_preprocessor.pkl")
        
        with open(model_path, 'wb') as f:
            pickle.dump(self.preprocessing_pipeline, f)
        
        logger.info(f"Saved preprocessor to {model_path}")
    
    def load_preprocessor(self):
        """Load the preprocessor from disk"""
        model_path = os.path.join(self.model_dir, "feature_preprocessor.pkl")
        
        try:
            with open(model_path, 'rb') as f:
                self.preprocessing_pipeline = pickle.load(f)
            
            logger.info(f"Loaded preprocessor from {model_path}")
        except FileNotFoundError:
            logger.warning(f"Preprocessor file not found at {model_path}. Initialize a new one with fit().")
    
    def calculate_feature_importance(self, trained_model, feature_names=None):
        """
        Calculate feature importance from a trained model
        
        Args:
            trained_model: Trained model with feature_importances_ attribute
            feature_names: Names of features corresponding to importance values
            
        Returns:
            DataFrame with feature importance scores
        """
        if not hasattr(trained_model, 'feature_importances_'):
            logger.warning("Model does not have feature_importances_ attribute")
            return None
        
        if feature_names is None:
            # Get feature names from preprocessing pipeline
            if self.use_pca:
                feature_names = [f"PC{i+1}" for i in range(self.pca_components)]
            else:
                numerical_features = self.feature_config["numerical_features"] + [
                    f["name"] for f in self.feature_config["derived_features"]
                ]
                categorical_features = self.feature_config["categorical_features"]
                feature_names = numerical_features + categorical_features
        
        # Create DataFrame with feature importance
        importance_df = pd.DataFrame({
            'Feature': feature_names,
            'Importance': trained_model.feature_importances_
        })
        
        # Sort by importance
        importance_df = importance_df.sort_values('Importance', ascending=False)
        
        return importance_df
    
    def generate_balanced_dataset(self, data, target_column, sampling_strategy='auto'):
        """
        Generate a balanced dataset using SMOTE
        
        Args:
            data: DataFrame with features and target
            target_column: Name of the target column
            sampling_strategy: Sampling strategy for SMOTE
            
        Returns:
            Tuple of (X_resampled, y_resampled)
        """
        logger.info("Generating balanced dataset with SMOTE")
        
        # Split features and target
        X = data.drop(columns=[target_column])
        y = data[target_column]
        
        # Apply SMOTE
        smote = SMOTE(sampling_strategy=sampling_strategy, random_state=42)
        X_resampled, y_resampled = smote.fit_resample(X, y)
        
        return X_resampled, y_resampled
