"""
IntelliLend Risk Assessment Model

This module contains the machine learning model for assessing borrower risk
based on on-chain activity and other relevant data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, GridSearchCV
import joblib

class RiskAssessmentModel:
    """
    AI model for assessing borrower risk in the IntelliLend platform.
    """
    
    def __init__(self):
        """Initialize the risk assessment model."""
        self.model = None
        self.pipeline = None
        self.features = [
            'transaction_count',
            'avg_transaction_value',
            'wallet_age_days',
            'previous_loans_count',
            'repayment_ratio',
            'default_count',
            'collateral_diversity',
            'cross_chain_activity',
            'lending_protocol_interactions',
            'wallet_balance_volatility'
        ]
    
    def preprocess_data(self, data):
        """
        Preprocess the input data for model training or prediction.
        
        Args:
            data (pd.DataFrame): Raw data containing user features
            
        Returns:
            pd.DataFrame: Preprocessed data
        """
        # Handle missing values
        data = data.fillna({
            'transaction_count': 0,
            'avg_transaction_value': 0,
            'wallet_age_days': 0,
            'previous_loans_count': 0,
            'repayment_ratio': 0.5,
            'default_count': 0,
            'collateral_diversity': 0,
            'cross_chain_activity': 0,
            'lending_protocol_interactions': 0,
            'wallet_balance_volatility': 0
        })
        
        # Feature engineering
        data['risk_indicator'] = (
            data['default_count'] / (data['previous_loans_count'] + 1)
        )
        
        data['activity_score'] = (
            data['transaction_count'] * data['lending_protocol_interactions'] / 
            (data['wallet_age_days'] + 1)
        )
        
        return data
    
    def train(self, X_train, y_train):
        """
        Train the risk assessment model.
        
        Args:
            X_train (pd.DataFrame): Training features
            y_train (pd.Series): Training labels (risk scores)
        """
        # Create a pipeline with preprocessing and model
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('model', RandomForestClassifier(random_state=42))
        ])
        
        # Define hyperparameters for grid search
        param_grid = {
            'model__n_estimators': [50, 100, 200],
            'model__max_depth': [None, 10, 20, 30],
            'model__min_samples_split': [2, 5, 10]
        }
        
        # Perform grid search
        grid_search = GridSearchCV(
            self.pipeline, param_grid, cv=5, scoring='f1_weighted'
        )
        grid_search.fit(X_train, y_train)
        
        # Set the best model
        self.pipeline = grid_search.best_estimator_
        print(f"Best parameters: {grid_search.best_params_}")
        print(f"Best score: {grid_search.best_score_:.4f}")
    
    def predict_risk_score(self, user_data):
        """
        Predict risk score for a user based on their on-chain activity.
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Risk score (0-100, higher means higher risk)
        """
        if not self.pipeline:
            raise ValueError("Model not trained. Call train() first.")
        
        # Preprocess the data
        processed_data = self.preprocess_data(user_data)
        
        # Make prediction (raw model output)
        raw_prediction = self.pipeline.predict_proba(processed_data[self.features])
        
        # Convert to risk score (0-100)
        # Assuming the classes are ordered from lowest to highest risk
        risk_score = np.sum(raw_prediction * np.arange(raw_prediction.shape[1]), axis=1) * 100
        
        return risk_score
    
    def save_model(self, filepath):
        """Save the trained model to a file."""
        if not self.pipeline:
            raise ValueError("No trained model to save.")
        joblib.dump(self.pipeline, filepath)
    
    def load_model(self, filepath):
        """Load a trained model from a file."""
        self.pipeline = joblib.load(filepath)
    
    def get_feature_importance(self):
        """
        Get the importance of each feature in the model.
        
        Returns:
            pd.DataFrame: Feature importance
        """
        if not self.pipeline:
            raise ValueError("Model not trained. Call train() first.")
        
        # Get the model from the pipeline
        model = self.pipeline.named_steps['model']
        
        # Get feature importance
        importance = model.feature_importances_
        
        # Create a DataFrame
        feature_importance = pd.DataFrame({
            'Feature': self.features,
            'Importance': importance
        })
        
        return feature_importance.sort_values('Importance', ascending=False)


def simulate_training_data(n_samples=1000):
    """
    Generate simulated data for testing the model.
    
    Args:
        n_samples (int): Number of samples to generate
        
    Returns:
        tuple: (X_train, y_train) - features and labels
    """
    np.random.seed(42)
    
    # Generate random data
    data = pd.DataFrame({
        'transaction_count': np.random.poisson(20, n_samples),
        'avg_transaction_value': np.random.exponential(100, n_samples),
        'wallet_age_days': np.random.randint(1, 1000, n_samples),
        'previous_loans_count': np.random.poisson(3, n_samples),
        'repayment_ratio': np.random.beta(8, 2, n_samples),
        'default_count': np.random.poisson(0.5, n_samples),
        'collateral_diversity': np.random.randint(1, 5, n_samples),
        'cross_chain_activity': np.random.poisson(2, n_samples),
        'lending_protocol_interactions': np.random.poisson(5, n_samples),
        'wallet_balance_volatility': np.random.gamma(2, 2, n_samples)
    })
    
    # Create risk labels (0: Low, 1: Medium, 2: High)
    # This is a simplified logic for demonstration
    default_ratio = data['default_count'] / (data['previous_loans_count'] + 1)
    repayment_factor = data['repayment_ratio'] * 2
    
    risk_score = default_ratio * 10 - repayment_factor + np.random.normal(0, 0.1, n_samples)
    risk_score = np.clip(risk_score, -1, 1)
    
    # Convert to 3 classes
    bins = [-np.inf, -0.33, 0.33, np.inf]
    labels = [0, 1, 2]
    y = pd.cut(risk_score, bins=bins, labels=labels).astype(int)
    
    return data, y


if __name__ == "__main__":
    # Simulate data
    X, y = simulate_training_data(1000)
    
    # Split into train and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Create and train the model
    model = RiskAssessmentModel()
    model.train(X_train, y_train)
    
    # Evaluate the model
    from sklearn.metrics import classification_report
    
    y_pred = model.pipeline.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    # Save the model
    model.save_model('risk_model.joblib')
    
    # Get feature importance
    importance = model.get_feature_importance()
    print("Feature Importance:")
    print(importance)
