#!/usr/bin/env python
"""
Run the IOTA Risk Assessment API Server

This script starts the Flask server for the risk assessment API.
"""

import os
import sys
import subprocess
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    """Run the API server."""
    # Get configuration from environment variables
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    
    print(f"Starting IOTA Risk Assessment API on {host}:{port}")
    print(f"API Documentation available at /health endpoint")
    
    # Start the server using the Flask app
    current_dir = os.path.dirname(os.path.abspath(__file__))
    app_path = os.path.join(current_dir, "app.py")
    
    # Set environment variables
    env = os.environ.copy()
    env["AI_API_PORT"] = str(port)
    env["FLASK_APP"] = app_path
    env["FLASK_ENV"] = "development" if debug else "production"
    
    # Run Flask app
    try:
        flask_cmd = ["python", app_path]
        subprocess.run(flask_cmd, env=env)
    except KeyboardInterrupt:
        print("API server stopped")
    except Exception as e:
        print(f"Error starting API server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Add the current directory to sys.path to make the API module importable
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    # Add parent directory to path for imports
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(parent_dir)
    
    main()
