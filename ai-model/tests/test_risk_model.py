"""
Unit tests for the IntelliLend Risk Assessment Model
"""

import sys
import os
import unittest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock

# Add parent directory to path to import risk_model
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from risk_model import RiskAssessmentModel, simulate_training_data

class TestRiskAssessmentModel(unittest.TestCase):
    """Test cases for the risk assessment model"""
    
    def setUp(self):
        """Set up test environment before each test"""
        self.model = RiskAssessmentModel()
        
        # Create some test data
        self.test_data = pd.DataFrame({
            'user_id': ['user_1', 'user_2', 'user_3'],
            'transaction_count': [50, 20, 100],
            'avg_transaction_value': [200, 500, 100],
            'wallet_age_days': [365, 30, 730],
            'previous_loans_count': [3, 0, 10],
            'repayment_ratio': [0.95, 0.0, 0.85],
            'default_count': [0, 0, 2],
            'collateral_diversity': [3, 1, 5],
            'cross_chain_activity': [2, 0, 8],
            'lending_protocol_interactions': [10, 1, 20],
            'wallet_balance_volatility': [0.1, 0.4, 0.2]
        })
        
        # Expected risk categories for the test data
        # user_1: low risk, user_2: high risk, user_3: medium risk
        self.expected_categories = [0, 2, 1]
    
    def test_preprocess_data(self):
        """Test data preprocessing function"""
        processed_data = self.model.preprocess_data(self.test_data)
        
        # Check if all the required derived features are created
        self.assertIn('default_risk_ratio', processed_data.columns)
        self.assertIn('late_payment_risk', processed_data.columns)
        self.assertIn('lending_engagement', processed_data.columns)
        
        # Check specific computed values
        # Default risk ratio for user_3 should be 2/11
        expected_risk_ratio = 2.0 / 11.0
        self.assertAlmostEqual(
            processed_data.loc[2, 'default_risk_ratio'], 
            expected_risk_ratio, 
            places=5
        )
        
        # Lending engagement for user_1 should be 50*10/366
        expected_engagement = (50 * 10) / 366.0
        self.assertAlmostEqual(
            processed_data.loc[0, 'lending_engagement'], 
            expected_engagement, 
            places=5
        )
    
    def test_simulation_data(self):
        """Test the data simulation function"""
        data, y_risk, default_prob, temporal_data = simulate_training_data(100)
        
        # Check dimensions
        self.assertEqual(len(data), 100)
        self.assertEqual(len(y_risk), 100)
        self.assertEqual(len(default_prob), 100)
        
        # Check if temporal data contains at least some users
        self.assertGreater(len(temporal_data), 0)
        
        # Check if a user has temporal data
        first_user = list(temporal_data.keys())[0]
        self.assertIn('timestamp', temporal_data[first_user].columns)
        self.assertIn('transaction_count', temporal_data[first_user].columns)
        
        # Verify that all default probabilities are between 0 and 1
        self.assertTrue(all(0 <= p <= 1 for p in default_prob))
        
        # Verify that all risk categories are between 0 and 3
        self.assertTrue(all(0 <= r <= 3 for r in y_risk))
    
    @patch('risk_model.RiskAssessmentModel.train_risk_classifier')
    @patch('risk_model.RiskAssessmentModel.train_default_predictor')
    @patch('risk_model.RiskAssessmentModel.train_time_series_models')
    @patch('risk_model.RiskAssessmentModel.train_interest_optimizer')
    def test_risk_score_calculation(self, mock_optimizer, mock_ts, mock_default, mock_risk):
        """Test the risk score calculation logic"""
        # Setup mocks
        mock_classifier = MagicMock()
        mock_classifier.predict.side_effect = lambda x: np.array(self.expected_categories)
        
        mock_default_predictor = MagicMock()
        mock_default_predictor.predict.side_effect = lambda x: np.array([0.05, 0.6, 0.3])
        
        # Assign mocks to model
        self.model.risk_classifier = mock_classifier
        self.model.default_predictor = mock_default_predictor
        
        # Test risk score calculation
        risk_scores = []
        for i in range(len(self.test_data)):
            user_data = self.test_data.iloc[[i]].copy()
            risk_score = self.model.calculate_risk_score(user_data)
            risk_scores.append(risk_score)
        
        # Check if risk scores are calculated correctly
        # Low risk user should have lower score than medium risk user
        self.assertLess(risk_scores[0], risk_scores[2])
        
        # High risk user should have higher score than medium risk user
        self.assertGreater(risk_scores[1], risk_scores[2])
        
        # All scores should be between 0 and 100
        for score in risk_scores:
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 100)
    
    def test_early_warning_signals(self):
        """Test early warning signals generation"""
        # Create a model with mocked prediction methods
        model = RiskAssessmentModel()
        
        # User with high default probability
        high_risk_user = pd.DataFrame({
            'user_id': ['high_risk'],
            'default_count': [2],
            'previous_loans_count': [5],
            'repayment_ratio': [0.6],
            'wallet_balance_volatility': [0.7]
        })
        
        # User with low risk
        low_risk_user = pd.DataFrame({
            'user_id': ['low_risk'],
            'default_count': [0],
            'previous_loans_count': [10],
            'repayment_ratio': [0.95],
            'wallet_balance_volatility': [0.1]
        })
        
        # Mock the default probability prediction
        model.default_predictor = MagicMock()
        model.default_predictor.predict.side_effect = lambda x: np.array([0.8]) if x.iloc[0]['default_count'] > 0 else np.array([0.05])
        
        # Generate warnings
        high_risk_warnings = model.get_early_warning_signals('high_risk', high_risk_user)
        low_risk_warnings = model.get_early_warning_signals('low_risk', low_risk_user)
        
        # High risk user should have multiple warnings
        self.assertGreater(len(high_risk_warnings), 0)
        
        # Check for specific warning types
        self.assertIn('high_default_probability', high_risk_warnings)
        self.assertIn('high_wallet_volatility', high_risk_warnings)
        
        # Check severity levels
        self.assertEqual(high_risk_warnings['high_default_probability']['severity'], 'high')
        
        # Low risk user should have few or no warnings
        self.assertLessEqual(len(low_risk_warnings), 1)

    def test_interest_rate_optimization(self):
        """Test interest rate optimization with market conditions"""
        # Create an environment for interest rate optimization
        env_config = {
            'market_conditions': {
                'base_rate': 0.03,
                'market_volatility': 0.2,
                'platform_liquidity': 0.7
            }
        }
        
        # Create different user profiles
        low_risk_user = {
            'transaction_count': 100,
            'wallet_age_days': 500,
            'repayment_ratio': 0.98,
            'default_count': 0,
            'wallet_balance_volatility': 0.05,
            'risk_score': 20
        }
        
        high_risk_user = {
            'transaction_count': 10,
            'wallet_age_days': 30,
            'repayment_ratio': 0.6,
            'default_count': 2,
            'wallet_balance_volatility': 0.4,
            'risk_score': 80
        }
        
        # Mock the interest optimizer model
        optimizer = MagicMock()
        optimizer.predict.side_effect = lambda x, y: 0.035 if x['risk_score'] < 50 else 0.12
        
        # Assign to model
        self.model.interestOptimizer = optimizer
        
        # Test optimization for different users
        low_rate = self.model.optimize_interest_rate(
            low_risk_user, 
            env_config['market_conditions']
        )
        
        high_rate = self.model.optimize_interest_rate(
            high_risk_user, 
            env_config['market_conditions']
        )
        
        # High risk user should get a higher rate
        self.assertLess(low_rate, high_rate)
        
        # Rates should be within reasonable bounds
        self.assertGreaterEqual(low_rate, 0.01)  # Minimum 1%
        self.assertLessEqual(high_rate, 0.25)    # Maximum 25%


if __name__ == '__main__':
    unittest.main()
