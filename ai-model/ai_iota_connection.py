"""
IOTA Network Connection for AI Risk Assessment

This module provides connectivity between the AI risk model and the IOTA network.
It fetches real-time data from both IOTA L1 (Tangle) and L2 (EVM) layers for
comprehensive risk assessment.
"""

import os
import sys
import logging
import json
import requests
import time
import pandas as pd
from typing import Dict, Any, List, Optional, Union, Tuple
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("iota_connection.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IOTANetworkConnection:
    """
    Connects to the IOTA network via the backend API to retrieve
    on-chain data for risk assessment.
    """
    
    def __init__(self, config_path="config/iota_connection_config.json"):
        """
        Initialize the IOTA network connection.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize connection status
        self.is_connected = False
        
        # Connect to IOTA network
        self._connect()
        
        logger.info("IOTA Network Connection initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file or use defaults."""
        try:
            # Always try to load from environment variables first, then config file
            iota_network = os.environ.get("IOTA_NETWORK", "testnet")
            iota_evm_rpc_url = os.environ.get("IOTA_EVM_RPC_URL", "https://api.testnet.shimmer.network/evm")
            
            # Try to load config file
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Configuration loaded from {config_path}")
            
            # Override config values with environment variables if they exist
            if iota_network:
                config["network"] = iota_network
            
            return config
        except FileNotFoundError:
            logger.warning(f"Configuration file {config_path} not found. Using default configuration.")
            # Default configuration with proper IOTA testnet endpoints
            return {
                "api_url": os.environ.get("API_URL", "http://localhost:3002"),
                "request_timeout": 30,  # seconds
                "retry_attempts": 3,
                "retry_delay": 2,  # seconds
                "cache_duration": 120,  # seconds
                "network": os.environ.get("IOTA_NETWORK", "testnet"),
                "nodes": {
                    "testnet": [
                        "https://api.testnet.iota.cafe",
                        "https://testnet.shimmer.network",
                        "https://testnet.shimmer.iota-1.workers.dev",
                        "https://shimmer-testnet.api.nodesail.io"
                    ]
                },
                "headers": {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                "endpoints": {
                    "json_rpc": "https://api.testnet.iota.cafe",
                    "indexer": "https://indexer.testnet.iota.cafe",
                    "graphql": "https://graphql.testnet.iota.cafe",
                    "websocket": "wss://api.testnet.iota.cafe",
                    "faucet": "https://faucet.testnet.iota.cafe"
                },
                "contracts": {
                    "lending_pool_address": os.environ.get("LENDING_POOL_ADDRESS", "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE"),
                    "bridge_address": os.environ.get("BRIDGE_ADDRESS", "0x3Aa5ebB10DC797CAC828524e59A333d0A371443c")
                }
            }
    
    def _connect(self) -> bool:
        """Establish connection to IOTA network via API."""
        try:
            # Check health endpoint to verify connection
            response = self._make_request("GET", "/health")
            
            if response and response.get("status") == "ok":
                logger.info(f"Connected to IOTA network: {response.get('iota', {}).get('network', 'unknown')}")
                self.is_connected = True
                
                # Store network information
                self.network_info = response.get("iota", {})
                
                # Log additional connection info
                logger.info(f"Using IOTA network: {self.config.get('network', 'testnet')}")
                if 'endpoints' in self.config:
                    logger.info(f"JSON-RPC endpoint: {self.config['endpoints']['json_rpc']}")
                    logger.info(f"Indexer endpoint: {self.config['endpoints']['indexer']}")
                
                return True
            else:
                # If API health check fails, try direct connection to IOTA node
                try:
                    # Direct connection to IOTA node
                    node_url = self.config.get('endpoints', {}).get('json_rpc', 'https://api.testnet.iota.cafe')
                    logger.info(f"Trying direct connection to IOTA node: {node_url}")
                    
                    # Simple request to node info endpoint
                    import requests
                    node_response = requests.get(f"{node_url}/api/v2/info", 
                                              headers=self.config["headers"],
                                              timeout=self.config["request_timeout"])
                    
                    if node_response.status_code == 200:
                        logger.info(f"Direct connection to IOTA node successful")
                        self.is_connected = True
                        self.network_info = node_response.json().get("nodeInfo", {})
                        return True
                    else:
                        logger.error(f"Failed to connect directly to IOTA node: {node_response.status_code}")
                        self.is_connected = False
                        return False
                except Exception as node_error:
                    logger.error(f"Error connecting directly to IOTA node: {node_error}")
                    self.is_connected = False
                    return False
        except Exception as e:
            logger.error(f"Error connecting to IOTA network: {e}")
            self.is_connected = False
            return False
    
    def _make_request(self, method: str, endpoint: str, data: Dict = None, retry: int = 0) -> Dict[str, Any]:
        """
        Make HTTP request to API with retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            data: Request payload for POST requests
            retry: Current retry attempt
            
        Returns:
            Response data as dictionary
        """
        url = f"{self.config['api_url']}{endpoint}"
        
        try:
            if method == "GET":
                response = requests.get(
                    url,
                    headers=self.config["headers"],
                    timeout=self.config["request_timeout"]
                )
            elif method == "POST":
                response = requests.post(
                    url,
                    json=data,
                    headers=self.config["headers"],
                    timeout=self.config["request_timeout"]
                )
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check for successful response
            if response.status_code in (200, 201):
                return response.json()
            else:
                logger.warning(f"API request failed: {response.status_code} - {response.text}")
                
                # Retry logic
                if retry < self.config["retry_attempts"]:
                    retry_delay = self.config["retry_delay"] * (2 ** retry)  # Exponential backoff
                    logger.info(f"Retrying in {retry_delay} seconds (attempt {retry + 1})")
                    time.sleep(retry_delay)
                    return self._make_request(method, endpoint, data, retry + 1)
                else:
                    logger.error(f"Max retry attempts reached for {endpoint}")
                    return {"error": f"Request failed after {retry} attempts"}
        except Exception as e:
            logger.error(f"Error making request to {url}: {e}")
            
            # Retry logic
            if retry < self.config["retry_attempts"]:
                retry_delay = self.config["retry_delay"] * (2 ** retry)  # Exponential backoff
                logger.info(f"Retrying in {retry_delay} seconds (attempt {retry + 1})")
                time.sleep(retry_delay)
                return self._make_request(method, endpoint, data, retry + 1)
            else:
                logger.error(f"Max retry attempts reached for {endpoint}")
                return {"error": f"Request failed after {retry} attempts: {str(e)}"}
    
    def get_network_info(self) -> Dict[str, Any]:
        """
        Get IOTA network information.
        
        Returns:
            Dictionary with network details
        """
        if not self.is_connected:
            self._connect()
            
        response = self._make_request("GET", "/api/iota/network")
        return response
    
    def get_address_info(self, address: str) -> Dict[str, Any]:
        """
        Get information for a specific IOTA address including balance and transactions.
        
        Args:
            address: IOTA address to query
            
        Returns:
            Dictionary with address information
        """
        response = self._make_request("GET", f"/api/iota/balance/{address}?includeTransactions=true")
        return response
    
    def get_transactions(self, address: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get transactions for a specific address.
        
        Args:
            address: IOTA address to query
            limit: Maximum number of transactions to return
            
        Returns:
            List of transactions
        """
        response = self._make_request("GET", f"/api/iota/transactions?address={address}&limit={limit}")
        return response.get("transactions", [])
    
    def get_cross_layer_messages(self, address: str) -> List[Dict[str, Any]]:
        """
        Get cross-layer messages for an address.
        
        Args:
            address: Address to query (can be IOTA or EVM address)
            
        Returns:
            List of cross-layer messages
        """
        response = self._make_request("GET", f"/api/cross-layer/messages/{address}")
        return response.get("messages", [])
    
    def get_identity_status(self, address: str) -> Dict[str, Any]:
        """
        Get identity verification status for an address.
        
        Args:
            address: Address to query (can be IOTA or EVM address)
            
        Returns:
            Dictionary with identity verification status
        """
        # Try to get identity status via IOTA streams - this is a custom endpoint
        # that would need to be implemented in the Node.js backend
        response = self._make_request("GET", f"/api/iota/identity/status/{address}")
        return response
    
    def get_bridge_messages(self, address: str) -> List[Dict[str, Any]]:
        """
        Get bridge messages between L1 and L2 for an address.
        
        Args:
            address: Address to query
            
        Returns:
            List of bridge messages
        """
        response = self._make_request("GET", f"/api/bridge/messages/{address}")
        return response.get("messages", [])
    
    def get_address_activity_metrics(self, address: str) -> Dict[str, Any]:
        """
        Calculate activity metrics for an IOTA address.
        
        Args:
            address: IOTA address to analyze
            
        Returns:
            Dictionary with activity metrics
        """
        try:
            # Get address information including transactions
            address_info = self.get_address_info(address)
            
            if "error" in address_info:
                logger.error(f"Error getting address info: {address_info['error']}")
                return {}
                
            # Get transactions
            transactions = address_info.get("transactions", [])
            
            if not transactions:
                logger.warning(f"No transactions found for address {address}")
                return {
                    "transaction_count": 0,
                    "first_activity_days": 0,
                    "last_activity_days": 0,
                    "activity_regularity": 0.0,
                    "avg_transaction_value": 0.0,
                    "max_transaction_value": 0.0,
                    "outgoing_ratio": 0.0
                }
            
            # Calculate metrics
            transaction_count = len(transactions)
            
            # Convert timestamps to datetime objects
            timestamps = []
            values = []
            outgoing_count = 0
            
            for tx in transactions:
                timestamp = tx.get("timestamp")
                if timestamp:
                    if isinstance(timestamp, str):
                        timestamps.append(datetime.fromisoformat(timestamp.replace('Z', '+00:00')))
                    else:
                        timestamps.append(datetime.fromtimestamp(timestamp / 1000))
                
                # Track values
                value = float(tx.get("amount", 0))
                values.append(value)
                
                # Count outgoing transactions
                if not tx.get("incoming", False):
                    outgoing_count += 1
            
            # Sort timestamps
            timestamps.sort()
            
            # Calculate days since first and last activity
            now = datetime.now()
            first_activity_days = (now - timestamps[0]).days if timestamps else 0
            last_activity_days = (now - timestamps[-1]).days if timestamps else 0
            
            # Calculate activity regularity (standard deviation of time between transactions)
            time_diffs = []
            for i in range(1, len(timestamps)):
                diff = (timestamps[i] - timestamps[i-1]).total_seconds() / 86400  # Convert to days
                time_diffs.append(diff)
            
            if time_diffs:
                import numpy as np
                mean_diff = np.mean(time_diffs)
                std_diff = np.std(time_diffs)
                
                # Normalize to get a score between 0 and 1 (higher is more regular)
                # Use coefficient of variation (std/mean) and convert to a regularity score
                if mean_diff > 0:
                    irregularity = min(std_diff / mean_diff, 10)  # Cap at 10 for very irregular patterns
                    activity_regularity = 1 - (irregularity / 10)
                else:
                    activity_regularity = 0
            else:
                activity_regularity = 0
            
            # Calculate transaction value statistics
            avg_transaction_value = sum(values) / len(values) if values else 0
            max_transaction_value = max(values) if values else 0
            
            # Calculate outgoing ratio
            outgoing_ratio = outgoing_count / transaction_count if transaction_count > 0 else 0
            
            return {
                "transaction_count": transaction_count,
                "first_activity_days": first_activity_days,
                "last_activity_days": last_activity_days,
                "activity_regularity": activity_regularity,
                "avg_transaction_value": avg_transaction_value,
                "max_transaction_value": max_transaction_value,
                "outgoing_ratio": outgoing_ratio
            }
        except Exception as e:
            logger.error(f"Error calculating address activity metrics: {e}")
            return {}
    
    def get_cross_layer_activity_metrics(self, address: str, evm_address: str = None) -> Dict[str, Any]:
        """
        Calculate cross-layer activity metrics for an address.
        
        Args:
            address: IOTA address
            evm_address: Ethereum address (optional)
            
        Returns:
            Dictionary with cross-layer activity metrics
        """
        try:
            cross_layer_messages = []
            
            # Get IOTA address messages
            iota_messages = self.get_cross_layer_messages(address)
            cross_layer_messages.extend(iota_messages)
            
            # If EVM address is provided, get those messages too
            if evm_address:
                evm_messages = self.get_cross_layer_messages(evm_address)
                cross_layer_messages.extend(evm_messages)
            
            # Get bridge messages
            bridge_messages = []
            if evm_address:
                bridge_messages = self.get_bridge_messages(evm_address)
            
            # Combine all cross-layer activities
            all_activities = cross_layer_messages + bridge_messages
            
            if not all_activities:
                logger.warning(f"No cross-layer activities found for addresses {address}, {evm_address}")
                return {
                    "cross_layer_transfers": 0,
                    "l1_to_l2_count": 0,
                    "l2_to_l1_count": 0,
                    "cross_layer_success_rate": 0.0,
                    "cross_layer_days_since_first": 0,
                    "cross_layer_days_since_last": 0
                }
            
            # Count transfer types
            l1_to_l2_count = 0
            l2_to_l1_count = 0
            successful_count = 0
            
            # Collect timestamps
            timestamps = []
            
            for activity in all_activities:
                # Check direction
                direction = activity.get("direction", "")
                if direction == "L1ToL2":
                    l1_to_l2_count += 1
                elif direction == "L2ToL1":
                    l2_to_l1_count += 1
                
                # Check status
                status = activity.get("status", "")
                if status in ["Processed", "confirmed", "Confirmed"]:
                    successful_count += 1
                
                # Get timestamp
                timestamp = activity.get("timestamp")
                if timestamp:
                    if isinstance(timestamp, str):
                        timestamps.append(datetime.fromisoformat(timestamp.replace('Z', '+00:00')))
                    else:
                        timestamps.append(datetime.fromtimestamp(timestamp / 1000))
            
            # Sort timestamps
            timestamps.sort()
            
            # Calculate days since first and last activity
            now = datetime.now()
            cross_layer_days_since_first = (now - timestamps[0]).days if timestamps else 0
            cross_layer_days_since_last = (now - timestamps[-1]).days if timestamps else 0
            
            # Calculate success rate
            total_activities = len(all_activities)
            cross_layer_success_rate = successful_count / total_activities if total_activities > 0 else 0
            
            return {
                "cross_layer_transfers": total_activities,
                "l1_to_l2_count": l1_to_l2_count,
                "l2_to_l1_count": l2_to_l1_count,
                "cross_layer_success_rate": cross_layer_success_rate,
                "cross_layer_days_since_first": cross_layer_days_since_first,
                "cross_layer_days_since_last": cross_layer_days_since_last
            }
        except Exception as e:
            logger.error(f"Error calculating cross-layer activity metrics: {e}")
            return {}
    
    def check_identity_verification(self, address: str, evm_address: str = None) -> Dict[str, Any]:
        """
        Check identity verification status for an address.
        
        Args:
            address: IOTA address
            evm_address: Ethereum address (optional)
            
        Returns:
            Dictionary with identity verification information
        """
        try:
            # Try IOTA address first
            identity_status = self.get_identity_status(address)
            
            # If not verified and EVM address is provided, try that
            if evm_address and not identity_status.get("verified", False):
                evm_identity_status = self.get_identity_status(evm_address)
                
                # Use EVM status if verified
                if evm_identity_status.get("verified", False):
                    identity_status = evm_identity_status
            
            # Extract verification level
            verification_level = "none"
            if identity_status.get("verified", False):
                trust_level = identity_status.get("trustLevel", "").lower()
                if trust_level == "full":
                    verification_level = "full"
                elif trust_level in ["advanced", "high"]:
                    verification_level = "advanced"
                elif trust_level in ["basic", "low", "standard"]:
                    verification_level = "basic"
            
            return {
                "identity_verified": identity_status.get("verified", False),
                "identity_verification_level": verification_level,
                "identity_verification_date": identity_status.get("verificationDate"),
                "identity_trust_score": identity_status.get("trustScore", 0)
            }
        except Exception as e:
            logger.error(f"Error checking identity verification: {e}")
            return {
                "identity_verified": False,
                "identity_verification_level": "none",
                "identity_verification_date": None,
                "identity_trust_score": 0
            }
    
    def get_iota_feature_vector(self, address: str, evm_address: str = None) -> Dict[str, Any]:
        """
        Generate a comprehensive feature vector for risk assessment.
        
        Args:
            address: IOTA address
            evm_address: Ethereum address (optional)
            
        Returns:
            Dictionary with all features for risk assessment
        """
        try:
            # Get basic address info
            address_info = self.get_address_info(address)
            
            # Get activity metrics
            activity_metrics = self.get_address_activity_metrics(address)
            
            # Get cross-layer activity
            cross_layer_metrics = self.get_cross_layer_activity_metrics(address, evm_address)
            
            # Get identity verification status
            identity_info = self.check_identity_verification(address, evm_address)
            
            # Combine all information into a feature vector
            features = {
                # Basic information
                "address": address,
                "evm_address": evm_address,
                "has_iota_address": True,
                
                # Balance information
                "iota_balance": float(address_info.get("baseCoins", 0)) / 1_000_000,  # Convert to MIOTA
                "iota_native_tokens_count": len(address_info.get("nativeTokens", [])),
                
                # Transaction activity
                "iota_transaction_count": activity_metrics.get("transaction_count", 0),
                "iota_first_activity_days": activity_metrics.get("first_activity_days", 0),
                "iota_last_activity_days": activity_metrics.get("last_activity_days", 0),
                "iota_activity_regularity": activity_metrics.get("activity_regularity", 0.0),
                "iota_avg_transaction_value": activity_metrics.get("avg_transaction_value", 0.0),
                "iota_max_transaction_value": activity_metrics.get("max_transaction_value", 0.0),
                "iota_outgoing_ratio": activity_metrics.get("outgoing_ratio", 0.0),
                
                # Cross-layer activity
                "cross_layer_transfers": cross_layer_metrics.get("cross_layer_transfers", 0),
                "l1_to_l2_count": cross_layer_metrics.get("l1_to_l2_count", 0),
                "l2_to_l1_count": cross_layer_metrics.get("l2_to_l1_count", 0),
                "cross_layer_success_rate": cross_layer_metrics.get("cross_layer_success_rate", 0.0),
                "cross_layer_days_since_first": cross_layer_metrics.get("cross_layer_days_since_first", 0),
                "cross_layer_days_since_last": cross_layer_metrics.get("cross_layer_days_since_last", 0),
                
                # Identity verification
                "identity_verified": identity_info.get("identity_verified", False),
                "identity_verification_level": identity_info.get("identity_verification_level", "none"),
                "identity_verification_date": identity_info.get("identity_verification_date"),
                "identity_trust_score": identity_info.get("identity_trust_score", 0)
            }
            
            return features
        except Exception as e:
            logger.error(f"Error generating IOTA feature vector: {e}")
            # Return a default feature vector with zeros
            return {
                "address": address,
                "evm_address": evm_address,
                "has_iota_address": True,
                "iota_balance": 0.0,
                "iota_native_tokens_count": 0,
                "iota_transaction_count": 0,
                "iota_first_activity_days": 0,
                "iota_last_activity_days": 0,
                "iota_activity_regularity": 0.0,
                "iota_avg_transaction_value": 0.0,
                "iota_max_transaction_value": 0.0,
                "iota_outgoing_ratio": 0.0,
                "cross_layer_transfers": 0,
                "l1_to_l2_count": 0,
                "l2_to_l1_count": 0,
                "cross_layer_success_rate": 0.0,
                "cross_layer_days_since_first": 0,
                "cross_layer_days_since_last": 0,
                "identity_verified": False,
                "identity_verification_level": "none",
                "identity_verification_date": None,
                "identity_trust_score": 0
            }

# Singleton instance for reuse
_iota_connection = None

def get_iota_connection(config_path="config/iota_connection_config.json") -> IOTANetworkConnection:
    """
    Get a singleton instance of the IOTA network connection.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        IOTA network connection instance
    """
    global _iota_connection
    if _iota_connection is None:
        _iota_connection = IOTANetworkConnection(config_path)
    return _iota_connection

# Main execution
if __name__ == "__main__":
    # Test connection
    connection = get_iota_connection()
    
    # Get network info
    network_info = connection.get_network_info()
    print(f"Network info: {json.dumps(network_info, indent=2)}")
    
    # Test with a sample address (replace with actual address for testing)
    test_address = "smr1qpj8775lmqcudesrld45ntzm27umfn3xh46cmw0kr9ruqavrjcn3tmxx5mu"
    
    # Get feature vector
    features = connection.get_iota_feature_vector(test_address)
    print(f"Feature vector: {json.dumps(features, indent=2)}")
