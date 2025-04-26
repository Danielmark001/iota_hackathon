"""
Run IOTA Risk Assessment

This script provides a simple command-line interface to run the enhanced IOTA risk assessment model.
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime
from enhanced_iota_risk_model import EnhancedIOTARiskModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("risk_assessment.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Run IOTA Risk Assessment")
    
    parser.add_argument("--eth-address", help="Ethereum address to assess")
    parser.add_argument("--iota-address", help="IOTA address to include in assessment")
    parser.add_argument("--input-file", help="JSON file with user data")
    parser.add_argument("--output-file", help="Output file for assessment results")
    parser.add_argument("--train", action="store_true", help="Train model with provided data")
    parser.add_argument("--training-data", help="CSV file with training data")
    parser.add_argument("--config", default="config/iota_risk_model_config.json", help="Path to configuration file")
    
    return parser.parse_args()

def main():
    """Main function."""
    # Parse arguments
    args = parse_args()
    
    try:
        # Initialize model
        logger.info("Initializing IOTA Risk Assessment Model")
        model = EnhancedIOTARiskModel(config_path=args.config)
        
        # Training mode
        if args.train:
            if not args.training_data:
                logger.error("Training data file not provided")
                sys.exit(1)
                
            import pandas as pd
            
            # Load training data
            logger.info(f"Loading training data from {args.training_data}")
            data = pd.read_csv(args.training_data)
            
            # Train model
            logger.info(f"Training model with {len(data)} samples")
            metrics = model.train_model(data)
            
            # Print metrics
            logger.info("Training complete")
            print(json.dumps(metrics, indent=2))
            
            # Save metrics to file if output file specified
            if args.output_file:
                with open(args.output_file, 'w') as f:
                    json.dump(metrics, f, indent=2)
                logger.info(f"Training metrics saved to {args.output_file}")
                
            return
        
        # Risk assessment mode
        # Get user data
        user_data = {}
        
        if args.input_file:
            # Load user data from file
            logger.info(f"Loading user data from {args.input_file}")
            with open(args.input_file, 'r') as f:
                user_data = json.load(f)
        else:
            # Use command line arguments
            if args.eth_address:
                user_data["address"] = args.eth_address
            
            if args.iota_address:
                user_data["iota_address"] = args.iota_address
        
        # Check if we have enough data
        if not user_data.get("address") and not user_data.get("iota_address"):
            logger.error("Neither Ethereum nor IOTA address provided")
            sys.exit(1)
        
        # Run risk assessment
        logger.info(f"Running risk assessment for {user_data.get('address', user_data.get('iota_address'))}")
        result = model.assess_risk(user_data)
        
        # Print result
        print("\nRisk Assessment Result:")
        print(f"Address: {result.get('address')}")
        print(f"Risk Score: {result.get('riskScore')}/100")
        print(f"Risk Class: {result.get('riskClass')}")
        print(f"Confidence: {result.get('confidenceScore'):.2f}")
        
        # Print component scores if available
        component_scores = result.get("componentScores", {})
        if component_scores:
            print("\nComponent Scores:")
            for component, score in component_scores.items():
                print(f"- {component}: {score:.2f}")
        
        # Print recommendations
        recommendations = result.get("recommendations", [])
        if recommendations:
            print("\nRecommendations:")
            for i, rec in enumerate(recommendations, 1):
                print(f"{i}. {rec.get('title')}: {rec.get('description')}")
        
        # Print risk factors
        risk_factors = result.get("riskFactors", [])
        if risk_factors:
            print("\nRisk Factors:")
            for factor in risk_factors:
                impact = factor.get("impact", "")
                impact_symbol = "✓" if impact == "positive" else "✗" if impact == "negative" else "•"
                print(f"{impact_symbol} {factor.get('factor')}: {factor.get('description')}")
        
        # Save to file if output file specified
        if args.output_file:
            with open(args.output_file, 'w') as f:
                json.dump(result, f, indent=2)
            logger.info(f"Assessment result saved to {args.output_file}")
        
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
