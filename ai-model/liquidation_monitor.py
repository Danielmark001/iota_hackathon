#!/usr/bin/env python
"""
IntelliLend Liquidation Monitor

This service uses AI to monitor user positions and predict potential liquidations
before they occur, sending warnings to users and suggesting preventive actions.
"""

import os
import json
import time
import logging
import argparse
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from web3 import Web3
import tensorflow as tf
from eth_account import Account
from risk_model import RiskAssessmentModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("liquidation_monitor.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("liquidation_monitor")

class LiquidationMonitor:
    """
    AI-powered service to monitor user positions and predict potential liquidations.
    Uses machine learning to forecast price movements and user behavior to identify at-risk positions.
    """
    
    def __init__(self, config_path='config/liquidation_monitor.json'):
        """Initialize the liquidation monitor with configuration."""
        logger.info("Initializing Liquidation Monitor")
        
        # Load configuration
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        # Connect to blockchain
        self.w3 = Web3(Web3.HTTPProvider(self.config['rpc_url']))
        logger.info(f"Connected to network: {self.w3.isConnected()}")
        
        # Load contract ABIs
        with open(self.config['lending_pool_abi_path'], 'r') as f:
            lending_pool_abi = json.load(f)
        
        with open(self.config['price_oracle_abi_path'], 'r') as f:
            price_oracle_abi = json.load(f)
        
        # Initialize contracts
        self.lending_pool = self.w3.eth.contract(
            address=self.config['lending_pool_address'],
            abi=lending_pool_abi
        )
        
        self.price_oracle = self.w3.eth.contract(
            address=self.config['price_oracle_address'],
            abi=price_oracle_abi
        )
        
        # Initialize API client for notifications
        self.api_url = self.config['api_url']
        self.api_key = self.config['api_key']
        
        # Initialize risk model for predictions
        self.risk_model = RiskAssessmentModel()
        if os.path.exists(self.config['model_path']):
            self.risk_model.load_models(self.config['model_path'])
            logger.info("Risk model loaded successfully")
        else:
            logger.warning("Model path not found, using default model")
        
        # Track monitored positions
        self.monitored_positions = {}
        self.warning_history = {}
        self.last_full_scan = 0
        
        # Set up health factor thresholds for warnings
        self.warning_thresholds = {
            'severe': 1.05,    # Very close to liquidation
            'high': 1.1,       # High risk
            'medium': 1.2,     # Medium risk
            'low': 1.5         # Low risk but worth monitoring
        }
        
        # Market volatility tracking
        self.market_volatility = {
            'current': 0.0,
            'history': [],
            'forecast': 0.0
        }
        
        logger.info("Liquidation Monitor initialized")
    
    def start_monitoring(self):
        """Start the monitoring service."""
        logger.info("Starting monitoring service")
        
        try:
            # Initial scan
            self.full_scan()
            
            # Main monitoring loop
            while True:
                try:
                    # Check if it's time for a full scan
                    current_time = time.time()
                    if current_time - self.last_full_scan > self.config['full_scan_interval']:
                        self.full_scan()
                        self.last_full_scan = current_time
                    else:
                        # Update market conditions
                        self.update_market_conditions()
                        
                        # Check high-risk positions more frequently
                        self.check_high_risk_positions()
                    
                    # Check for liquidation events
                    self.process_liquidation_events()
                    
                    # Sleep before next check
                    time.sleep(self.config['check_interval'])
                    
                except Exception as e:
                    logger.error(f"Error in monitoring loop: {str(e)}")
                    time.sleep(30)  # Sleep longer on error
        
        except KeyboardInterrupt:
            logger.info("Monitoring service stopped by user")
        except Exception as e:
            logger.error(f"Critical error in monitoring service: {str(e)}")
            raise
    
    def full_scan(self):
        """Perform a full scan of all positions in the lending pool."""
        logger.info("Starting full scan of all positions")
        
        # Get total users count from contract
        try:
            user_count = self.lending_pool.functions.getUserCount().call()
            logger.info(f"Found {user_count} users in lending pool")
            
            # Scan users in batches to avoid timeout
            batch_size = self.config.get('batch_size', 100)
            for i in range(0, user_count, batch_size):
                end = min(i + batch_size, user_count)
                logger.info(f"Scanning users {i} to {end}")
                
                users = self.lending_pool.functions.getUserBatch(i, end).call()
                for user in users:
                    if user != '0x0000000000000000000000000000000000000000':
                        self.check_user_position(user)
                
                # Short delay between batches
                time.sleep(0.5)
            
            self.last_full_scan = time.time()
            logger.info("Full scan completed")
            
            # Update market volatility model after full scan
            self.update_volatility_model()
            
        except Exception as e:
            logger.error(f"Error during full scan: {str(e)}")
    
    def check_high_risk_positions(self):
        """Check positions that were previously identified as high risk."""
        high_risk_users = [
            user for user, data in self.monitored_positions.items()
            if data['health_factor'] < self.warning_thresholds['high']
        ]
        
        logger.info(f"Checking {len(high_risk_users)} high-risk positions")
        
        for user in high_risk_users:
            self.check_user_position(user)
    
    def check_user_position(self, user_address):
        """Check a specific user's position for liquidation risk."""
        try:
            # Get user's collateral and borrow data
            collateral = self.lending_pool.functions.collaterals(user_address).call()
            borrows = self.lending_pool.functions.borrows(user_address).call()
            
            if borrows == 0:
                # No active loans, no liquidation risk
                if user_address in self.monitored_positions:
                    logger.info(f"User {user_address} has repaid all loans, removing from monitoring")
                    del self.monitored_positions[user_address]
                return
            
            # Get current health factor
            health_factor = self.lending_pool.functions.getHealthFactor(user_address).call() / 100  # Convert from percentage
            
            # Get user's risk score
            risk_score = self.lending_pool.functions.riskScores(user_address).call()
            
            # Store or update position data
            is_new = user_address not in self.monitored_positions
            
            if is_new:
                self.monitored_positions[user_address] = {
                    'collateral': collateral,
                    'borrows': borrows,
                    'health_factor': health_factor,
                    'risk_score': risk_score,
                    'last_checked': time.time(),
                    'warnings_sent': 0,
                    'predicted_liquidation_time': None,
                    'suggested_actions': []
                }
            else:
                # Update existing data
                previous = self.monitored_positions[user_address]
                self.monitored_positions[user_address] = {
                    'collateral': collateral,
                    'borrows': borrows,
                    'health_factor': health_factor,
                    'risk_score': risk_score,
                    'health_factor_change': health_factor - previous['health_factor'],
                    'last_checked': time.time(),
                    'warnings_sent': previous['warnings_sent'],
                    'predicted_liquidation_time': previous['predicted_liquidation_time'],
                    'suggested_actions': previous['suggested_actions']
                }
            
            # Check health factor against thresholds
            self.evaluate_health_factor(user_address)
            
            # Predict future health factor and potential liquidation
            if borrows > 0 and collateral > 0:
                self.predict_liquidation_risk(user_address)
            
        except Exception as e:
            logger.error(f"Error checking position for {user_address}: {str(e)}")
    
    def evaluate_health_factor(self, user_address):
        """Evaluate a user's health factor against warning thresholds."""
        position = self.monitored_positions[user_address]
        health_factor = position['health_factor']
        
        # Determine warning level based on health factor
        warning_level = None
        if health_factor < self.warning_thresholds['severe']:
            warning_level = 'severe'
        elif health_factor < self.warning_thresholds['high']:
            warning_level = 'high'
        elif health_factor < self.warning_thresholds['medium']:
            warning_level = 'medium'
        elif health_factor < self.warning_thresholds['low']:
            warning_level = 'low'
        
        # If position needs warning, check if we should send it
        if warning_level:
            # Check if we've sent a warning recently for this level
            should_send = False
            current_time = time.time()
            
            if user_address not in self.warning_history:
                self.warning_history[user_address] = {}
                should_send = True
            elif warning_level not in self.warning_history[user_address]:
                should_send = True
            else:
                last_sent = self.warning_history[user_address][warning_level]
                cooldown = self.config['warning_cooldown'][warning_level]
                if current_time - last_sent > cooldown:
                    should_send = True
            
            if should_send:
                self.send_warning(user_address, warning_level)
                self.warning_history[user_address][warning_level] = current_time
                position['warnings_sent'] += 1
    
    def predict_liquidation_risk(self, user_address):
        """Use the AI model to predict liquidation risk for a user."""
        position = self.monitored_positions[user_address]
        
        try:
            # Prepare data for prediction
            user_data = {
                'address': user_address,
                'collateral': position['collateral'],
                'borrows': position['borrows'],
                'health_factor': position['health_factor'],
                'risk_score': position['risk_score'],
                'market_volatility': self.market_volatility['current']
            }
            
            # Get historical data if available
            if 'health_factor_change' in position:
                user_data['health_factor_change'] = position['health_factor_change']
            
            # Convert to DataFrame for model
            df = pd.DataFrame([user_data])
            
            # Make prediction
            prediction = self.predict_health_factor_trajectory(df)
            
            # Update position data with prediction
            position['predicted_health_factor_24h'] = prediction['health_factor_24h']
            position['predicted_health_factor_72h'] = prediction['health_factor_72h']
            position['liquidation_probability'] = prediction['liquidation_probability']
            
            # Calculate time to liquidation if trending downward
            if 'health_factor_change' in position and position['health_factor_change'] < 0:
                # Simple linear projection
                if position['health_factor'] > 1.0:
                    time_to_liquidation = (position['health_factor'] - 1.0) / abs(position['health_factor_change']) * 3600  # Hours to seconds
                    liquidation_time = time.time() + time_to_liquidation
                    position['predicted_liquidation_time'] = datetime.fromtimestamp(liquidation_time).isoformat()
            
            # Generate suggested actions
            position['suggested_actions'] = self.generate_suggested_actions(user_address, prediction)
            
            logger.info(f"Predicted liquidation risk for {user_address}: {prediction['liquidation_probability']:.2%}")
            
        except Exception as e:
            logger.error(f"Error predicting liquidation risk for {user_address}: {str(e)}")
    
    def predict_health_factor_trajectory(self, user_data):
        """
        Predict the trajectory of a user's health factor over time.
        
        Args:
            user_data: DataFrame with user position data
            
        Returns:
            dict: Prediction results including future health factors and liquidation probability
        """
        try:
            # In a real implementation, this would use the trained ML model
            # For this demo, we'll use a simple heuristic approach
            
            current_health = user_data['health_factor'].values[0]
            health_change = user_data.get('health_factor_change', pd.Series([0])).values[0]
            market_volatility = user_data['market_volatility'].values[0]
            
            # Adjust for market volatility
            adjusted_change = health_change * (1 + market_volatility)
            
            # Project health factor
            health_24h = max(0.1, current_health + (adjusted_change * 24))
            health_72h = max(0.1, current_health + (adjusted_change * 72))
            
            # Calculate liquidation probability
            if current_health < 1.05:
                liquidation_probability = 0.95  # Very high risk
            elif current_health < 1.1:
                liquidation_probability = 0.7   # High risk
            elif current_health < 1.2:
                liquidation_probability = 0.4   # Medium risk
            elif current_health < 1.5:
                liquidation_probability = 0.1   # Low risk
            else:
                liquidation_probability = 0.01  # Very low risk
                
            # Adjust for trend
            if health_change < 0:
                liquidation_probability = min(0.99, liquidation_probability * (1 + abs(health_change) * 10))
            else:
                liquidation_probability = max(0.001, liquidation_probability * (1 - health_change * 5))
                
            # Adjust for market volatility
            liquidation_probability = min(0.99, liquidation_probability * (1 + market_volatility))
            
            return {
                'health_factor_24h': health_24h,
                'health_factor_72h': health_72h,
                'liquidation_probability': liquidation_probability
            }
            
        except Exception as e:
            logger.error(f"Error in health factor prediction: {str(e)}")
            # Return a default prediction
            return {
                'health_factor_24h': current_health,
                'health_factor_72h': current_health,
                'liquidation_probability': 0.5 if current_health < 1.5 else 0.1
            }
    
    def generate_suggested_actions(self, user_address, prediction):
        """Generate suggested actions to prevent liquidation."""
        position = self.monitored_positions[user_address]
        health_factor = position['health_factor']
        liquidation_probability = prediction['liquidation_probability']
        
        suggestions = []
        
        # Generate personalized suggestions based on position
        if liquidation_probability > 0.5:
            # High risk suggestions
            repay_amount = position['borrows'] * 0.2  # Suggest repaying 20% of loan
            suggestions.append({
                'action': 'repay',
                'description': f'Repay at least {repay_amount:.2f} to improve your health factor',
                'urgency': 'high',
                'impact': 'high',
                'amount': repay_amount
            })
            
            add_collateral = position['borrows'] * 0.3  # 30% of current borrow value
            suggestions.append({
                'action': 'add_collateral',
                'description': f'Add at least {add_collateral:.2f} worth of collateral',
                'urgency': 'high',
                'impact': 'high',
                'amount': add_collateral
            })
        
        elif liquidation_probability > 0.2:
            # Medium risk suggestions
            repay_amount = position['borrows'] * 0.1  # Suggest repaying 10% of loan
            suggestions.append({
                'action': 'repay',
                'description': f'Consider repaying {repay_amount:.2f} to improve your position',
                'urgency': 'medium',
                'impact': 'medium',
                'amount': repay_amount
            })
            
            add_collateral = position['borrows'] * 0.15  # 15% of current borrow value
            suggestions.append({
                'action': 'add_collateral',
                'description': f'Consider adding {add_collateral:.2f} worth of collateral',
                'urgency': 'medium',
                'impact': 'medium',
                'amount': add_collateral
            })
        
        else:
            # Low risk suggestions
            if health_factor < 1.5:
                add_collateral = position['borrows'] * 0.05  # 5% of current borrow value
                suggestions.append({
                    'action': 'add_collateral',
                    'description': f'For extra safety, consider adding {add_collateral:.2f} worth of collateral',
                    'urgency': 'low',
                    'impact': 'medium',
                    'amount': add_collateral
                })
        
        # Additional suggestions
        if position['risk_score'] > 60:
            suggestions.append({
                'action': 'verify_identity',
                'description': 'Complete identity verification to reduce your risk score and improve terms',
                'urgency': 'medium',
                'impact': 'medium'
            })
        
        if self.market_volatility['forecast'] > 0.2:
            suggestions.append({
                'action': 'market_warning',
                'description': 'Market volatility is forecast to increase. Consider reducing exposure',
                'urgency': 'medium',
                'impact': 'high'
            })
        
        return suggestions
    
    def send_warning(self, user_address, warning_level):
        """Send a liquidation warning to a user."""
        position = self.monitored_positions[user_address]
        
        # Create warning message
        warning = {
            'user_address': user_address,
            'warning_level': warning_level,
            'health_factor': position['health_factor'],
            'timestamp': datetime.now().isoformat(),
            'message': self.create_warning_message(user_address, warning_level),
            'suggested_actions': position['suggested_actions']
        }
        
        # Add prediction info if available
        if 'predicted_liquidation_time' in position and position['predicted_liquidation_time']:
            warning['predicted_liquidation_time'] = position['predicted_liquidation_time']
        
        if 'liquidation_probability' in position:
            warning['liquidation_probability'] = position['liquidation_probability']
        
        # Send warning via API
        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            }
            
            response = requests.post(
                f"{self.api_url}/api/notifications/liquidation-warning",
                json=warning,
                headers=headers
            )
            
            if response.status_code == 200:
                logger.info(f"Warning sent to {user_address} with level {warning_level}")
            else:
                logger.error(f"Failed to send warning: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"Error sending warning: {str(e)}")
    
    def create_warning_message(self, user_address, warning_level):
        """Create a personalized warning message based on the risk level."""
        position = self.monitored_positions[user_address]
        
        if warning_level == 'severe':
            return (
                f"URGENT LIQUIDATION WARNING: Your position is at critical risk with a health factor of {position['health_factor']:.2f}. "
                "Immediate action is required to avoid liquidation. Please repay part of your loan or add more collateral now."
            )
        
        elif warning_level == 'high':
            return (
                f"HIGH RISK ALERT: Your position health factor is {position['health_factor']:.2f}, which puts you at high risk of liquidation "
                "if market conditions change. We strongly recommend taking action to improve your position as soon as possible."
            )
        
        elif warning_level == 'medium':
            return (
                f"Liquidation Risk Warning: Your health factor is {position['health_factor']:.2f}. "
                "This is approaching risky levels. Consider improving your position by adding collateral or repaying part of your loan."
            )
        
        else:  # 'low'
            return (
                f"Position Monitor Alert: Your health factor is {position['health_factor']:.2f}. "
                "While not immediately at risk, your position could become vulnerable if market conditions change. "
                "Consider reviewing your position strategy."
            )
    
    def process_liquidation_events(self):
        """Process liquidation events from the blockchain."""
        try:
            # Get the latest block number
            latest_block = self.w3.eth.block_number
            from_block = latest_block - self.config.get('blocks_to_scan', 1000)
            
            # Get liquidation events
            liquidation_filter = self.lending_pool.events.Liquidation.create_filter(
                fromBlock=from_block,
                toBlock='latest'
            )
            liquidation_events = liquidation_filter.get_all_entries()
            
            for event in liquidation_events:
                # Process each liquidation event
                liquidation = {
                    'liquidator': event.args.liquidator,
                    'borrower': event.args.borrower,
                    'repay_amount': event.args.repayAmount,
                    'collateral_amount': event.args.collateralAmount,
                    'block_number': event.blockNumber,
                    'transaction_hash': event.transactionHash.hex()
                }
                
                logger.info(f"Liquidation detected: borrower {liquidation['borrower']} in block {liquidation['block_number']}")
                
                # Update our models based on liquidation data
                self.update_models_from_liquidation(liquidation)
                
                # Remove liquidated position from monitoring
                if liquidation['borrower'] in self.monitored_positions:
                    del self.monitored_positions[liquidation['borrower']]
        
        except Exception as e:
            logger.error(f"Error processing liquidation events: {str(e)}")
    
    def update_models_from_liquidation(self, liquidation):
        """Update AI models based on liquidation events to improve predictions."""
        try:
            # In a real implementation, we would:
            # 1. Collect features about the liquidated position
            # 2. Add this data to our training set
            # 3. Periodically retrain the model with the new data
            
            # For this demo, we'll just log it
            logger.info(f"Adding liquidation data to training set for future model updates: {liquidation['borrower']}")
            
            # Mark for model retraining if we have enough new data
            self._check_model_retraining_needed()
            
        except Exception as e:
            logger.error(f"Error updating models from liquidation: {str(e)}")
    
    def update_market_conditions(self):
        """Update market conditions and volatility metrics."""
        try:
            # In a real implementation, this would fetch price data from oracles
            # and calculate volatility metrics
            
            # Simulate fetching market data
            current_price = self.price_oracle.functions.getLatestPrice().call()
            
            # Add to historical prices (keep last 24 hours)
            self.market_volatility['history'].append({
                'timestamp': time.time(),
                'price': current_price
            })
            
            # Trim history to keep last 24 hours
            cutoff_time = time.time() - 86400
            self.market_volatility['history'] = [
                entry for entry in self.market_volatility['history']
                if entry['timestamp'] > cutoff_time
            ]
            
            # Calculate current volatility
            if len(self.market_volatility['history']) > 1:
                prices = [entry['price'] for entry in self.market_volatility['history']]
                price_returns = np.diff(prices) / prices[:-1]
                self.market_volatility['current'] = np.std(price_returns)
            
            logger.debug(f"Updated market volatility: {self.market_volatility['current']:.4f}")
            
        except Exception as e:
            logger.error(f"Error updating market conditions: {str(e)}")
    
    def update_volatility_model(self):
        """Update the volatility forecasting model."""
        try:
            # In a real implementation, this would use time series forecasting
            # to predict future market volatility
            
            # Simple forecast using recent trend
            if len(self.market_volatility['history']) > 12:  # At least 12 data points
                recent_history = self.market_volatility['history'][-12:]
                prices = [entry['price'] for entry in recent_history]
                
                # Calculate returns
                returns = np.diff(prices) / prices[:-1]
                
                # Calculate volatility
                current_vol = np.std(returns)
                
                # Calculate trend in volatility
                vol_trend = 0
                if len(self.market_volatility['history']) > 24:
                    older_history = self.market_volatility['history'][-24:-12]
                    older_prices = [entry['price'] for entry in older_history]
                    older_returns = np.diff(older_prices) / older_prices[:-1]
                    older_vol = np.std(older_returns)
                    vol_trend = (current_vol - older_vol) / older_vol if older_vol > 0 else 0
                
                # Simple forecast: current + trend
                forecast_vol = current_vol * (1 + vol_trend)
                self.market_volatility['forecast'] = forecast_vol
                
                logger.info(f"Updated volatility forecast: {forecast_vol:.4f}")
        
        except Exception as e:
            logger.error(f"Error updating volatility model: {str(e)}")
    
    def _check_model_retraining_needed(self):
        """Check if the model needs retraining based on new data."""
        # In a real implementation, this would track liquidation events
        # and trigger retraining when there's enough new data
        pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliLend Liquidation Monitor")
    parser.add_argument("--config", type=str, default="config/liquidation_monitor.json", help="Path to configuration file")
    args = parser.parse_args()
    
    monitor = LiquidationMonitor(args.config)
    monitor.start_monitoring()
