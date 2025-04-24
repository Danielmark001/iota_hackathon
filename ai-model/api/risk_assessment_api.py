"""
Risk Assessment API

This module implements a Flask API for the risk assessment model,
allowing integration with the IntelliLend platform.
"""

import os
import logging
import json
import asyncio
import pickle
from typing import Dict, Any, Optional, List
import traceback

import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf

# Import local modules
import sys
sys.path.append('..')
from data_processing.blockchain_data_fetcher import BlockchainDataFetcher
from feature_engineering.feature_processor import FeatureProcessor
from models.risk_assessment_model import RiskAssessmentModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Load configuration
try:
    with open("../config/api_config.json", "r") as f:
        config = json.load(f)
    logger.info("Loaded API configuration")
except FileNotFoundError:
    logger.warning("API configuration file not found. Using default configuration.")
    config = {
        "model_dir": "../models",
        "model_version": "latest",  # "latest" or specific version
        "model_type": "ensemble",
        "evm_rpc_url": "https://evm-test.iota.org:443",
        "iota_node_url": "https://chrysalis-nodes.iota.org:443",
        "lending_pool_address": "0x0000000000000000000000000000000000000000",
        "chain_id": 1,
        "threshold": 0.5,
        "risk_classes": [
            {"min": 0, "max": 20, "label": "Very Low Risk"},
            {"min": 20, "max": 40, "label": "Low Risk"},
            {"min": 40, "max": 60, "label": "Medium Risk"},
            {"min": 60, "max": 80, "label": "High Risk"},
            {"min": 80, "max": 100, "label": "Very High Risk"}
        ],
        "port": 5000,
        "debug": False
    }

# Get model directory and version
model_dir = config.get("model_dir", "../models")
model_version = config.get("model_version", "latest")
model_type = config.get("model_type", "ensemble")

# If model_version is "latest", find the latest version
if model_version == "latest":
    versions = [
        d for d in os.listdir(model_dir)
        if os.path.isdir(os.path.join(model_dir, d))
    ]
    if versions:
        versions.sort(reverse=True)
        model_version = versions[0]
        logger.info(f"Using latest model version: {model_version}")
    else:
        logger.warning("No model versions found. Model will not be loaded.")
        model_version = None

# Initialize model and preprocessor
model = None
preprocessor = None
data_fetcher = None

def initialize_system():
    """Initialize model, preprocessor, and data fetcher"""
    global model, preprocessor, data_fetcher
    
    try:
        # Initialize data fetcher
        data_fetcher = BlockchainDataFetcher(
            evm_rpc_url=config.get("evm_rpc_url"),
            iota_node_url=config.get("iota_node_url"),
            lending_pool_address=config.get("lending_pool_address"),
            chain_id=config.get("chain_id")
        )
        logger.info("Initialized BlockchainDataFetcher")
        
        # Initialize feature processor
        preprocessor = FeatureProcessor(
            model_dir=model_dir
        )
        
        # Load preprocessor
        try:
            preprocessor.load_preprocessor()
            logger.info("Loaded feature preprocessor")
        except Exception as e:
            logger.warning(f"Could not load preprocessor: {e}")
        
        # Initialize risk model
        if model_version is not None:
            model = RiskAssessmentModel(
                model_type=model_type,
                model_dir=model_dir,
                model_version=model_version
            )
            
            # Load model
            try:
                model_path = os.path.join(
                    model_dir,
                    model_version,
                    f"{model_type}_model.pkl"
                )
                model.load_model(file_path=model_path)
                logger.info(f"Loaded model from {model_path}")
            except Exception as e:
                logger.warning(f"Could not load model: {e}")
        
        return True
    except Exception as e:
        logger.error(f"Error initializing system: {e}")
        traceback.print_exc()
        return False

# Initialize system on startup
if initialize_system():
    logger.info("System initialized successfully")
