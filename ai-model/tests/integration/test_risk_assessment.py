"""
Integration Test for IOTA Risk Assessment

This script tests the complete risk assessment pipeline with IOTA integration.
"""

import os
import sys
import unittest
import json
import pandas as pd
import numpy as np
from datetime import datetime

# Add parent directory to path to import the model
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from enhanced_iota_risk_model import EnhancedIOTARiskModel, assess_risk_sync

class IOTARiskAssessmentTest(unittest.TestCase):
    """Test cases for the IOTA Risk Assessment system."""
    
    @classmethod
    def setUpClass(cls):
        """Set up the test by initializing the model once."""
        cls.model = EnhancedIOTARiskModel()
        
        # Generate test user data
        cls.test_user = {
            "address": "0x0000000000000000000000000000000000000000",
            "has_iota_address": True,
            "iota_address": "smr1qpj8775lmqcudesrld45ntzm27umfn3xh46cmw0kr9ruqavrjcn3tmxx5mu",
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
    
    def test_real_iota_connection(self):
        """Test that the model connects to the real IOTA network."""
        self.assertIsNotNone(self.model.iota_connection)
        self.assertEqual(
            self.model.iota_connection.config.get("network"),
            "mainnet",
            "Not connected to IOTA mainnet"
        )
    
    def test_basic_risk_assessment(self):
        """Test the basic risk assessment functionality."""
        # Assess risk for the test user
        result = self.model.assess_risk(self.test_user)
        
        # Verify the structure of the result
        self.assertIn("riskScore", result)
        self.assertIn("riskClass", result)
        self.assertIn("confidenceScore", result)
        self.assertIn("recommendations", result)
        self.assertIn("riskFactors", result)
        
        # Verify the risk score is within expected range
        self.assertGreaterEqual(result["riskScore"], 0)
        self.assertLessEqual(result["riskScore"], 100)
        
        # Verify confidence score
        self.assertGreaterEqual(result["confidenceScore"], 0)
        self.assertLessEqual(result["confidenceScore"], 1)
        
        # Verify recommendations
        self.assertIsInstance(result["recommendations"], list)
        
        # Verify risk factors
        self.assertIsInstance(result["riskFactors"], list)
    
    def test_feature_extraction(self):
        """Test IOTA feature extraction functionality."""
        features = self.model.extract_iota_features(self.test_user)
        
        # Verify features exist
        self.assertIn("transaction_count", features)
        self.assertIn("message_count", features)
        self.assertIn("balance", features)
        self.assertIn("activity_regularity", features)
        self.assertIn("cross_layer_transfers", features)
        
        # Verify feature values are normalized (0-1)
        for feature, value in features.items():
            self.assertGreaterEqual(value, 0, f"Feature {feature} should be >= 0")
            self.assertLessEqual(value, 1, f"Feature {feature} should be <= 1")
    
    def test_varying_risk_profiles(self):
        """Test that different user profiles get different risk scores."""
        # Create users with different risk profiles
        high_risk_user = dict(self.test_user)
        high_risk_user.update({
            "iota_transaction_count": 2,
            "cross_layer_transfers": 0,
            "identity_verification_level": "none",
            "identity_verified": False,
            "current_borrows": 150.0,
            "current_collaterals": 160.0,  # Low collateral ratio
            "repayment_ratio": 0.6,
            "previous_loans_count": 5
        })
        
        low_risk_user = dict(self.test_user)
        low_risk_user.update({
            "iota_transaction_count": 30,
            "cross_layer_transfers": 10,
            "identity_verification_level": "full",
            "identity_verified": True,
            "current_borrows": 50.0,
            "current_collaterals": 250.0,  # High collateral ratio
            "repayment_ratio": 0.98,
            "previous_loans_count": 8
        })
        
        # Assess risk for both users
        high_risk_result = self.model.assess_risk(high_risk_user)
        low_risk_result = self.model.assess_risk(low_risk_user)
        
        # Verify high risk user has higher risk score
        self.assertGreater(
            high_risk_result["riskScore"],
            low_risk_result["riskScore"],
            "High risk user should have higher risk score than low risk user"
        )
        
        print(f"High risk score: {high_risk_result['riskScore']}")
        print(f"Low risk score: {low_risk_result['riskScore']}")
    
    @unittest.skip("Temporarily skipped until model training is implemented")
    def test_model_training(self):
        """Test model training functionality."""
        # Generate synthetic training data
        from data_processing.synthetic_data_generator import generate_synthetic_data
        
        # Create a small dataset for quick testing
        data = generate_synthetic_data(n_samples=100)
        
        # Train the model
        training_metrics = self.model.train_model(data)
        
        # Verify training metrics
        self.assertIn("gradient_boosting", training_metrics)
        self.assertIn("ensemble", training_metrics)
        self.assertIn("reinforcement_learning", training_metrics)

def main():
    unittest.main()

if __name__ == "__main__":
    main()
