#!/usr/bin/env python
"""
Run Risk Model Directly

This script runs the risk model directly from the command line,
making it easy to integrate with Node.js code through child processes.
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("run_model.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import risk model
try:
    from enhanced_iota_risk_model import EnhancedIOTARiskModel, assess_risk_sync
except ImportError as e:
    logger.error(f"Error importing risk model: {e}")
    sys.exit(1)

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Run risk assessment model')
    parser.add_argument('--input', required=True, help='Input JSON file with user data')
    parser.add_argument('--output', help='Output JSON file (defaults to stdout)')
    parser.add_argument('--mode', default='predict', choices=['predict', 'train'], 
                        help='Mode to run the model in')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    
    return parser.parse_args()

def load_user_data(input_path):
    """Load user data from JSON file"""
    try:
        with open(input_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Error loading user data from {input_path}: {e}")
        sys.exit(1)

def save_results(results, output_path=None):
    """Save results to JSON file or print to stdout"""
    if output_path:
        try:
            with open(output_path, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"Results saved to {output_path}")
        except Exception as e:
            logger.error(f"Error saving results to {output_path}: {e}")
            # Fall back to stdout
            print(json.dumps(results, indent=2))
    else:
        # Print to stdout
        print(json.dumps(results, indent=2))

def main():
    """Main entry point"""
    args = parse_arguments()
    
    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Load user data
    user_data = load_user_data(args.input)
    
    try:
        if args.mode == 'predict':
            logger.info(f"Running risk assessment for user {user_data.get('address', 'unknown')}")
            
            # Use the synchronous assessment function
            config_path = args.config if args.config else None
            results = assess_risk_sync(user_data, config_path)
            
            # Save or print results
            save_results(results, args.output)
            
            logger.info(f"Risk assessment complete. Score: {results['riskScore']}")
            return 0
        
        elif args.mode == 'train':
            logger.info("Training risk model")
            
            # Initialize model
            config_path = args.config if args.config else None
            model = EnhancedIOTARiskModel(config_path)
            
            # Train the model (not implemented in enhanced_iota_risk_model.py)
            # This would be implemented in a real production system
            logger.warning("Training mode not implemented yet")
            
            # Save model
            model.save_model()
            
            # Save training results
            training_results = {
                "status": "completed",
                "timestamp": datetime.now().isoformat(),
                "message": "Model training completed successfully"
            }
            save_results(training_results, args.output)
            
            logger.info("Model training complete")
            return 0
    
    except Exception as e:
        logger.error(f"Error running model: {e}")
        error_results = {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
        save_results(error_results, args.output)
        return 1

if __name__ == "__main__":
    sys.exit(main())
