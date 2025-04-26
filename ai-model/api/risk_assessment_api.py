"""
IOTA Risk Assessment API

This module provides a FastAPI interface to the Enhanced IOTA Risk Assessment Model,
allowing integration with other systems and web access to the risk assessment functionality.
"""

import os
import sys
import logging
import json
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

from fastapi import FastAPI, HTTPException, Body, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add parent directory to path to import the model
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from enhanced_iota_risk_model import EnhancedIOTARiskModel, assess_risk_sync

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="IOTA Risk Assessment API",
    description="Advanced risk assessment for DeFi on IOTA using machine learning",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model instance - will be lazy-loaded
model = None

def get_model():
    """Get or initialize the risk model."""
    global model
    if model is None:
        try:
            logger.info("Initializing IOTA Risk Assessment Model")
            model = EnhancedIOTARiskModel()
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize risk assessment model: {str(e)}"
            )
    return model

# Input and output models
class UserData(BaseModel):
    """Input user data for risk assessment."""
    address: str = Field(..., description="Ethereum address to assess")
    iota_address: Optional[str] = Field(None, description="IOTA address to include in assessment")
    transaction_count: Optional[int] = Field(None, description="Transaction count if available")
    message_count: Optional[int] = Field(None, description="IOTA message count if available")
    balance: Optional[float] = Field(None, description="Account balance if available")
    activity_regularity: Optional[float] = Field(None, description="Activity regularity score (0-1)")
    first_activity_days: Optional[int] = Field(None, description="Days since first activity")
    native_tokens_count: Optional[int] = Field(None, description="Number of native tokens held")
    cross_layer_transfers: Optional[int] = Field(None, description="Number of cross-layer transfers")
    identity_verification_level: Optional[str] = Field(None, description="Identity verification level")
    wallet_balance: Optional[float] = Field(None, description="Wallet balance if available")
    current_borrows: Optional[float] = Field(None, description="Current borrows if available")
    current_collaterals: Optional[float] = Field(None, description="Current collaterals if available")
    repayment_ratio: Optional[float] = Field(None, description="Repayment ratio if available")
    previous_loans_count: Optional[int] = Field(None, description="Previous loans count if available")

class Recommendation(BaseModel):
    """Recommendation object."""
    title: str
    description: str
    impact: str
    type: Optional[str] = None

class RiskFactor(BaseModel):
    """Risk factor object."""
    factor: str
    impact: str
    description: str
    value: Optional[Any] = None

class DataQuality(BaseModel):
    """Data quality information."""
    hasIotaAddress: bool
    iotaTransactionCount: int
    iotaDataQuality: str
    usedRealIotaData: bool
    dataCompleteness: float

class RiskAssessmentResponse(BaseModel):
    """Risk assessment response."""
    address: str
    riskScore: int
    riskClass: str
    confidenceScore: float
    componentScores: Dict[str, float]
    recommendations: List[Recommendation]
    riskFactors: List[RiskFactor]
    dataQuality: DataQuality
    timestamp: str

class TrainingMetrics(BaseModel):
    """Training metrics response."""
    gradient_boosting: Dict[str, Any]
    ensemble: Dict[str, Any]
    reinforcement_learning: Dict[str, Any]
    timestamp: str

@app.get("/", tags=["Status"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "IOTA Risk Assessment API",
        "version": "1.0.0",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health", tags=["Status"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/assess-risk", response_model=RiskAssessmentResponse, tags=["Risk Assessment"])
async def assess_risk(
    user_data: UserData,
    model: EnhancedIOTARiskModel = Depends(get_model)
):
    """
    Assess risk for a user based on provided data.
    
    This endpoint performs a comprehensive risk assessment using the enhanced IOTA
    risk model, which includes gradient boosting, transformer models, and reinforcement
    learning components.
    """
    try:
        logger.info(f"Assessing risk for {user_data.address}")
        
        # Convert Pydantic model to dict
        user_data_dict = user_data.dict(exclude_unset=True)
        
        # Run risk assessment
        result = model.assess_risk(user_data_dict)
        
        # Convert result to response model
        return result
    except Exception as e:
        logger.error(f"Error assessing risk: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Risk assessment failed: {str(e)}"
        )

@app.post("/train", response_model=TrainingMetrics, tags=["Model Management"])
async def train_model(
    file: str = Body(..., embed=True, description="Path to training data CSV file"),
    model: EnhancedIOTARiskModel = Depends(get_model)
):
    """
    Train the risk assessment model with new data.
    
    This endpoint trains all components of the risk assessment model, including
    gradient boosting, ensemble model, and reinforcement learning.
    """
    try:
        logger.info(f"Training model with data from {file}")
        
        # Check if file exists
        if not os.path.exists(file):
            raise HTTPException(
                status_code=404,
                detail=f"Training data file not found: {file}"
            )
        
        # Load data
        import pandas as pd
        data = pd.read_csv(file)
        
        # Train model
        metrics = model.train_model(data)
        
        return metrics
    except Exception as e:
        logger.error(f"Error training model: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Model training failed: {str(e)}"
        )

@app.get("/model-info", tags=["Model Management"])
async def model_info(model: EnhancedIOTARiskModel = Depends(get_model)):
    """Get information about the current model."""
    try:
        # Get model configuration and status
        component_status = {
            "transformer_model": hasattr(model.transformer_model, 'model') and model.transformer_model.model is not None,
            "gradient_boosting_model": hasattr(model.gradient_boosting_model, 'model') and model.gradient_boosting_model.model is not None,
            "ensemble_model": hasattr(model.ensemble_model, 'meta_learner') and model.ensemble_model.meta_learner is not None,
            "reinforcement_learning": hasattr(model.rl_fine_tuner, 'model') and model.rl_fine_tuner.model is not None
        }
        
        # Get IOTA connection status
        iota_status = {
            "connected": model.iota_connection is not None and model.iota_connection.is_connected,
            "network": model.iota_connection.config.get("network", "unknown") if model.iota_connection else "not_connected"
        }
        
        return {
            "component_status": component_status,
            "iota_connection": iota_status,
            "config": model.config,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get model info: {str(e)}"
        )

# Run the API server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    logger.info(f"Starting IOTA Risk Assessment API on {host}:{port}")
    uvicorn.run("risk_assessment_api:app", host=host, port=port, reload=True)
