"""
AI-IOTA Connection Module

This module provides connectivity between the AI models and the IOTA network,
enabling real-time data fetching, transaction analysis, and integration with
IOTA's unique features.
"""

import os
import sys
import json
import time
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
import numpy as np

# Configured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("iota_connection.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("iota_connection")

class IOTAConnection:
    """
    Provides connectivity to the IOTA network for AI model integration.
    
    This class handles interaction with IOTA nodes, fetching transaction data,
    analyzing on-chain activity, and integrating with IOTA Identity and Streams.
    """
    
    def __init__(self, config_path: str = 'config/iota_connection_config.json'):
        """
        Initialize the IOTA connection with configuration.
        
        Args:
            config_path: Path to configuration file
        """
        logger.info("Initializing IOTA Connection")
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Set network
        self.network = self.config.get('network', 'mainnet')
        
        # Set nodes
        self.nodes = self.config.get('nodes', [])
        self.current_node_index = 0
        
        # Initialize connection status
        self.is_connected = False
        self.health_check_count = 0
        self.last_health_check = 0
        
        # Setup node health tracking
        self.node_health = {}
        for node in self.nodes:
            self.node_health[node] = {
                'healthy': True,
                'failure_count': 0,
                'last_check': 0,
                'response_time': 0
            }
        
        # Initialize cache
        self.cache = {
            'address_data': {},
            'token_prices': {},
            'network_stats': {}
        }
        
        # Connect to IOTA network
        self._connect()
        
        logger.info(f"IOTA Connection initialized: connected={self.is_connected}, network={self.network}")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """
        Load configuration from file.
        
        Args:
            config_path: Path to configuration file
            
        Returns:
            Configuration dictionary
        """
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Loaded configuration from {config_path}")
            return config
        except FileNotFoundError:
            logger.warning(f"Configuration file {config_path} not found. Using default configuration.")
            # Default configuration for IOTA mainnet
            return {
                "network": "mainnet",
                "nodes": [
                    "https://api.shimmer.network",
                    "https://mainnet.shimmer.iota-1.workers.dev",
                    "https://shimmer-mainnet.api.nodesail.io"
                ],
                "authentication": {
                    "type": "none"
                },
                "connection_timeout": 10000,
                "retry_count": 3,
                "retry_delay": 1000,
                "max_cache_age": 300,
                "use_local_pow": True
            }
    
    def _connect(self) -> bool:
        """
        Connect to the IOTA network.
        
        Returns:
            Success status
        """
        # Try all available nodes
        for i in range(len(self.nodes)):
            node_url = self.nodes[self.current_node_index]
            
            try:
                logger.info(f"Connecting to IOTA node: {node_url}")
                
                # Test connection with health endpoint
                response = self._make_request(f"{node_url}/health", timeout=self.config.get('connection_timeout', 10000) / 1000)
                
                if response.status_code == 200:
                    self.is_connected = True
                    logger.info(f"Successfully connected to IOTA node: {node_url}")
                    
                    # Update node health
                    self.node_health[node_url]['healthy'] = True
                    self.node_health[node_url]['failure_count'] = 0
                    self.node_health[node_url]['last_check'] = time.time()
                    
                    # Get basic node info
                    self._get_node_info()
                    
                    return True
                else:
                    logger.warning(f"Failed to connect to {node_url}: HTTP {response.status_code}")
                    self._mark_node_unhealthy(node_url)
            except Exception as e:
                logger.warning(f"Error connecting to {node_url}: {str(e)}")
                self._mark_node_unhealthy(node_url)
            
            # Try next node
            self.current_node_index = (self.current_node_index + 1) % len(self.nodes)
        
        # If we get here, all nodes failed
        self.is_connected = False
        logger.error("Failed to connect to any IOTA node")
        return False
    
    def _make_request(self, url: str, method: str = 'GET', data: Optional[Dict[str, Any]] = None, 
                     headers: Optional[Dict[str, str]] = None, timeout: float = 10.0) -> requests.Response:
        """
        Make an HTTP request with retry logic.
        
        Args:
            url: Request URL
            method: HTTP method (GET, POST, etc.)
            data: Request data/payload
            headers: Request headers
            timeout: Request timeout in seconds
            
        Returns:
            Response object
        """
        # Set default headers
        if headers is None:
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        
        # Add authentication if configured
        auth_config = self.config.get('authentication', {})
        auth_type = auth_config.get('type', 'none')
        
        if auth_type == 'api_key':
            headers['X-API-Key'] = auth_config.get('api_key', '')
        elif auth_type == 'bearer':
            headers['Authorization'] = f"Bearer {auth_config.get('token', '')}"
        
        # Set retry parameters
        retry_count = self.config.get('retry_count', 3)
        retry_delay = self.config.get('retry_delay', 1000) / 1000  # Convert to seconds
        
        # Make request with retry logic
        for attempt in range(retry_count + 1):
            try:
                if method.upper() == 'GET':
                    response = requests.get(url, headers=headers, timeout=timeout)
                elif method.upper() == 'POST':
                    response = requests.post(url, json=data, headers=headers, timeout=timeout)
                elif method.upper() == 'PUT':
                    response = requests.put(url, json=data, headers=headers, timeout=timeout)
                elif method.upper() == 'DELETE':
                    response = requests.delete(url, json=data, headers=headers, timeout=timeout)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                # Return response if successful
                return response
            except Exception as e:
                logger.warning(f"Request attempt {attempt+1}/{retry_count+1} failed: {str(e)}")
                
                # If last attempt, re-raise exception
                if attempt == retry_count:
                    raise
                
                # Wait before retrying
                time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
    
    def _get_node_info(self) -> Dict[str, Any]:
        """
        Get information about the current node.
        
        Returns:
            Node information dictionary
        """
        if not self.is_connected:
            logger.error("Not connected to IOTA network")
            return {}
        
        try:
            node_url = self.nodes[self.current_node_index]
            response = self._make_request(f"{node_url}/api/v2/info")
            
            if response.status_code == 200:
                info = response.json()
                # Cache basic info
                self.network_info = {
                    'node_url': node_url,
                    'network': info.get('data', {}).get('network', self.network),
                    'version': info.get('data', {}).get('version', 'unknown'),
                    'is_healthy': info.get('data', {}).get('is_healthy', False),
                    'latest_milestone': info.get('data', {}).get('latest_milestone_index', 0)
                }
                
                logger.info(f"Connected to {self.network_info['network']} network, node version: {self.network_info['version']}")
                return self.network_info
            else:
                logger.warning(f"Failed to get node info: HTTP {response.status_code}")
                return {}
        except Exception as e:
            logger.error(f"Error getting node info: {str(e)}")
            return {}
    
    def _mark_node_unhealthy(self, node_url: str):
        """
        Mark a node as unhealthy and update its status.
        
        Args:
            node_url: URL of the node to mark
        """
        if node_url in self.node_health:
            self.node_health[node_url]['failure_count'] += 1
            self.node_health[node_url]['last_check'] = time.time()
            
            # Mark as unhealthy after consistent failures
            if self.node_health[node_url]['failure_count'] >= 3:
                self.node_health[node_url]['healthy'] = False
                logger.warning(f"Marked node {node_url} as unhealthy after {self.node_health[node_url]['failure_count']} failures")
    
    def _switch_to_healthy_node(self) -> bool:
        """
        Switch to a healthy node if the current one is unhealthy.
        
        Returns:
            Success status
        """
        # Check if current node is unhealthy
        current_node = self.nodes[self.current_node_index]
        if self.node_health[current_node]['healthy']:
            return True  # Current node is fine
        
        # Find a healthy node
        for i in range(len(self.nodes)):
            next_index = (self.current_node_index + i + 1) % len(self.nodes)
            next_node = self.nodes[next_index]
            
            if self.node_health[next_node]['healthy']:
                self.current_node_index = next_index
                logger.info(f"Switched to healthy node: {next_node}")
                return True
        
        # If all nodes are unhealthy, try to reconnect to the least recently failed one
        least_recent = min(self.node_health.items(), key=lambda x: x[1]['last_check'])
        least_recent_node = least_recent[0]
        least_recent_index = self.nodes.index(least_recent_node)
        
        self.current_node_index = least_recent_index
        logger.info(f"All nodes unhealthy, trying least recent: {least_recent_node}")
        
        # Attempt to reconnect
        return self._connect()
    
    def _check_health(self) -> bool:
        """
        Check the health of the current node.
        
        Returns:
            Health status
        """
        if not self.is_connected:
            # Try to connect
            return self._connect()
        
        # Only check health periodically
        now = time.time()
        health_check_interval = self.config.get('monitoring', {}).get('health_check_interval', 300)
        
        if now - self.last_health_check < health_check_interval:
            return self.is_connected
        
        self.last_health_check = now
        
        try:
            node_url = self.nodes[self.current_node_index]
            response = self._make_request(f"{node_url}/health", timeout=5.0)
            
            if response.status_code == 200:
                # Update node health
                self.node_health[node_url]['healthy'] = True
                self.node_health[node_url]['failure_count'] = 0
                self.node_health[node_url]['last_check'] = now
                
                self.health_check_count += 1
                logger.debug(f"Health check passed for {node_url}")
                return True
            else:
                logger.warning(f"Health check failed for {node_url}: HTTP {response.status_code}")
                self._mark_node_unhealthy(node_url)
                return self._switch_to_healthy_node()
        except Exception as e:
            logger.warning(f"Health check error for current node: {str(e)}")
            self._mark_node_unhealthy(node_url)
            return self._switch_to_healthy_node()
    
    def get_address_data(self, address: str) -> Dict[str, Any]:
        """
        Get data for an IOTA address, including transaction history.
        
        Args:
            address: IOTA address to query
            
        Returns:
            Address data dictionary
        """
        # Check cache first
        cache_key = f"address_{address}"
        if cache_key in self.cache['address_data']:
            cache_entry = self.cache['address_data'][cache_key]
            max_age = self.config.get('max_cache_age', 300)
            
            if time.time() - cache_entry['timestamp'] < max_age:
                logger.info(f"Using cached data for address {address}")
                return cache_entry['data']
        
        # Check connection health
        if not self._check_health():
            logger.error("Failed to connect to IOTA network")
            return {"error": "Not connected to IOTA network"}
        
        logger.info(f"Fetching data for address {address}")
        
        try:
            # Get address outputs (balance data)
            node_url = self.nodes[self.current_node_index]
            response = self._make_request(f"{node_url}/api/v2/addresses/{address}/outputs")
            
            if response.status_code != 200:
                logger.warning(f"Failed to get address outputs: HTTP {response.status_code}")
                return {"error": f"Failed to get address data: HTTP {response.status_code}"}
            
            outputs = response.json().get('data', [])
            
            # Calculate basic address data
            total_balance = 0
            native_tokens = []
            transactions = []
            
            for output in outputs:
                # Extract balance
                if 'amount' in output:
                    total_balance += int(output['amount'])
                
                # Extract native tokens
                output_native_tokens = output.get('native_tokens', [])
                for token in output_native_tokens:
                    token_id = token.get('id')
                    token_amount = token.get('amount', '0')
                    
                    # Add to native tokens list
                    if token_id:
                        native_tokens.append({
                            'id': token_id,
                            'amount': token_amount
                        })
                
                # Extract transaction data
                if 'metadata' in output:
                    tx_timestamp = output['metadata'].get('timestamp')
                    transaction_id = output['metadata'].get('transaction_id')
                    
                    if transaction_id:
                        # Determine if incoming or outgoing based on state
                        is_spent = output['metadata'].get('is_spent', False)
                        
                        transactions.append({
                            'id': transaction_id,
                            'timestamp': tx_timestamp,
                            'amount': output.get('amount', '0'),
                            'incoming': not is_spent,
                            'tag': output.get('tag'),
                            'metadata': output.get('metadata', {})
                        })
            
            # Get additional transaction history beyond outputs
            # This would require additional API calls in a real implementation
            
            # Prepare final address data
            address_data = {
                'address': address,
                'balance': total_balance,
                'nativeTokens': native_tokens,
                'transactions': transactions,
                'firstTransactionTimestamp': min([tx['timestamp'] for tx in transactions]) if transactions else None,
                'latestTransactionTimestamp': max([tx['timestamp'] for tx in transactions]) if transactions else None,
                'messageCount': len(transactions),
                'timestamp': time.time()
            }
            
            # Cache the result
            self.cache['address_data'][cache_key] = {
                'data': address_data,
                'timestamp': time.time()
            }
            
            return address_data
        except Exception as e:
            logger.error(f"Error getting address data: {str(e)}")
            return {"error": f"Error getting address data: {str(e)}"}
    
    def get_token_price_history(self, token: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get price history for a token.
        
        Args:
            token: Token symbol
            days: Number of days of history to get
            
        Returns:
            List of price data points
        """
        # Check cache first
        cache_key = f"price_{token}_{days}"
        if cache_key in self.cache['token_prices']:
            cache_entry = self.cache['token_prices'][cache_key]
            max_age = self.config.get('max_cache_age', 300)
            
            if time.time() - cache_entry['timestamp'] < max_age:
                logger.info(f"Using cached price data for {token}")
                return cache_entry['data']
        
        logger.info(f"Fetching price history for {token} ({days} days)")
        
        try:
            # In a real implementation, this would call a price API
            # For this demo, we'll simulate price data
            
            # Get token specifics
            token_config = self._get_token_config(token)
            base_price = token_config.get('base_price', 1.0)
            volatility = token_config.get('volatility', 0.02)
            
            # Generate simulated price history
            now = datetime.now()
            price_history = []
            
            # Start with current price
            current_price = base_price
            
            for i in range(days):
                # Calculate date for this point
                date = now - timedelta(days=days-i-1)
                
                # Add some random price movement
                price_change = np.random.normal(0, volatility)
                current_price *= (1 + price_change)
                
                # Add to history
                price_history.append({
                    'timestamp': int(date.timestamp()),
                    'price': current_price,
                    'volume': np.random.randint(1000000, 10000000)
                })
            
            # Cache the result
            self.cache['token_prices'][cache_key] = {
                'data': price_history,
                'timestamp': time.time()
            }
            
            return price_history
        except Exception as e:
            logger.error(f"Error getting token price history: {str(e)}")
            return []
    
    def _get_token_config(self, token: str) -> Dict[str, Any]:
        """
        Get configuration for a token.
        
        Args:
            token: Token symbol
            
        Returns:
            Token configuration
        """
        # Define token configurations
        token_configs = {
            'IOTA': {
                'base_price': 0.25,
                'volatility': 0.025
            },
            'ETH': {
                'base_price': 2000.0,
                'volatility': 0.02
            },
            'BTC': {
                'base_price': 40000.0,
                'volatility': 0.018
            },
            'USDC': {
                'base_price': 1.0,
                'volatility': 0.001
            },
            'DAI': {
                'base_price': 1.0,
                'volatility': 0.001
            }
        }
        
        return token_configs.get(token.upper(), {
            'base_price': 1.0,
            'volatility': 0.02
        })
    
    def get_iota_feature_vector(self, iota_address: str, eth_address: Optional[str] = None) -> Dict[str, Any]:
        """
        Get a feature vector for AI analysis based on IOTA address data.
        
        Args:
            iota_address: IOTA address to analyze
            eth_address: Related Ethereum address (optional)
            
        Returns:
            Feature vector dictionary
        """
        logger.info(f"Generating feature vector for IOTA address {iota_address}")
        
        # Get address data
        address_data = self.get_address_data(iota_address)
        
        if 'error' in address_data:
            logger.warning(f"Error getting address data: {address_data['error']}")
            return {}
        
        # Extract features
        features = {}
        
        # Basic features
        features['iota_address'] = iota_address
        features['iota_balance'] = address_data.get('balance', 0)
        features['iota_transaction_count'] = len(address_data.get('transactions', []))
        features['iota_message_count'] = address_data.get('messageCount', 0)
        features['iota_native_tokens_count'] = len(address_data.get('nativeTokens', []))
        
        # Calculate first activity days (days since first transaction)
        if address_data.get('firstTransactionTimestamp'):
            first_tx_time = datetime.fromtimestamp(address_data['firstTransactionTimestamp'])
            days_since_first = (datetime.now() - first_tx_time).days
            features['iota_first_activity_days'] = days_since_first
        else:
            features['iota_first_activity_days'] = 0
        
        # Process transactions for more features
        transactions = address_data.get('transactions', [])
        
        if transactions:
            # Sort by timestamp
            transactions.sort(key=lambda x: x.get('timestamp', 0))
            
            # Calculate regularity
            timestamps = [tx.get('timestamp', 0) for tx in transactions]
            
            if len(timestamps) >= 2:
                # Calculate intervals between transactions
                intervals = np.diff(timestamps)
                
                # Calculate coefficient of variation (lower means more regular)
                mean_interval = np.mean(intervals)
                if mean_interval > 0:
                    std_interval = np.std(intervals)
                    cv = std_interval / mean_interval
                    
                    # Transform to 0-1 scale (1 is most regular)
                    features['iota_activity_regularity'] = 1.0 / (1.0 + cv)
                else:
                    features['iota_activity_regularity'] = 0.5
            else:
                features['iota_activity_regularity'] = 0.5
            
            # Count cross-layer transfers
            cross_layer_count = sum(1 for tx in transactions if tx.get('tag') == 'CROSS_LAYER_TRANSFER')
            features['cross_layer_transfers'] = cross_layer_count
            
            # Calculate incoming ratio
            incoming_count = sum(1 for tx in transactions if tx.get('incoming', False))
            if transactions:
                features['incoming_transaction_ratio'] = incoming_count / len(transactions)
            else:
                features['incoming_transaction_ratio'] = 0.5
        else:
            # Default values if no transactions
            features['iota_activity_regularity'] = 0.5
            features['cross_layer_transfers'] = 0
            features['incoming_transaction_ratio'] = 0.5
        
        # Add more advanced features
        # These would involve more sophisticated analysis in a real implementation
        
        return features

def get_iota_connection(config_path: str = 'config/iota_connection_config.json') -> IOTAConnection:
    """
    Get an IOTA connection instance.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        IOTAConnection instance
    """
    return IOTAConnection(config_path)

# Test function
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IOTA Connection Test")
    parser.add_argument("--config", type=str, default="config/iota_connection_config.json", help="Path to configuration file")
    parser.add_argument("--address", type=str, help="IOTA address to test with")
    args = parser.parse_args()
    
    # Create connection
    connection = IOTAConnection(args.config)
    
    # Print connection status
    print(f"Connected to IOTA network: {connection.is_connected}")
    
    # Test address data if provided
    if args.address:
        address_data = connection.get_address_data(args.address)
        print(f"Address data: {json.dumps(address_data, indent=2)}")
    
    # Test price data
    price_data = connection.get_token_price_history('IOTA', days=7)
    print(f"Price data: {json.dumps(price_data, indent=2)}")
