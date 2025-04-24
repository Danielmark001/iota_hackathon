"""
Tests for the IntelliLend Risk Assessment Model.
"""

import unittest
import sys
import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from risk_model import RiskAssessmentModel, simulate_training_data

class TestRiskModel(unittest.TestCase):
    """Test suite for the risk assessment model."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create model instance
        self.model = RiskAssessmentModel()
        
        # Generate simulated data
        self.X, self.y = simulate_training_data(n_samples=500)
        
        # Split into train and test sets
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, test_size=0.2, random_state=42
        )
    
    def test_model_initialization(self):
        """Test that the model initializes correctly."""
        self.assertIsNotNone(self.model)
        self.assertIsNone(self.model.pipeline)
        self.assertEqual(len(self.model.features), 10)
    
    def test_preprocess_data(self):
        """Test data preprocessing."""
        # Create a DataFrame with missing values
        data = pd.DataFrame({
            'transaction_count': [10, np.nan, 5],
            'avg_transaction_value': [100, 200, np.nan],
            'wallet_age_days': [365, 180, 90],
            'previous_loans_count': [np.nan, 2, 3],
            'repayment_ratio': [0.9, np.nan, 0.7],
            'default_count': [0, 1, np.nan],
            'collateral_diversity': [2, np.nan, 1],
            'cross_chain_activity': [np.nan, 3, 2],
            'lending_protocol_interactions': [5, 10, np.nan],
            'wallet_balance_volatility': [2.5, np.nan, 1.8]
        })
        
        # Preprocess data
        processed_data = self.model.preprocess_data(data)
        
        # Check that missing values were filled
        self.assertEqual(processed_data.isnull().sum().sum(), 0)
        
        # Check that new features were created
        self.assertIn('risk_indicator', processed_data.columns)
        self.assertIn('activity_score', processed_data.columns)
    
    def test_model_training(self):
        """Test model training."""
        # Train the model
        self.model.train(self.X_train, self.y_train)
        
        # Check that the pipeline was created
        self.assertIsNotNone(self.model.pipeline)
        
        # Check prediction on test data
        y_pred = self.model.pipeline.predict(self.X_test)
        self.assertEqual(len(y_pred), len(self.y_test))
    
    def test_risk_score_prediction(self):
        """Test risk score prediction."""
        # Train the model
        self.model.train(self.X_train, self.y_train)
        
        # Create a sample user
        user_data = pd.DataFrame({
            'transaction_count': [15],
            'avg_transaction_value': [150],
            'wallet_age_days': [200],
            'previous_loans_count': [2],
            'repayment_ratio': [0.8],
            'default_count': [0],
            'collateral_diversity': [2],
            'cross_chain_activity': [1],
            'lending_protocol_interactions': [8],
            'wallet_balance_volatility': [1.5]
        })
        
        # Predict risk score
        risk_score = self.model.predict_risk_score(user_data)
        
        # Check that the risk score is within the expected range (0-100)
        self.assertGreaterEqual(risk_score[0], 0)
        self.assertLessEqual(risk_score[0], 100)
    
    def test_feature_importance(self):
        """Test feature importance retrieval."""
        # Train the model
        self.model.train(self.X_train, self.y_train)
        
        # Get feature importance
        importance = self.model.get_feature_importance()
        
        # Check that importance DataFrame has the expected structure
        self.assertEqual(len(importance), len(self.model.features))
        self.assertIn('Feature', importance.columns)
        self.assertIn('Importance', importance.columns)
        
        # Check that importance values sum to approximately 1
        self.assertAlmostEqual(importance['Importance'].sum(), 1.0, places=5)
    
    def test_save_and_load_model(self):
        """Test saving and loading the model."""
        # Train the model
        self.model.train(self.X_train, self.y_train)
        
        # Save the model to a temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.joblib') as f:
            self.model.save_model(f.name)
            
            # Create a new model instance
            new_model = RiskAssessmentModel()
            
            # Load the model
            new_model.load_model(f.name)
            
            # Check that the new model can make predictions
            user_data = pd.DataFrame({
                'transaction_count': [15],
                'avg_transaction_value': [150],
                'wallet_age_days': [200],
                'previous_loans_count': [2],
                'repayment_ratio': [0.8],
                'default_count': [0],
                'collateral_diversity': [2],
                'cross_chain_activity': [1],
                'lending_protocol_interactions': [8],
                'wallet_balance_volatility': [1.5]
            })
            
            risk_score1 = self.model.predict_risk_score(user_data)
            risk_score2 = new_model.predict_risk_score(user_data)
            
            # The scores should be the same since it's the same model
            self.assertEqual(risk_score1[0], risk_score2[0])
    
    def test_error_handling(self):
        """Test error handling for the model."""
        # Test prediction without training
        user_data = pd.DataFrame({
            'transaction_count': [15],
            'avg_transaction_value': [150],
            'wallet_age_days': [200],
            'previous_loans_count': [2],
            'repayment_ratio': [0.8],
            'default_count': [0],
            'collateral_diversity': [2],
            'cross_chain_activity': [1],
            'lending_protocol_interactions': [8],
            'wallet_balance_volatility': [1.5]
        })
        
        # Calling predict_risk_score without training should raise ValueError
        with self.assertRaises(ValueError):
            self.model.predict_risk_score(user_data)
        
        # Test saving model without training
        with self.assertRaises(ValueError):
            self.model.save_model('nonexistent_model.joblib')

if __name__ == '__main__':
    unittest.main()