else:
    logger.error("System initialization failed")

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    status = {
        "status": "healthy",
        "model_loaded": model is not None,
        "preprocessor_loaded": preprocessor is not None,
        "data_fetcher_loaded": data_fetcher is not None,
        "model_version": model_version,
        "model_type": model_type
    }
    return jsonify(status)

@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict risk score for a user
    
    Request body:
    {
        "address": "0x...",
        "features": {
            "feature1": value1,
            "feature2": value2,
            ...
        }
    }
    
    Returns:
    {
        "address": "0x...",
        "risk_score": 42.5,
        "risk_class": "Medium Risk",
        "risk_factors": [
            {
                "factor": "repayment_history",
                "score": 85,
                "impact": "positive"
            },
            ...
        ],
        "recommendations": [
            {
                "action": "Increase collateral",
                "impact": "high"
            },
            ...
        ]
    }
    """
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Get user address
        address = data.get("address")
        if not address:
            return jsonify({"error": "User address not provided"}), 400
        
        # Get features from request
        features = data.get("features", {})
        
        # Check if model and preprocessor are loaded
        if model is None or preprocessor is None:
            return jsonify({
                "error": "Model or preprocessor not loaded",
                "details": "System initialization failed"
            }), 500
        
        # If features are provided, use them directly
        if features:
            logger.info(f"Using provided features for address {address}")
            features_df = pd.DataFrame([features])
        else:
            # Fetch features from blockchain
            logger.info(f"Fetching blockchain data for address {address}")
            
            # Run feature extraction asynchronously
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                feature_vector = loop.run_until_complete(
                    data_fetcher.fetch_user_feature_vector(address)
                )
                features_df = pd.DataFrame([feature_vector])
                logger.info(f"Fetched features for address {address}")
            finally:
                loop.close()
        
        # Preprocess features
        try:
            processed_features = preprocessor.transform(features_df)
            logger.info("Preprocessed features")
        except Exception as e:
            logger.error(f"Error preprocessing features: {e}")
            traceback.print_exc()
            
            # Fallback to using raw features
            processed_features = features_df
            logger.warning("Using raw features without preprocessing")
        
        # Predict risk score
        risk_score = float(model.predict_risk_score(processed_features)[0])
        logger.info(f"Predicted risk score: {risk_score:.2f}")
        
        # Determine risk class
        risk_class = "Unknown"
        for risk_range in config.get("risk_classes", []):
            if risk_range["min"] <= risk_score < risk_range["max"]:
                risk_class = risk_range["label"]
                break
        
        # Generate risk factors (simplified)
        risk_factors = []
        
        # If model has feature importances, use them
        if hasattr(model.model, 'feature_importances_'):
            # Get feature names
            feature_names = processed_features.columns
            
            # Get feature importances
            feature_importances = model.model.feature_importances_
            
            # Get top features
            top_indices = np.argsort(feature_importances)[-5:]
            for idx in top_indices:
                if idx < len(feature_names):
                    feature_name = feature_names[idx]
                    feature_value = float(processed_features.iloc[0, idx])
                    feature_importance = float(feature_importances[idx])
                    
                    # Determine impact
                    impact = "neutral"
                    if feature_importance > 0.1:
                        if feature_value > 0:
                            impact = "positive" if risk_score < 50 else "negative"
                        else:
                            impact = "negative" if risk_score < 50 else "positive"
                    
                    risk_factors.append({
                        "factor": feature_name,
                        "score": int(min(100, max(0, abs(feature_value * 100)))),
                        "importance": feature_importance,
                        "impact": impact
                    })
        
        # Generate recommendations (simplified)
        recommendations = []
        
        if risk_score > 80:
            recommendations.append({
                "action": "Increase collateral significantly",
                "impact": "high"
            })
            recommendations.append({
                "action": "Improve repayment history",
                "impact": "high"
            })
        elif risk_score > 60:
            recommendations.append({
                "action": "Increase collateral",
                "impact": "medium"
            })
            recommendations.append({
                "action": "Make regular repayments",
                "impact": "medium"
            })
        elif risk_score > 40:
            recommendations.append({
                "action": "Maintain current collateral levels",
                "impact": "low"
            })
            recommendations.append({
                "action": "Continue consistent repayment behavior",
                "impact": "medium"
            })
        else:
            recommendations.append({
                "action": "Eligible for lower interest rates",
                "impact": "positive"
            })
            recommendations.append({
                "action": "Consider increasing borrowing limit",
                "impact": "positive"
            })
        
        # Prepare response
        response = {
            "address": address,
            "risk_score": round(risk_score, 2),
            "risk_class": risk_class,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "model_version": model_version,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error predicting risk score: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Error predicting risk score",
            "details": str(e)
        }), 500

@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    """
    Predict risk scores for multiple users
    
    Request body:
    {
        "addresses": ["0x...", "0x...", ...],
        "features": [
            {
                "address": "0x...",
                "feature1": value1,
                "feature2": value2,
                ...
            },
            ...
        ]
    }
    
    Returns:
    {
        "predictions": [
            {
                "address": "0x...",
                "risk_score": 42.5,
                "risk_class": "Medium Risk"
            },
            ...
        ]
    }
    """
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Get user addresses
        addresses = data.get("addresses", [])
        if not addresses:
            return jsonify({"error": "No addresses provided"}), 400
        
        # Get features from request
        features_list = data.get("features", [])
        
        # Check if model and preprocessor are loaded
        if model is None or preprocessor is None:
            return jsonify({
                "error": "Model or preprocessor not loaded",
                "details": "System initialization failed"
            }), 500
        
        # Prepare predictions list
        predictions = []
        
        # Process each address
        for address in addresses:
            # Find features for this address
            address_features = None
            for features in features_list:
                if features.get("address") == address:
                    address_features = features.copy()
                    address_features.pop("address", None)
                    break
            
            if address_features:
                # Use provided features
                features_df = pd.DataFrame([address_features])
            else:
                # Skip if no features provided
                logger.warning(f"No features provided for address {address}")
                predictions.append({
                    "address": address,
                    "risk_score": None,
                    "risk_class": "Unknown",
                    "error": "No features provided"
                })
                continue
            
            # Preprocess features
            try:
                processed_features = preprocessor.transform(features_df)
            except Exception as e:
                logger.error(f"Error preprocessing features for {address}: {e}")
                
                # Fallback to using raw features
                processed_features = features_df
            
            # Predict risk score
            risk_score = float(model.predict_risk_score(processed_features)[0])
            
            # Determine risk class
            risk_class = "Unknown"
            for risk_range in config.get("risk_classes", []):
                if risk_range["min"] <= risk_score < risk_range["max"]:
                    risk_class = risk_range["label"]
                    break
            
            # Add to predictions
            predictions.append({
                "address": address,
                "risk_score": round(risk_score, 2),
                "risk_class": risk_class
            })
        
        # Prepare response
        response = {
            "predictions": predictions,
            "model_version": model_version,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error batch predicting risk scores: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Error batch predicting risk scores",
            "details": str(e)
        }), 500

@app.route("/analyze", methods=["POST"])
def analyze_user():
    """
    Analyze a user's on-chain activity and risk profile
    
    Request body:
    {
        "address": "0x..."
    }
    
    Returns:
    {
        "address": "0x...",
        "wallet_analysis": {...},
        "lending_activity": {...},
        "risk_profile": {...}
    }
    """
    try:
        # Get request data
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Get user address
        address = data.get("address")
        if not address:
            return jsonify({"error": "User address not provided"}), 400
        
        # Check if data fetcher is loaded
        if data_fetcher is None:
            return jsonify({
                "error": "Data fetcher not loaded",
                "details": "System initialization failed"
            }), 500
        
        # Run analysis asynchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Wallet analysis
            wallet_analysis_task = asyncio.ensure_future(
                data_fetcher.fetch_wallet_analysis(address)
            )
            
            # Transaction history
            tx_history_task = asyncio.ensure_future(
                data_fetcher.fetch_user_transaction_history(
                    address, days_back=30
                )
            )
            
            # Lending activities
            lending_activities_task = asyncio.ensure_future(
                data_fetcher.fetch_lending_activities(address)
            )
            
            # Cross-chain activity
            cross_chain_task = asyncio.ensure_future(
                data_fetcher.fetch_cross_chain_activity(address)
            )
            
            # Wait for all tasks to complete
            wallet_analysis = loop.run_until_complete(wallet_analysis_task)
            tx_history = loop.run_until_complete(tx_history_task)
            lending_activities = loop.run_until_complete(lending_activities_task)
            cross_chain_activity = loop.run_until_complete(cross_chain_task)
        finally:
            loop.close()
        
        # Convert DataFrame to dict for JSON serialization
        tx_history_dict = tx_history.to_dict(orient="records") if not tx_history.empty else []
        
        lending_activities_dict = {}
        for key, df in lending_activities.items():
            lending_activities_dict[key] = df.to_dict(orient="records") if not df.empty else []
        
        # Prepare risk profile
        if model is not None and preprocessor is not None:
            # Fetch feature vector
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                feature_vector = loop.run_until_complete(
                    data_fetcher.fetch_user_feature_vector(address)
                )
                features_df = pd.DataFrame([feature_vector])
            finally:
                loop.close()
            
            # Preprocess features
            try:
                processed_features = preprocessor.transform(features_df)
            except Exception as e:
                logger.error(f"Error preprocessing features: {e}")
                processed_features = features_df
            
            # Predict risk score
            risk_score = float(model.predict_risk_score(processed_features)[0])
            
            # Determine risk class
            risk_class = "Unknown"
            for risk_range in config.get("risk_classes", []):
                if risk_range["min"] <= risk_score < risk_range["max"]:
                    risk_class = risk_range["label"]
                    break
            
            risk_profile = {
                "risk_score": round(risk_score, 2),
                "risk_class": risk_class,
                "model_version": model_version
            }
        else:
            risk_profile = {
                "risk_score": None,
                "risk_class": "Unknown",
                "error": "Model not loaded"
            }
        
        # Prepare response
        response = {
            "address": address,
            "wallet_analysis": wallet_analysis,
            "transaction_history": {
                "summary": {
                    "count": len(tx_history_dict),
                    "earliest": min(tx_history["timestamp"]).isoformat() if not tx_history.empty else None,
                    "latest": max(tx_history["timestamp"]).isoformat() if not tx_history.empty else None
                },
                "transactions": tx_history_dict[:10]  # Limit to 10 transactions
            },
            "lending_activity": {
                "summary": {
                    "deposits": len(lending_activities_dict.get("deposits", [])),
                    "borrows": len(lending_activities_dict.get("borrows", [])),
                    "repays": len(lending_activities_dict.get("repays", [])),
                    "withdraws": len(lending_activities_dict.get("withdraws", []))
                },
                "details": lending_activities_dict
            },
            "cross_chain_activity": cross_chain_activity,
            "risk_profile": risk_profile
        }
        
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error analyzing user: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Error analyzing user",
            "details": str(e)
        }), 500

@app.route("/reload", methods=["POST"])
def reload_model():
    """Reload the model and preprocessor"""
    try:
        success = initialize_system()
        
        if success:
            return jsonify({
                "status": "success",
                "message": "Model and preprocessor reloaded successfully",
                "model_version": model_version
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Error reloading model and preprocessor"
            }), 500
    
    except Exception as e:
        logger.error(f"Error reloading model: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Error reloading model",
            "details": str(e)
        }), 500

# Main entry point
if __name__ == "__main__":
    # Start Flask app
    port = config.get("port", 5000)
    debug = config.get("debug", False)
    
    logger.info(f"Starting API server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
