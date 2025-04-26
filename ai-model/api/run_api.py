#!/usr/bin/env python
"""
Run the IOTA Risk Assessment API Server

This script starts the FastAPI server for the risk assessment API.
"""

import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    """Run the API server."""
    # Get configuration from environment variables
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    reload = os.environ.get("RELOAD", "false").lower() == "true"
    log_level = os.environ.get("LOG_LEVEL", "info")
    
    print(f"Starting IOTA Risk Assessment API on {host}:{port}")
    print(f"API Documentation: http://{host}:{port}/docs")
    
    # Start the server
    uvicorn.run(
        "risk_assessment_api:app",
        host=host,
        port=port,
        reload=reload,
        log_level=log_level
    )

if __name__ == "__main__":
    # Add the current directory to sys.path to make the API module importable
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    main()
