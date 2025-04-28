"""
IntelliLend AI Risk Assessment API

This Flask application exposes the ML risk assessment models through a RESTful API,
allowing seamless integration between the Node.js backend and Python ML models.
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import numpy as np
import time
import traceback

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import risk model
from enhanced_iota_risk_model import EnhancedIOTARiskModel, assess_risk_sync
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ai_api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize risk model
risk_model = None

def initialize_model():
    """Initialize the risk assessment model"""
    global risk_model
    try:
        logger.info("Initializing Enhanced IOTA Risk Model...")
        risk_model = EnhancedIOTARiskModel()
        logger.info("Risk model initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Error initializing risk model: {e}")
        logger.error(traceback.format_exc())
        return False

# Initialize IOTA connection
def initialize_iota_connection():
    """Initialize IOTA network connection"""
    try:
        logger.info("Initializing IOTA connection...")
        iota_connection = get_iota_connection()
        if iota_connection and iota_connection.is_connected:
            logger.info("Successfully connected to IOTA network")
            return iota_connection
        else:
            logger.warning("Failed to connect to IOTA network")
            return None
    except Exception as e:
        logger.error(f"Error initializing IOTA connection: {e}")
        logger.error(traceback.format_exc())
        return None

# Routes
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    global risk_model
    
    # Check if risk model is initialized
    model_status = "initialized" if risk_model is not None else "not initialized"
    
    # Check IOTA connection
    iota_connection = None
    iota_status = "disconnected"
    try:
        iota_connection = get_iota_connection()
        if iota_connection and iota_connection.is_connected:
            iota_status = "connected"
            
            # Get network information
            network_info = iota_connection.get_network_info()
            network_name = network_info.get("network", "unknown")
        else:
            network_name = "unknown"
    except Exception as e:
        logger.error(f"Error checking IOTA connection: {e}")
        network_name = "error"
    
    return jsonify({
        "status": "ok",
        "riskModel": model_status,
        "iota": {
            "status": iota_status,
            "network": network_name
        },
        "timestamp": int(time.time())
    })

@app.route('/api/risk-assessment', methods=['POST'])
def assess_risk():
    """
    Risk assessment endpoint
    
    Expects JSON payload with user data including:
    - address: Ethereum address
    - iota_address: IOTA address (optional)
    - various on-chain and off-chain metrics
    
    Returns risk assessment results
    """
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        if "address" not in data:
            return jsonify({"error": "No address provided"}), 400
        
        logger.info(f"Assessing risk for address: {data['address']}")
        
        # Add IOTA address if provided
        iota_address = data.get("iota_address")
        if iota_address:
            logger.info(f"Using IOTA address: {iota_address}")
        
        # Process assessment using synchronous wrapper
        assessment = assess_risk_sync(data)
        
        logger.info(f"Risk assessment completed for {data['address']}: Score = {assessment['riskScore']}")
        
        return jsonify(assessment)
    
    except Exception as e:
        logger.error(f"Error processing risk assessment: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error processing risk assessment",
            "message": str(e),
            "address": data.get("address", "unknown"),
            "riskScore": 50,  # Default medium risk
            "riskClass": "Medium Risk",
            "timestamp": int(time.time())
        }), 500

@app.route('/api/model/performance', methods=['GET'])
def model_performance():
    """Get model performance metrics"""
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        # Get performance metrics
        # In a real implementation, these would be calculated from historical data
        # For now, we'll return simulated metrics
        
        performance = {
            "accuracy": 0.87,
            "precision": 0.85,
            "recall": 0.90,
            "f1Score": 0.87,
            "totalSamples": 1000,
            "correctPredictions": 870,
            "truePositives": 450,
            "falsePositives": 80,
            "trueNegatives": 420,
            "falseNegatives": 50,
            "confusionMatrix": [
                [450, 80],  # [TP, FP]
                [50, 420]   # [FN, TN]
            ],
            "riskBucketAccuracy": {
                "veryLow": 0.95,
                "low": 0.90,
                "medium": 0.85,
                "high": 0.80,
                "veryHigh": 0.75
            },
            "defaultRate": 0.05,
            "riskBins": [
                {"score": "0-20", "count": 150, "defaultRate": 0.01},
                {"score": "21-40", "count": 250, "defaultRate": 0.02},
                {"score": "41-60", "count": 300, "defaultRate": 0.05},
                {"score": "61-80", "count": 200, "defaultRate": 0.08},
                {"score": "81-100", "count": 100, "defaultRate": 0.15}
            ],
            "lastUpdate": int(time.time())
        }
        
        return jsonify(performance)
    
    except Exception as e:
        logger.error(f"Error getting model performance: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error getting model performance",
            "message": str(e)
        }), 500

@app.route('/api/feature-importance', methods=['GET'])
def feature_importance():
    """Get feature importance for the risk model"""
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        # Get feature importance
        # In a real implementation, these would be calculated from the model
        # For now, we'll return simulated feature importance
        
        features = [
            {"feature": "transaction_count", "importance": 0.15, "description": "Number of transactions"},
            {"feature": "balance", "importance": 0.12, "description": "Account balance"},
            {"feature": "activity_regularity", "importance": 0.11, "description": "Regularity of user activity"},
            {"feature": "cross_layer_transfers", "importance": 0.10, "description": "Cross-layer transaction activity"},
            {"feature": "identity_verification", "importance": 0.09, "description": "Identity verification status"},
            {"feature": "wallet_balance", "importance": 0.08, "description": "Wallet balance"},
            {"feature": "collateral_ratio", "importance": 0.07, "description": "Ratio of collateral to borrows"},
            {"feature": "native_tokens_count", "importance": 0.06, "description": "Number of different tokens held"},
            {"feature": "first_activity_days", "importance": 0.05, "description": "Days since first activity"},
            {"feature": "message_count", "importance": 0.04, "description": "Number of messages sent"}
        ]
        
        return jsonify({
            "features": features,
            "modelVersion": "v2.0",
            "lastUpdate": int(time.time())
        })
    
    except Exception as e:
        logger.error(f"Error getting feature importance: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error getting feature importance",
            "message": str(e)
        }), 500

@app.route('/api/recommendations/<address>', methods=['GET'])
def get_recommendations(address):
    """Get personalized recommendations for a user"""
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        if not address:
            return jsonify({"error": "No address provided"}), 400
        
        logger.info(f"Getting recommendations for address: {address}")
        
        # For now, we'll return simulated recommendations
        # In a real implementation, these would be derived from the model
        
        recommendations = [
            {
                "title": "Increase Collateral Ratio",
                "description": "Adding more collateral will reduce your risk score and improve borrowing terms.",
                "impact": "high",
                "actionType": "depositCollateral"
            },
            {
                "title": "Complete Identity Verification",
                "description": "Verify your identity using IOTA Identity to get better borrowing rates.",
                "impact": "high",
                "actionType": "verifyIdentity"
            },
            {
                "title": "Increase IOTA Network Activity",
                "description": "More transactions on the IOTA network will improve your on-chain reputation.",
                "impact": "medium",
                "actionType": "increaseActivity"
            },
            {
                "title": "Try Cross-Layer Transfers",
                "description": "Demonstrate blockchain expertise by using both L1 and L2 layers.",
                "impact": "medium",
                "actionType": "crossLayerTransfer"
            },
            {
                "title": "Balance Asset Distribution",
                "description": "Diversify your assets across multiple token types for better risk profile.",
                "impact": "low",
                "actionType": "diversifyAssets"
            }
        ]
        
        return jsonify({
            "address": address,
            "recommendations": recommendations,
            "timestamp": int(time.time())
        })
    
    except Exception as e:
        logger.error(f"Error getting recommendations for {address}: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error getting recommendations",
            "message": str(e),
            "address": address
        }), 500

@app.route('/api/ai/simulate-risk', methods=['POST'])
def simulate_risk():
    """
    Simulate risk score based on different parameters
    
    Expects JSON payload with simulation parameters:
    - collateralAmount: Amount of collateral
    - borrowAmount: Amount borrowed
    - asset: Asset type (e.g., 'smr', 'iota', 'eth')
    - useIOTA: Whether IOTA is being used
    - crossChainActivity: Whether cross-chain activity exists
    - identityVerified: Whether identity is verified
    
    Returns simulated risk assessment
    """
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        logger.info(f"Simulating risk with parameters: {data}")
        
        # Required fields
        collateral_amount = data.get('collateralAmount', 1000)
        borrow_amount = data.get('borrowAmount', 500)
        asset = data.get('asset', 'smr')
        use_iota = data.get('useIOTA', False)
        cross_chain_activity = data.get('crossChainActivity', False)
        identity_verified = data.get('identityVerified', False)
        
        # Calculate collateral ratio
        collateral_ratio = collateral_amount / borrow_amount if borrow_amount > 0 else float('inf')
        
        # Use risk model to simulate risk
        if risk_model:
            # Prepare simulation data
            simulation_data = {
                "collateralAmount": collateral_amount,
                "borrowAmount": borrow_amount,
                "asset": asset,
                "useIOTA": use_iota,
                "crossChainActivity": cross_chain_activity,
                "identityVerified": identity_verified,
                "collateralRatio": collateral_ratio
            }
            
            # Call model for simulation
            result = risk_model.simulate_risk(simulation_data)
        else:
            # Fallback simulation logic (similar to frontend implementation)
            # Base risk factors
            base_risk = 50  # Start at medium risk
            
            # Collateral ratio factor (-20 to +30 points)
            collateral_ratio_impact = 0
            if collateral_ratio >= 2.0:
                collateral_ratio_impact = -20  # Very good ratio
            elif collateral_ratio >= 1.5:
                collateral_ratio_impact = -10  # Good ratio
            elif collateral_ratio < 1.2:
                collateral_ratio_impact = 20  # Dangerous ratio
            elif collateral_ratio < 1.3:
                collateral_ratio_impact = 10  # Risky ratio
            
            # Asset factor (-10 to +10 points)
            asset_impact = 0
            if asset in ['usdt', 'dai']:
                asset_impact = -5  # Stablecoins are less risky
            elif asset in ['eth', 'btc']:
                asset_impact = 5  # Major cryptos have moderate risk
            elif asset == 'smr':
                asset_impact = -10  # IOTA's Shimmer has lower risk on this platform
            
            # IOTA usage factor (-15 to 0 points)
            iota_impact = -15 if use_iota else 0
            
            # Cross-chain activity (-10 to 0 points)
            cross_chain_impact = -10 if cross_chain_activity else 0
            
            # Identity verification (-15 to 0 points)
            identity_impact = -15 if identity_verified else 0
            
            # Calculate total risk score
            risk_score = base_risk + collateral_ratio_impact + asset_impact + iota_impact + cross_chain_impact + identity_impact
            
            # Ensure score is between 0 and 100
            risk_score = max(0, min(100, risk_score))
            
            # Liquidation risk
            liquidation_risk = max(0, min(100, 100 - (collateral_ratio * 50)))
            
            # Interest rate based on risk score
            interest_rate = 3 + (risk_score / 10)
            
            # Max borrowing power
            max_borrow_amount = collateral_amount * 0.8
            
            # Construct result
            result = {
                "riskScore": round(risk_score),
                "collateralRatio": collateral_ratio,
                "liquidationRisk": round(liquidation_risk),
                "interestRate": round(interest_rate * 100) / 100,
                "maxBorrowAmount": round(max_borrow_amount * 100) / 100,
                "factors": [
                    {
                        "name": "Collateral Ratio",
                        "impact": collateral_ratio_impact,
                        "description": f"{collateral_ratio:.2f}x ratio {'decreases' if collateral_ratio_impact <= 0 else 'increases'} risk"
                    },
                    {
                        "name": "Asset Selection",
                        "impact": asset_impact,
                        "description": f"{asset.upper()} {'decreases' if asset_impact <= 0 else 'increases'} risk"
                    },
                    {
                        "name": "IOTA Integration",
                        "impact": iota_impact,
                        "description": "IOTA usage lowers risk" if use_iota else "No IOTA integration"
                    },
                    {
                        "name": "Cross-Chain Activity",
                        "impact": cross_chain_impact,
                        "description": "Cross-chain activity lowers risk" if cross_chain_activity else "No cross-chain activity"
                    },
                    {
                        "name": "Identity Verification",
                        "impact": identity_impact,
                        "description": "Verified identity lowers risk" if identity_verified else "No identity verification"
                    }
                ]
            }
        
        logger.info(f"Risk simulation completed: Score = {result['riskScore']}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error simulating risk: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error simulating risk",
            "message": str(e)
        }), 500

@app.route('/api/ai/scenario-analysis', methods=['POST'])
def scenario_analysis():
    """
    Analyze multiple scenarios for comparison
    
    Expects JSON payload with array of scenarios, each containing:
    - name: Scenario name
    - collateralAmount: Amount of collateral
    - borrowAmount: Amount borrowed
    - asset: Asset type
    - useIOTA: Whether IOTA is being used
    - crossChainActivity: Whether cross-chain activity exists
    - identityVerified: Whether identity is verified
    
    Returns analysis results for all scenarios
    """
    global risk_model
    
    # Initialize model if not already done
    if risk_model is None:
        initialize_model()
    
    try:
        # Get request data
        data = request.json
        
        if not data or 'scenarios' not in data:
            return jsonify({"error": "No scenarios provided"}), 400
        
        scenarios = data.get('scenarios', [])
        
        if not scenarios:
            return jsonify({"error": "Empty scenarios array"}), 400
        
        logger.info(f"Analyzing {len(scenarios)} scenarios")
        
        results = []
        
        # Process each scenario
        for scenario in scenarios:
            name = scenario.get('name', 'Unnamed Scenario')
            
            # Make a separate request to the simulate-risk endpoint for each scenario
            simulation_params = {
                "collateralAmount": scenario.get('collateralAmount', 1000),
                "borrowAmount": scenario.get('borrowAmount', 500),
                "asset": scenario.get('asset', 'smr'),
                "useIOTA": scenario.get('useIOTA', False),
                "crossChainActivity": scenario.get('crossChainActivity', False),
                "identityVerified": scenario.get('identityVerified', False)
            }
            
            # Simulate risk for this scenario
            simulation_result = simulate_risk_internal(simulation_params)
            
            # Add scenario name and original parameters
            result = {
                "scenarioName": name,
                "collateralAmount": simulation_params["collateralAmount"],
                "borrowAmount": simulation_params["borrowAmount"],
                "asset": simulation_params["asset"],
                "useIOTA": simulation_params["useIOTA"],
                "crossChainActivity": simulation_params["crossChainActivity"],
                "identityVerified": simulation_params["identityVerified"],
                **simulation_result
            }
            
            # Add radar chart factors
            result["factors"] = [
                {
                    "name": "Collateral Ratio",
                    "value": (100 - result["factors"][0]["impact"] * 2),
                    "impact": result["factors"][0]["impact"],
                    "fullMark": 100
                },
                {
                    "name": "Asset Selection",
                    "value": (100 - result["factors"][1]["impact"] * 2),
                    "impact": result["factors"][1]["impact"],
                    "fullMark": 100
                },
                {
                    "name": "IOTA Integration",
                    "value": 100 if simulation_params["useIOTA"] else 50,
                    "impact": result["factors"][2]["impact"],
                    "fullMark": 100
                },
                {
                    "name": "Cross-Chain Activity",
                    "value": 100 if simulation_params["crossChainActivity"] else 50,
                    "impact": result["factors"][3]["impact"],
                    "fullMark": 100
                },
                {
                    "name": "Identity Verification",
                    "value": 100 if simulation_params["identityVerified"] else 50,
                    "impact": result["factors"][4]["impact"],
                    "fullMark": 100
                }
            ]
            
            results.append(result)
        
        logger.info(f"Scenario analysis completed for {len(results)} scenarios")
        
        return jsonify(results)
    
    except Exception as e:
        logger.error(f"Error performing scenario analysis: {e}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Error performing scenario analysis",
            "message": str(e)
        }), 500

def simulate_risk_internal(params):
    """Internal function to simulate risk without HTTP request"""
    # Calculate collateral ratio
    collateral_amount = params.get('collateralAmount', 1000)
    borrow_amount = params.get('borrowAmount', 500)
    asset = params.get('asset', 'smr')
    use_iota = params.get('useIOTA', False)
    cross_chain_activity = params.get('crossChainActivity', False)
    identity_verified = params.get('identityVerified', False)
    
    collateral_ratio = collateral_amount / borrow_amount if borrow_amount > 0 else float('inf')
    
    # Use risk model to simulate risk
    if risk_model:
        # Call model for simulation
        return risk_model.simulate_risk(params)
    else:
        # Fallback simulation logic (similar to frontend implementation)
        # Base risk factors
        base_risk = 50  # Start at medium risk
        
        # Collateral ratio factor (-20 to +30 points)
        collateral_ratio_impact = 0
        if collateral_ratio >= 2.0:
            collateral_ratio_impact = -20  # Very good ratio
        elif collateral_ratio >= 1.5:
            collateral_ratio_impact = -10  # Good ratio
        elif collateral_ratio < 1.2:
            collateral_ratio_impact = 20  # Dangerous ratio
        elif collateral_ratio < 1.3:
            collateral_ratio_impact = 10  # Risky ratio
        
        # Asset factor (-10 to +10 points)
        asset_impact = 0
        if asset in ['usdt', 'dai']:
            asset_impact = -5  # Stablecoins are less risky
        elif asset in ['eth', 'btc']:
            asset_impact = 5  # Major cryptos have moderate risk
        elif asset == 'smr':
            asset_impact = -10  # IOTA's Shimmer has lower risk on this platform
        
        # IOTA usage factor (-15 to 0 points)
        iota_impact = -15 if use_iota else 0
        
        # Cross-chain activity (-10 to 0 points)
        cross_chain_impact = -10 if cross_chain_activity else 0
        
        # Identity verification (-15 to 0 points)
        identity_impact = -15 if identity_verified else 0
        
        # Calculate total risk score
        risk_score = base_risk + collateral_ratio_impact + asset_impact + iota_impact + cross_chain_impact + identity_impact
        
        # Ensure score is between 0 and 100
        risk_score = max(0, min(100, risk_score))
        
        # Liquidation risk
        liquidation_risk = max(0, min(100, 100 - (collateral_ratio * 50)))
        
        # Interest rate based on risk score
        interest_rate = 3 + (risk_score / 10)
        
        # Max borrowing power
        max_borrow_amount = collateral_amount * 0.8
        
        # Construct result
        return {
            "riskScore": round(risk_score),
            "collateralRatio": collateral_ratio,
            "liquidationRisk": round(liquidation_risk),
            "interestRate": round(interest_rate * 100) / 100,
            "maxBorrowAmount": round(max_borrow_amount * 100) / 100,
            "factors": [
                {
                    "name": "Collateral Ratio",
                    "impact": collateral_ratio_impact,
                    "description": f"{collateral_ratio:.2f}x ratio {'decreases' if collateral_ratio_impact <= 0 else 'increases'} risk"
                },
                {
                    "name": "Asset Selection",
                    "impact": asset_impact,
                    "description": f"{asset.upper()} {'decreases' if asset_impact <= 0 else 'increases'} risk"
                },
                {
                    "name": "IOTA Integration",
                    "impact": iota_impact,
                    "description": "IOTA usage lowers risk" if use_iota else "No IOTA integration"
                },
                {
                    "name": "Cross-Chain Activity",
                    "impact": cross_chain_impact,
                    "description": "Cross-chain activity lowers risk" if cross_chain_activity else "No cross-chain activity"
                },
                {
                    "name": "Identity Verification",
                    "impact": identity_impact,
                    "description": "Verified identity lowers risk" if identity_verified else "No identity verification"
                }
            ]
        }

if __name__ == '__main__':
    # Initialize model
    initialize_model()
    
    # Initialize IOTA connection
    initialize_iota_connection()
    
    # Run Flask app
    port = int(os.environ.get('AI_API_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
