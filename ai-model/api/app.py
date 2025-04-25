"""
Simple Flask API for risk assessment demo.
"""

from flask import Flask, request, jsonify
import os
import sys
import logging
import random
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Set default port
port = int(os.environ.get('AI_MODEL_PORT', 5000))

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
    """
    try:
        data = request.get_json()
        
        if not data or 'address' not in data:
            return jsonify({
                'error': 'Invalid request. Expected address.'
            }), 400
        
        # For demo purposes, generate a random risk score
        risk_score = random.randint(20, 80)
        
        # Get risk category
        risk_category = get_risk_category(risk_score)
        
        # Generate mock recommendations
        recommendations = generate_recommendations(risk_score)
        
        # Generate mock top factors
        top_factors = [
            {"feature": "collateral_ratio", "importance": 0.35},
            {"feature": "wallet_activity", "importance": 0.25},
            {"feature": "repayment_history", "importance": 0.2}
        ]
        
        return jsonify({
            'address': data['address'],
            'risk_score': risk_score,
            'risk_category': risk_category,
            'explanation': {
                'top_factors': top_factors,
                'recommendations': recommendations
            },
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error making prediction: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/importance', methods=['GET'])
def feature_importance():
    """Get feature importance from the model."""
    try:
        # Mock feature importance data
        importance = [
            {"feature": "collateral_ratio", "importance": 0.35},
            {"feature": "wallet_activity", "importance": 0.25},
            {"feature": "repayment_history", "importance": 0.2},
            {"feature": "transaction_volume", "importance": 0.1},
            {"feature": "account_age", "importance": 0.05},
            {"feature": "market_correlation", "importance": 0.05}
        ]
        
        return jsonify({
            'importance': importance,
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

def generate_recommendations(risk_score):
    """Generate personalized recommendations based on risk score."""
    recommendations = []
    
    if risk_score > 70:
        recommendations.append({
            "title": "Increase Collateral",
            "description": "Your risk score is high. Adding more collateral can significantly reduce your risk and lower your interest rate.",
            "impact": "high"
        })
        
    if risk_score > 50:
        recommendations.append({
            "title": "Diversify Your Collateral",
            "description": "Using different asset types as collateral can reduce your risk score.",
            "impact": "medium"
        })
    
    if risk_score > 40:
        recommendations.append({
            "title": "Improve Repayment History",
            "description": "Your past repayment performance affects your risk score. Consider setting up automatic repayments.",
            "impact": "high"
        })
    
    if risk_score > 30:
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
    logger.info(f"Starting AI model API server on port {port}")
    app.run(host='0.0.0.0', port=port)
