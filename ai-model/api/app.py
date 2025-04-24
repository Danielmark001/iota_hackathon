"""
IntelliLend Risk Assessment API

This module provides a Flask API to expose the risk assessment model.
"""

from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import os
import sys
import joblib
import logging
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from risk_model import RiskAssessmentModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Global model instance
model = None

def load_model():
    """Load the trained risk assessment model."""
    global model
    model = RiskAssessmentModel()
    
    model_path = os.environ.get('MODEL_PATH', '../models/risk_model.joblib')
    try:
        logger.info(f"Loading model from {model_path}")
        model.load_model(model_path)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        # If no pre-trained model, train on simulated data for demo
        logger.info("Training model on simulated data")
        from risk_model import simulate_training_data
        X, y = simulate_training_data(1000)
        model.train(X, y)
        logger.info("Model trained successfully")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict risk score for a user based on on-chain data.
    
    Expected JSON payload:
    {
        "address": "0x...",
        "features": {
            "transaction_count": 10,
            "avg_transaction_value": 100,
            "wallet_age_days": 365,
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'features' not in data or 'address' not in data:
            return jsonify({
                'error': 'Invalid request. Expected address and features.'
            }), 400
        
        # Extract features and create DataFrame
        features = data['features']
        user_df = pd.DataFrame([features])
        
        # Ensure required features are present
        required_features = [
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
        
        for feature in required_features:
            if feature not in user_df.columns:
                user_df[feature] = 0
        
        # Make prediction
        logger.info(f"Making prediction for address {data['address']}")
        risk_score = float(model.predict_risk_score(user_df)[0])
        
        # Get feature importance for explanation
        importance = model.get_feature_importance()
        top_features = importance.head(3).to_dict('records')
        
        # Generate recommendations based on risk score and features
        recommendations = generate_recommendations(risk_score, features)
        
        return jsonify({
            'address': data['address'],
            'risk_score': risk_score,
            'risk_category': get_risk_category(risk_score),
            'explanation': {
                'top_factors': top_features,
                'recommendations': recommendations
            },
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error making prediction: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """
    Batch predict risk scores for multiple users.
    
    Expected JSON payload:
    {
        "users": [
            {
                "address": "0x...",
                "features": {...}
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'users' not in data:
            return jsonify({
                'error': 'Invalid request. Expected users array.'
            }), 400
        
        results = []
        for user in data['users']:
            # Create DataFrame for each user
            features = user['features']
            user_df = pd.DataFrame([features])
            
            # Ensure required features
            required_features = model.features
            for feature in required_features:
                if feature not in user_df.columns:
                    user_df[feature] = 0
            
            # Predict
            risk_score = float(model.predict_risk_score(user_df)[0])
            results.append({
                'address': user['address'],
                'risk_score': risk_score,
                'risk_category': get_risk_category(risk_score)
            })
        
        return jsonify({
            'results': results,
            'count': len(results),
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error in batch prediction: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/importance', methods=['GET'])
def feature_importance():
    """Get feature importance from the model."""
    try:
        importance = model.get_feature_importance()
        return jsonify({
            'importance': importance.to_dict('records'),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting feature importance: {e}")
        return jsonify({
            'error': str(e)
        }), 500

def get_risk_category(score):
    """Map numerical risk score to a category."""
    if score < 30:
        return "Low Risk"
    elif score < 60:
        return "Medium Risk"
    else:
        return "High Risk"

def generate_recommendations(risk_score, features):
    """Generate personalized recommendations based on risk score and features."""
    recommendations = []
    
    # Basic recommendations based on risk factors
    if risk_score > 70:
        recommendations.append({
            "title": "Increase Collateral",
            "description": "Your risk score is high. Adding more collateral can significantly reduce your risk and lower your interest rate.",
            "impact": "high"
        })
        
    if features.get('collateral_diversity', 0) < 2:
        recommendations.append({
            "title": "Diversify Your Collateral",
            "description": "Using different asset types as collateral can reduce your risk score.",
            "impact": "medium"
        })
    
    if features.get('previous_loans_count', 0) > 0 and features.get('repayment_ratio', 0) < 0.8:
        recommendations.append({
            "title": "Improve Repayment History",
            "description": "Your past repayment performance affects your risk score. Consider setting up automatic repayments.",
            "impact": "high"
        })
    
    if features.get('wallet_balance_volatility', 0) > 5:
        recommendations.append({
            "title": "Stabilize Your Wallet Activity",
            "description": "High volatility in your wallet balance is increasing your risk score.",
            "impact": "medium"
        })
    
    # Ensure we always have at least one recommendation
    if not recommendations:
        recommendations.append({
            "title": "Maintain Current Status",
            "description": "Your risk profile is good. Continue maintaining your current behavior.",
            "impact": "low"
        })
    
    return recommendations

if __name__ == '__main__':
    # Load model on startup
    load_model()
    
    # Start server
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
