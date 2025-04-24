"""
Train the IntelliLend risk assessment model

This script trains the risk assessment model and saves it for later use.
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from risk_model import RiskAssessmentModel, simulate_training_data

# Create models directory if it doesn't exist
os.makedirs('models', exist_ok=True)

def train_and_save_model():
    """Train and save the risk assessment model."""
    print("Generating simulated training data...")
    X, y = simulate_training_data(n_samples=2000)
    
    # Split into train and test sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"Training data shape: {X_train.shape}")
    print(f"Test data shape: {X_test.shape}")
    
    # Create and train the model
    print("Training model...")
    model = RiskAssessmentModel()
    model.train(X_train, y_train)
    
    # Evaluate the model
    print("Evaluating model...")
    y_pred = model.pipeline.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    # Get feature importance
    importance = model.get_feature_importance()
    print("Feature Importance:")
    print(importance)
    
    # Save the model
    model_path = os.path.join('models', 'risk_model.joblib')
    print(f"Saving model to {model_path}...")
    model.save_model(model_path)
    print("Model saved successfully!")
    
    return model

if __name__ == "__main__":
    print("Training IntelliLend Risk Assessment Model")
    print("=========================================")
    
    model = train_and_save_model()
    
    print("\nTesting model with sample data...")
    # Test prediction with sample data
    sample_data = pd.DataFrame({
        'transaction_count': [25],
        'avg_transaction_value': [150],
        'wallet_age_days': [180],
        'previous_loans_count': [3],
        'repayment_ratio': [0.9],
        'default_count': [0],
        'collateral_diversity': [2],
        'cross_chain_activity': [1],
        'lending_protocol_interactions': [5],
        'wallet_balance_volatility': [1.2]
    })
    
    risk_score = model.predict_risk_score(sample_data)
    print(f"Predicted risk score: {risk_score[0]:.2f}")
    
    print("\nModel training and testing complete!")
