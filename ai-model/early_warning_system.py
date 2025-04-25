"""
IntelliLend Early Warning Detection System

This module provides advanced monitoring and risk detection capabilities to identify
potential loan defaults before they occur, allowing for proactive risk management.
"""

import numpy as np
import pandas as pd
import json
import os
import time
import logging
from datetime import datetime, timedelta
import threading
import requests
from web3 import Web3
import tensorflow as tf
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib

# Import local modules
from risk_model import RiskAssessmentModel

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join('logs', 'early_warning.log'))
    ]
)
logger = logging.getLogger('early_warning')

class EarlyWarningSystem:
    """
    Advanced early warning system for detecting potential loan defaults and 
    high-risk situations before they occur.
    """
    
    def __init__(self, config_path='config/early_warning_config.json'):
        """Initialize the early warning system with configuration."""
        self.load_config(config_path)
        self.risk_model = RiskAssessmentModel()
        self.load_models()
        
        # Monitoring state
        self.is_monitoring = False
        self.monitor_thread = None
        self.alert_callbacks = []
        
        # Cache of user states
        self.user_states = {}
        self.historical_alerts = []
        
        # Web3 connection
        if self.config.get('use_web3', True):
            self.setup_web3()
        
        logger.info("Early Warning System initialized")
    
    def load_config(self, config_path):
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
            logger.info(f"Configuration loaded from {config_path}")
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            # Default configuration
            self.config = {
                "monitoring_interval_seconds": 300,  # 5 minutes
                "risk_threshold": 70,                # High risk threshold
                "collateral_warning_threshold": 1.3, # Health factor warning level
                "liquidation_warning_threshold": 1.1, # Urgent liquidation risk
                "market_volatility_alert": 0.15,     # 15% market volatility triggers alert
                "use_web3": True,
                "web3_provider": "http://localhost:8545",
                "lending_pool_address": "0x...",
                "alert_endpoints": {
                    "slack_webhook": "",
                    "email_api": ""
                },
                "model_paths": {
                    "anomaly_detector": "models/anomaly_detector.joblib",
                    "time_series_predictor": "models/time_series_predictor.h5",
                    "risk_trend_model": "models/risk_trend_model.joblib"
                }
            }
    
    def load_models(self):
        """Load the AI models used for detection."""
        try:
            # Anomaly detection model
            anomaly_path = self.config['model_paths']['anomaly_detector']
            if os.path.exists(anomaly_path):
                self.anomaly_detector = joblib.load(anomaly_path)
                logger.info(f"Loaded anomaly detector from {anomaly_path}")
            else:
                logger.warning(f"Anomaly detector model not found at {anomaly_path}, initializing new model")
                self.anomaly_detector = IsolationForest(
                    n_estimators=100, 
                    contamination=0.05,
                    random_state=42
                )
            
            # Time series prediction model
            ts_path = self.config['model_paths']['time_series_predictor']
            if os.path.exists(ts_path):
                self.time_series_model = tf.keras.models.load_model(ts_path)
                logger.info(f"Loaded time series model from {ts_path}")
            else:
                logger.warning(f"Time series model not found at {ts_path}")
                self.time_series_model = None
            
            # Risk trend model
            trend_path = self.config['model_paths']['risk_trend_model']
            if os.path.exists(trend_path):
                self.risk_trend_model = joblib.load(trend_path)
                logger.info(f"Loaded risk trend model from {trend_path}")
            else:
                logger.warning(f"Risk trend model not found at {trend_path}")
                self.risk_trend_model = None
            
            # Feature scaler
            scaler_path = os.path.join(os.path.dirname(anomaly_path), 'feature_scaler.joblib')
            if os.path.exists(scaler_path):
                self.feature_scaler = joblib.load(scaler_path)
                logger.info(f"Loaded feature scaler from {scaler_path}")
            else:
                logger.warning(f"Feature scaler not found at {scaler_path}, initializing new scaler")
                self.feature_scaler = StandardScaler()
            
            self.models_loaded = True
            logger.info("All available models loaded successfully")
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            self.models_loaded = False
    
    def setup_web3(self):
        """Set up Web3 connection for on-chain monitoring."""
        try:
            # Connect to blockchain provider
            self.web3 = Web3(Web3.HTTPProvider(self.config['web3_provider']))
            connected = self.web3.isConnected()
            logger.info(f"Web3 connection: {'Success' if connected else 'Failed'}")
            
            if connected:
                # Set up contract interfaces
                lp_address = self.config['lending_pool_address']
                with open('abis/LendingPool.json', 'r') as f:
                    lp_abi = json.load(f)
                
                self.lending_pool = self.web3.eth.contract(address=lp_address, abi=lp_abi)
                
                # Set up event listeners
                self.setup_event_listeners()
                
                logger.info("Web3 setup completed successfully")
                return True
            return False
        except Exception as e:
            logger.error(f"Error setting up Web3: {e}")
            self.web3 = None
            return False
    
    def setup_event_listeners(self):
        """Set up blockchain event listeners for real-time monitoring."""
        if not hasattr(self, 'web3') or self.web3 is None:
            return
        
        try:
            # Set up filters for events we're interested in
            self.liquidation_filter = self.lending_pool.events.Liquidation.createFilter(fromBlock='latest')
            self.borrow_filter = self.lending_pool.events.Borrow.createFilter(fromBlock='latest')
            self.repay_filter = self.lending_pool.events.Repay.createFilter(fromBlock='latest')
            self.collateral_filter = self.lending_pool.events.CollateralAdded.createFilter(fromBlock='latest')
            
            logger.info("Blockchain event listeners set up successfully")
        except Exception as e:
            logger.error(f"Error setting up event listeners: {e}")
    
    def start_monitoring(self):
        """Start the monitoring system in a separate thread."""
        if self.is_monitoring:
            logger.warning("Monitoring already active, ignoring start request")
            return False
        
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("Monitoring thread started")
        return True
    
    def stop_monitoring(self):
        """Stop the monitoring system."""
        if not self.is_monitoring:
            logger.warning("Monitoring not active, ignoring stop request")
            return False
        
        self.is_monitoring = False
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5.0)
        
        logger.info("Monitoring stopped")
        return True
    
    def _monitoring_loop(self):
        """Main monitoring loop that runs in a separate thread."""
        logger.info("Monitoring loop started")
        
        while self.is_monitoring:
            try:
                # 1. Check blockchain events
                if hasattr(self, 'web3') and self.web3 is not None:
                    self._check_blockchain_events()
                
                # 2. Fetch and analyze user data
                self._analyze_active_loans()
                
                # 3. Check market conditions
                self._check_market_conditions()
                
                # 4. Time-series predictions
                self._run_predictive_analysis()
                
                # 5. Apply anomaly detection
                self._detect_anomalies()
                
                # Wait for next monitoring interval
                interval = self.config.get('monitoring_interval_seconds', 300)
                time.sleep(interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(60)  # Wait and retry
    
    def _check_blockchain_events(self):
        """Check for new relevant blockchain events."""
        try:
            # Process liquidation events
            new_liquidations = self.liquidation_filter.get_new_entries()
            for event in new_liquidations:
                borrower = event.args.borrower
                logger.info(f"Liquidation detected for borrower: {borrower}")
                self._process_liquidation_event(event)
            
            # Process large borrows
            new_borrows = self.borrow_filter.get_new_entries()
            for event in new_borrows:
                borrower = event.args.user
                amount = event.args.amount
                if self._is_large_borrow(amount):
                    logger.info(f"Large borrow detected: {borrower}, amount: {amount}")
                    self._process_large_borrow(event)
            
            # Other events processing would go here
            
        except Exception as e:
            logger.error(f"Error checking blockchain events: {e}")
    
    def _analyze_active_loans(self):
        """Analyze active loans for early warning signs."""
        logger.info("Analyzing active loans")
        
        try:
            # In a real implementation, we would fetch all active loans
            # For simulation, we'll use a cached list
            active_users = self._get_active_users()
            
            for user_address in active_users:
                # Get user data
                user_data = self._get_user_data(user_address)
                
                # Skip if no data
                if not user_data:
                    continue
                
                # Check health factor
                health_factor = user_data.get('health_factor', float('inf'))
                
                if health_factor < self.config['liquidation_warning_threshold']:
                    self._create_alert({
                        'type': 'LIQUIDATION_IMMINENT',
                        'user': user_address,
                        'health_factor': health_factor,
                        'severity': 'CRITICAL',
                        'message': f"User {user_address} at imminent risk of liquidation with health factor {health_factor:.2f}",
                        'timestamp': datetime.now().isoformat()
                    })
                elif health_factor < self.config['collateral_warning_threshold']:
                    self._create_alert({
                        'type': 'LOW_HEALTH_FACTOR',
                        'user': user_address,
                        'health_factor': health_factor,
                        'severity': 'WARNING',
                        'message': f"User {user_address} has low health factor {health_factor:.2f}",
                        'timestamp': datetime.now().isoformat()
                    })
                
                # Check risk score
                risk_score = user_data.get('risk_score', 0)
                if risk_score > self.config['risk_threshold']:
                    self._create_alert({
                        'type': 'HIGH_RISK_SCORE',
                        'user': user_address,
                        'risk_score': risk_score,
                        'severity': 'WARNING',
                        'message': f"User {user_address} has high risk score {risk_score}",
                        'timestamp': datetime.now().isoformat()
                    })
                
                # Update user state for trend analysis
                self._update_user_state(user_address, user_data)
        
        except Exception as e:
            logger.error(f"Error analyzing active loans: {e}")
    
    def _check_market_conditions(self):
        """Monitor market conditions for volatility and other risk factors."""
        logger.info("Checking market conditions")
        
        try:
            # In a real implementation, this would fetch from oracles or APIs
            # For simulation, we'll generate some market data
            
            # Simulate market volatility calculation
            market_volatility = self._get_market_volatility()
            
            if market_volatility > self.config['market_volatility_alert']:
                self._create_alert({
                    'type': 'HIGH_MARKET_VOLATILITY',
                    'volatility': market_volatility,
                    'severity': 'WARNING',
                    'message': f"High market volatility detected: {market_volatility:.2%}",
                    'timestamp': datetime.now().isoformat()
                })
                
                # Find users that might be affected by this volatility
                vulnerable_users = self._find_volatility_vulnerable_users(market_volatility)
                
                for user in vulnerable_users:
                    self._create_alert({
                        'type': 'VOLATILITY_EXPOSURE',
                        'user': user,
                        'volatility': market_volatility,
                        'severity': 'WARNING',
                        'message': f"User {user} has high exposure to current market volatility",
                        'timestamp': datetime.now().isoformat()
                    })
        
        except Exception as e:
            logger.error(f"Error checking market conditions: {e}")
    
    def _run_predictive_analysis(self):
        """Run time-series predictions to forecast potential issues."""
        logger.info("Running predictive analysis")
        
        try:
            # Skip if time series model not loaded
            if self.time_series_model is None:
                logger.warning("Time series model not available, skipping predictive analysis")
                return
            
            # Get users with enough historical data
            users_with_history = self._get_users_with_sufficient_history()
            
            for user_address in users_with_history:
                # Get historical data
                historical_data = self._get_user_historical_data(user_address)
                
                # Skip if not enough data
                if len(historical_data) < 5:  # Need at least 5 data points
                    continue
                
                # Prepare data for model
                X = self._prepare_time_series_data(historical_data)
                
                # Make prediction
                try:
                    predictions = self.time_series_model.predict(X)
                    
                    # Extract predictions for key metrics
                    predicted_health_factor = predictions[0][0]
                    predicted_risk_score = predictions[0][1]
                    
                    # Check if predictions indicate future problems
                    if predicted_health_factor < self.config['liquidation_warning_threshold']:
                        days_to_prediction = 7  # Assuming 7-day forecast
                        prediction_date = datetime.now() + timedelta(days=days_to_prediction)
                        
                        self._create_alert({
                            'type': 'PREDICTED_LIQUIDATION',
                            'user': user_address,
                            'predicted_health_factor': float(predicted_health_factor),
                            'prediction_date': prediction_date.isoformat(),
                            'severity': 'WARNING',
                            'message': f"User {user_address} predicted to reach liquidation threshold in {days_to_prediction} days",
                            'timestamp': datetime.now().isoformat()
                        })
                except Exception as e:
                    logger.error(f"Error making prediction for user {user_address}: {e}")
        
        except Exception as e:
            logger.error(f"Error in predictive analysis: {e}")
    
    def _detect_anomalies(self):
        """Detect anomalous patterns in user behavior."""
        logger.info("Running anomaly detection")
        
        try:
            # Get all active users with state
            users = list(self.user_states.keys())
            
            if not users:
                logger.info("No user states to analyze")
                return
            
            # Extract features for all users
            features = []
            user_map = []
            
            for user in users:
                user_features = self._extract_anomaly_features(user)
                if user_features:
                    features.append(user_features)
                    user_map.append(user)
            
            if not features:
                logger.info("No features extracted for anomaly detection")
                return
            
            # Convert to numpy array
            features_array = np.array(features)
            
            # Scale features
            try:
                features_scaled = self.feature_scaler.transform(features_array)
            except:
                # If scaler not fitted, fit it
                features_scaled = self.feature_scaler.fit_transform(features_array)
            
            # Detect anomalies
            try:
                # If model not fitted, fit it
                if not hasattr(self.anomaly_detector, 'offset_'):
                    self.anomaly_detector.fit(features_scaled)
                
                # Predict anomalies (-1 for anomalies, 1 for normal)
                predictions = self.anomaly_detector.predict(features_scaled)
                anomaly_scores = self.anomaly_detector.decision_function(features_scaled)
                
                # Process anomalies
                for i, prediction in enumerate(predictions):
                    if prediction == -1:  # Anomaly detected
                        user = user_map[i]
                        score = anomaly_scores[i]
                        
                        self._create_alert({
                            'type': 'BEHAVIOR_ANOMALY',
                            'user': user,
                            'anomaly_score': float(score),
                            'severity': 'WARNING',
                            'message': f"Anomalous behavior detected for user {user}",
                            'timestamp': datetime.now().isoformat()
                        })
            except Exception as e:
                logger.error(f"Error in anomaly detection prediction: {e}")
        
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
    
    def _extract_anomaly_features(self, user_address):
        """Extract features for anomaly detection from user state."""
        state = self.user_states.get(user_address)
        if not state or 'history' not in state or len(state['history']) < 2:
            return None
        
        try:
            # Get latest and previous state
            latest = state['history'][-1]
            previous = state['history'][-2]
            
            # Calculate volatility and rate metrics
            health_volatility = abs(latest['health_factor'] - previous['health_factor']) / max(previous['health_factor'], 0.01)
            collateral_change_rate = abs(latest['collateral'] - previous['collateral']) / max(previous['collateral'], 0.01)
            borrow_change_rate = abs(latest['borrows'] - previous['borrows']) / max(previous['borrows'], 0.01)
            risk_score_change = abs(latest['risk_score'] - previous['risk_score'])
            
            # Calculate time-based metrics
            time_since_last_tx = (datetime.now() - datetime.fromisoformat(latest['timestamp'])).total_seconds() / 86400  # days
            
            # Create feature vector
            features = [
                latest['health_factor'],
                latest['collateral'],
                latest['borrows'],
                latest['risk_score'],
                health_volatility,
                collateral_change_rate,
                borrow_change_rate,
                risk_score_change,
                time_since_last_tx
            ]
            
            return features
        except Exception as e:
            logger.error(f"Error extracting anomaly features for {user_address}: {e}")
            return None
    
    def _is_large_borrow(self, amount):
        """Check if a borrow amount is considered large."""
        # Convert to float if needed
        if isinstance(amount, str) or isinstance(amount, bytes):
            amount = float(amount)
        
        # In a real implementation, this would compare against platform averages
        # For simulation, we'll use a fixed threshold
        threshold = self.config.get('large_borrow_threshold', 1000)
        return amount > threshold
    
    def _process_liquidation_event(self, event):
        """Process a liquidation event for insights."""
        borrower = event.args.borrower
        liquidator = event.args.liquidator
        repay_amount = event.args.repayAmount
        collateral_amount = event.args.collateralAmount
        
        # Record the liquidation
        liquidation_record = {
            'borrower': borrower,
            'liquidator': liquidator,
            'repay_amount': repay_amount,
            'collateral_amount': collateral_amount,
            'transaction_hash': event.transactionHash.hex(),
            'block_number': event.blockNumber,
            'timestamp': datetime.now().isoformat()
        }
        
        # Store for analysis
        if not hasattr(self, 'liquidation_history'):
            self.liquidation_history = []
        
        self.liquidation_history.append(liquidation_record)
        
        # Create liquidation alert
        self._create_alert({
            'type': 'LIQUIDATION_OCCURRED',
            'user': borrower,
            'liquidator': liquidator,
            'repay_amount': float(repay_amount),
            'collateral_amount': float(collateral_amount),
            'severity': 'CRITICAL',
            'message': f"Liquidation occurred for borrower {borrower}",
            'tx_hash': event.transactionHash.hex(),
            'timestamp': datetime.now().isoformat()
        })
        
        # Analyze similar users who might be at risk
        similar_users = self._find_similar_users(borrower)
        for user in similar_users:
            self._create_alert({
                'type': 'SIMILAR_USER_RISK',
                'user': user,
                'reference_liquidation': borrower,
                'severity': 'WARNING',
                'message': f"User {user} has similar profile to recently liquidated user {borrower}",
                'timestamp': datetime.now().isoformat()
            })
    
    def _process_large_borrow(self, event):
        """Process a large borrow event."""
        borrower = event.args.user
        amount = event.args.amount
        
        # Record the borrow
        borrow_record = {
            'borrower': borrower,
            'amount': amount,
            'transaction_hash': event.transactionHash.hex(),
            'block_number': event.blockNumber,
            'timestamp': datetime.now().isoformat()
        }
        
        # Create alert for large borrow
        self._create_alert({
            'type': 'LARGE_BORROW',
            'user': borrower,
            'amount': float(amount),
            'severity': 'INFO',
            'message': f"Large borrow of {amount} by user {borrower}",
            'tx_hash': event.transactionHash.hex(),
            'timestamp': datetime.now().isoformat()
        })
        
        # Check user risk score after borrow
        user_data = self._get_user_data(borrower)
        if user_data and user_data.get('risk_score', 0) > self.config['risk_threshold']:
            self._create_alert({
                'type': 'HIGH_RISK_BORROW',
                'user': borrower,
                'amount': float(amount),
                'risk_score': user_data['risk_score'],
                'severity': 'WARNING',
                'message': f"High-risk user {borrower} took large borrow of {amount}",
                'timestamp': datetime.now().isoformat()
            })
    
    def _get_active_users(self):
        """Get list of active users in the system."""
        # In a real implementation, this would query the blockchain
        # For simulation, we'll return a list of known users
        return list(self.user_states.keys())
    
    def _get_user_data(self, user_address):
        """Get current user data."""
        # In a real implementation, this would query the blockchain
        # For simulation, we'll use the cached state if available
        if user_address in self.user_states:
            # Use the latest state from history
            state = self.user_states[user_address]
            if 'history' in state and state['history']:
                return state['history'][-1]
        
        # If no state, try to fetch from blockchain
        if hasattr(self, 'web3') and self.web3 is not None and hasattr(self, 'lending_pool'):
            try:
                # Fetch on-chain data
                deposits = self.lending_pool.functions.deposits(user_address).call()
                borrows = self.lending_pool.functions.borrows(user_address).call()
                collaterals = self.lending_pool.functions.collaterals(user_address).call()
                risk_score = self.lending_pool.functions.riskScores(user_address).call()
                
                # Get health factor
                health_factor = 999  # Default to high value if no borrows
                if borrows > 0:
                    health_factor = self.lending_pool.functions.getHealthFactor(user_address).call() / 100  # Convert from contract scale
                
                return {
                    'user': user_address,
                    'deposits': float(deposits),
                    'borrows': float(borrows),
                    'collateral': float(collaterals),
                    'risk_score': float(risk_score),
                    'health_factor': float(health_factor),
                    'timestamp': datetime.now().isoformat()
                }
            except Exception as e:
                logger.error(f"Error fetching on-chain data for {user_address}: {e}")
                return None
        
        return None
    
    def _update_user_state(self, user_address, user_data):
        """Update the cached state for a user."""
        if user_address not in self.user_states:
            self.user_states[user_address] = {
                'history': []
            }
        
        # Add to history
        self.user_states[user_address]['history'].append(user_data)
        
        # Keep only last 30 days of history
        max_history = 30
        if len(self.user_states[user_address]['history']) > max_history:
            self.user_states[user_address]['history'] = self.user_states[user_address]['history'][-max_history:]
    
    def _get_market_volatility(self):
        """Get current market volatility."""
        # In a real implementation, this would fetch from market APIs or oracles
        # For simulation, we'll generate a random value with some persistence
        
        # If no previous value, generate a base
        if not hasattr(self, 'last_volatility'):
            self.last_volatility = 0.05 + 0.05 * np.random.random()
        
        # Add some random walk behavior with mean reversion
        volatility_change = 0.005 * np.random.randn() - 0.001 * (self.last_volatility - 0.05)
        new_volatility = max(0.01, min(0.3, self.last_volatility + volatility_change))
        
        # Update last value
        self.last_volatility = new_volatility
        
        return new_volatility
    
    def _find_volatility_vulnerable_users(self, volatility):
        """Find users that might be vulnerable to current market volatility."""
        vulnerable_users = []
        
        for user, state in self.user_states.items():
            if 'history' not in state or not state['history']:
                continue
            
            latest = state['history'][-1]
            
            # Check if user has high borrowing relative to collateral
            if 'health_factor' in latest and latest['health_factor'] < 1.5:
                vulnerable_users.append(user)
            
            # Additional criteria could be added here
        
        return vulnerable_users
    
    def _get_users_with_sufficient_history(self):
        """Get users with enough historical data for time-series prediction."""
        users = []
        
        for user, state in self.user_states.items():
            if 'history' in state and len(state['history']) >= 5:
                users.append(user)
        
        return users
    
    def _get_user_historical_data(self, user_address):
        """Get historical data for a user."""
        if user_address in self.user_states and 'history' in self.user_states[user_address]:
            return self.user_states[user_address]['history']
        return []
    
    def _prepare_time_series_data(self, historical_data):
        """Prepare historical data for time-series prediction."""
        # Extract relevant features
        X = []
        for i in range(len(historical_data) - 4, len(historical_data)):
            entry = historical_data[i]
            features = [
                entry.get('health_factor', 999),
                entry.get('risk_score', 0),
                entry.get('borrows', 0),
                entry.get('collateral', 0)
            ]
            X.append(features)
        
        # Reshape for LSTM or other models: [samples, time steps, features]
        return np.array([X], dtype=np.float32)
    
    def _find_similar_users(self, reference_user):
        """Find users with similar profiles to a reference user."""
        similar_users = []
        
        if reference_user not in self.user_states:
            return similar_users
        
        ref_state = self.user_states[reference_user]
        if 'history' not in ref_state or not ref_state['history']:
            return similar_users
        
        ref_data = ref_state['history'][-1]
        
        # Compare with other users
        for user, state in self.user_states.items():
            if user == reference_user or 'history' not in state or not state['history']:
                continue
            
            user_data = state['history'][-1]
            
            # Calculate similarity score (lower is more similar)
            similarity = 0
            
            # Compare key metrics
            if 'health_factor' in ref_data and 'health_factor' in user_data:
                similarity += abs(ref_data['health_factor'] - user_data['health_factor']) / max(ref_data['health_factor'], 0.1)
            
            if 'risk_score' in ref_data and 'risk_score' in user_data:
                similarity += abs(ref_data['risk_score'] - user_data['risk_score']) / 100
            
            if 'borrows' in ref_data and 'borrows' in user_data and 'collateral' in ref_data and 'collateral' in user_data:
                # Compare borrow to collateral ratio
                ref_ratio = ref_data['borrows'] / max(ref_data['collateral'], 0.01)
                user_ratio = user_data['borrows'] / max(user_data['collateral'], 0.01)
                similarity += abs(ref_ratio - user_ratio) / max(ref_ratio, 0.01)
            
            # If similarity is below threshold, consider them similar
            similarity_threshold = 0.2
            if similarity < similarity_threshold:
                similar_users.append(user)
        
        return similar_users
    
    def _create_alert(self, alert_data):
        """Create and process an alert."""
        # Add to historical alerts
        self.historical_alerts.append(alert_data)
        
        # Keep only last 1000 alerts
        if len(self.historical_alerts) > 1000:
            self.historical_alerts = self.historical_alerts[-1000:]
        
        # Log alert
        severity = alert_data.get('severity', 'INFO')
        message = alert_data.get('message', 'No message')
        
        if severity == 'CRITICAL':
            logger.critical(message)
        elif severity == 'WARNING':
            logger.warning(message)
        else:
            logger.info(message)
        
        # Call alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert_data)
            except Exception as e:
                logger.error(f"Error in alert callback: {e}")
        
        # Send external notifications if configured
        self._send_alert_notifications(alert_data)
    
    def _send_alert_notifications(self, alert_data):
        """Send alert notifications to external systems."""
        # Only send external notifications for high severity alerts
        severity = alert_data.get('severity', 'INFO')
        if severity not in ['WARNING', 'CRITICAL']:
            return
        
        # Slack webhook
        slack_webhook = self.config.get('alert_endpoints', {}).get('slack_webhook')
        if slack_webhook:
            try:
                self._send_slack_notification(slack_webhook, alert_data)
            except Exception as e:
                logger.error(f"Error sending Slack notification: {e}")
        
        # Email API
        email_api = self.config.get('alert_endpoints', {}).get('email_api')
        if email_api:
            try:
                self._send_email_notification(email_api, alert_data)
            except Exception as e:
                logger.error(f"Error sending email notification: {e}")
    
    def _send_slack_notification(self, webhook_url, alert_data):
        """Send notification to Slack."""
        # Construct Slack message
        message = {
            "text": f"*{alert_data.get('severity', 'ALERT')}*: {alert_data.get('message', 'No message')}",
            "attachments": [
                {
                    "color": "#ff0000" if alert_data.get('severity') == 'CRITICAL' else "#ffaa00",
                    "fields": [
                        {"title": "Type", "value": alert_data.get('type', 'UNKNOWN'), "short": True},
                        {"title": "Time", "value": alert_data.get('timestamp', ''), "short": True}
                    ]
                }
            ]
        }
        
        # Add user field if present
        if 'user' in alert_data:
            message["attachments"][0]["fields"].append({
                "title": "User",
                "value": alert_data['user'],
                "short": True
            })
        
        # Add additional fields based on alert type
        alert_type = alert_data.get('type', '')
        
        if 'health_factor' in alert_data:
            message["attachments"][0]["fields"].append({
                "title": "Health Factor",
                "value": f"{alert_data['health_factor']:.2f}",
                "short": True
            })
        
        if 'risk_score' in alert_data:
            message["attachments"][0]["fields"].append({
                "title": "Risk Score",
                "value": f"{alert_data['risk_score']}",
                "short": True
            })
        
        # Send to Slack
        requests.post(webhook_url, json=message)
    
    def _send_email_notification(self, api_url, alert_data):
        """Send notification via email API."""
        # Construct email
        email_data = {
            "subject": f"IntelliLend Alert: {alert_data.get('type', 'ALERT')}",
            "body": alert_data.get('message', 'No message'),
            "severity": alert_data.get('severity', 'INFO'),
            "timestamp": alert_data.get('timestamp', ''),
            "data": alert_data
        }
        
        # Send to email API
        requests.post(api_url, json=email_data)
    
    def register_alert_callback(self, callback):
        """Register a callback function to be called when alerts are created."""
        if callable(callback):
            self.alert_callbacks.append(callback)
            return True
        return False
    
    def get_recent_alerts(self, count=10, severity=None, alert_type=None, user=None):
        """Get recent alerts, optionally filtered."""
        # Start with all alerts
        alerts = self.historical_alerts
        
        # Apply filters
        if severity:
            alerts = [a for a in alerts if a.get('severity') == severity]
        
        if alert_type:
            alerts = [a for a in alerts if a.get('type') == alert_type]
        
        if user:
            alerts = [a for a in alerts if a.get('user') == user]
        
        # Sort by timestamp (newest first)
        alerts = sorted(alerts, key=lambda a: a.get('timestamp', ''), reverse=True)
        
        # Return requested number
        return alerts[:count]
    
    def get_user_risk_summary(self, user_address):
        """Get a summary of risk factors for a user."""
        # Get user data
        user_data = self._get_user_data(user_address)
        if not user_data:
            return None
        
        # Get recent alerts for this user
        user_alerts = self.get_recent_alerts(count=10, user=user_address)
        
        # Get historical data
        historical_data = self._get_user_historical_data(user_address)
        
        # Calculate trend in health factor and risk score
        health_trend = 'stable'
        risk_trend = 'stable'
        
        if len(historical_data) >= 2:
            latest = historical_data[-1]
            previous = historical_data[-2]
            
            if 'health_factor' in latest and 'health_factor' in previous:
                diff = latest['health_factor'] - previous['health_factor']
                if diff < -0.1:
                    health_trend = 'declining'
                elif diff > 0.1:
                    health_trend = 'improving'
            
            if 'risk_score' in latest and 'risk_score' in previous:
                diff = latest['risk_score'] - previous['risk_score']
                if diff > 5:
                    risk_trend = 'increasing'
                elif diff < -5:
                    risk_trend = 'decreasing'
        
        # Build summary
        summary = {
            'user': user_address,
            'current_state': user_data,
            'health_trend': health_trend,
            'risk_trend': risk_trend,
            'recent_alerts': user_alerts,
            'alert_count': len(user_alerts)
        }
        
        # Make risk prediction if model available
        if self.time_series_model and len(historical_data) >= 5:
            try:
                X = self._prepare_time_series_data(historical_data)
                predictions = self.time_series_model.predict(X)
                
                summary['predictions'] = {
                    'health_factor': float(predictions[0][0]),
                    'risk_score': float(predictions[0][1]),
                    'horizon_days': 7
                }
            except:
                pass
        
        return summary
    
    def get_system_health_overview(self):
        """Get overview of system health metrics."""
        # Count users by risk level
        risk_counts = {
            'low': 0,
            'medium': 0,
            'high': 0,
            'critical': 0
        }
        
        # Count users by health factor
        health_counts = {
            'healthy': 0,
            'warning': 0,
            'danger': 0
        }
        
        total_users = 0
        total_borrows = 0
        total_collateral = 0
        
        for user, state in self.user_states.items():
            if 'history' not in state or not state['history']:
                continue
            
            total_users += 1
            latest = state['history'][-1]
            
            # Add to borrow and collateral totals
            total_borrows += latest.get('borrows', 0)
            total_collateral += latest.get('collateral', 0)
            
            # Count by risk level
            risk_score = latest.get('risk_score', 0)
            if risk_score < 30:
                risk_counts['low'] += 1
            elif risk_score < 50:
                risk_counts['medium'] += 1
            elif risk_score < 70:
                risk_counts['high'] += 1
            else:
                risk_counts['critical'] += 1
            
            # Count by health factor
            health_factor = latest.get('health_factor', 999)
            if health_factor > 1.5:
                health_counts['healthy'] += 1
            elif health_factor > 1.1:
                health_counts['warning'] += 1
            else:
                health_counts['danger'] += 1
        
        # Count recent alerts by type
        alert_counts = {}
        recent_alerts = self.get_recent_alerts(count=100)
        
        for alert in recent_alerts:
            alert_type = alert.get('type', 'UNKNOWN')
            if alert_type not in alert_counts:
                alert_counts[alert_type] = 0
            alert_counts[alert_type] += 1
        
        # Get most recent market volatility
        market_volatility = self._get_market_volatility()
        
        # Build overview
        overview = {
            'timestamp': datetime.now().isoformat(),
            'active_users': total_users,
            'total_borrows': total_borrows,
            'total_collateral': total_collateral,
            'collateralization_ratio': total_collateral / max(total_borrows, 0.01),
            'risk_distribution': risk_counts,
            'health_distribution': health_counts,
            'market_volatility': market_volatility,
            'recent_alert_counts': alert_counts,
            'monitoring_active': self.is_monitoring
        }
        
        return overview

# Example usage
if __name__ == "__main__":
    # Create data directories if they don't exist
    os.makedirs('logs', exist_ok=True)
    os.makedirs('config', exist_ok=True)
    
    # Create warning system
    warning_system = EarlyWarningSystem()
    
    # Start monitoring
    warning_system.start_monitoring()
    
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        warning_system.stop_monitoring()
        print("Monitoring stopped")
