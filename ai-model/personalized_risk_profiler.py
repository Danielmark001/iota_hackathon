#!/usr/bin/env python
"""
IntelliLend Personalized Risk Profiler

This module provides the main functionality for the personalized risk profiling system,
generating user-specific risk scores based on their IOTA transaction history and
offering tailored recommendations.
"""

import os
import sys
import logging
import json
import time
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union

# Import component modules
from collateralization_advisor import CollateralizationAdvisor
from liquidation_predictor import LiquidationPredictor
from behavioral_analyzer import BehavioralAnalyzer
from enhanced_iota_risk_model import EnhancedIOTARiskModel
from feature_engineering.feature_processor import FeatureProcessor

# Import IOTA connection module
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("personalized_risk_profiler.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("personalized_risk_profiler")

class PersonalizedRiskProfiler:
    """
    Main class for the personalized risk profiling system.
    
    This class integrates all components of the system and provides methods
    for generating personalized risk profiles and recommendations.
    """
    
    def __init__(self, config_path: str = 'config/risk_profiler_config.json'):
        """
        Initialize the risk profiler with configuration.
        
        Args:
            config_path: Path to configuration file
        """
        logger.info("Initializing Personalized Risk Profiler")
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize feature processor
        self.feature_processor = FeatureProcessor(
            feature_config_path=self.config.get('feature_config_path', 'config/feature_config.json'),
            model_dir=self.config.get('model_dir', 'models'),
            scaler_type=self.config.get('scaler_type', 'robust')
        )
        
        # Initialize IOTA connection for real-time data
        logger.info("Connecting to IOTA network...")
        try:
            self.iota_connection = get_iota_connection(
                self.config.get('iota_connection_config', 'config/iota_connection_config.json')
            )
            logger.info(f"Connected to IOTA network: {self.iota_connection.is_connected}")
        except Exception as e:
            logger.error(f"Error connecting to IOTA network: {e}")
            logger.warning("Continuing with limited functionality, some features may be unavailable")
            self.iota_connection = None
        
        # Initialize risk model
        self.risk_model = EnhancedIOTARiskModel(
            self.config.get('risk_model_config', 'config/iota_risk_model_config.json')
        )
        
        # Initialize component modules
        self.collateralization_advisor = CollateralizationAdvisor(
            self.config.get('collateralization_config', 'config/collateralization_config.json')
        )
        
        self.liquidation_predictor = LiquidationPredictor(
            self.config.get('liquidation_config', 'config/liquidation_config.json')
        )
        
        self.behavioral_analyzer = BehavioralAnalyzer(
            self.config.get('behavioral_config', 'config/behavioral_config.json')
        )
        
        # Cache for user profiles
        self.user_profiles_cache = {}
        self.cache_expiry = {}
        self.cache_ttl = self.config.get('cache_ttl', 3600)  # 1 hour default
        
        logger.info("Personalized Risk Profiler initialized successfully")
    
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
            # Default configuration
            return {
                'model_dir': 'models',
                'feature_config_path': 'config/feature_config.json',
                'risk_model_config': 'config/iota_risk_model_config.json',
                'collateralization_config': 'config/collateralization_config.json',
                'liquidation_config': 'config/liquidation_config.json',
                'behavioral_config': 'config/behavioral_config.json',
                'iota_connection_config': 'config/iota_connection_config.json',
                'cache_ttl': 3600,
                'default_risk_threshold': 50,
                'high_risk_threshold': 70,
                'low_risk_threshold': 30,
                'feature_weights': {
                    'transaction_history': 0.3,
                    'collateral_quality': 0.2,
                    'repayment_history': 0.25,
                    'market_correlation': 0.15,
                    'behavioral_patterns': 0.1
                }
            }
    
    def get_user_risk_profile(
        self, 
        user_address: str, 
        iota_address: Optional[str] = None, 
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive personalized risk profile for a user.
        
        Args:
            user_address: User's EVM address
            iota_address: User's IOTA address (optional)
            force_refresh: Whether to force a refresh of cached data
            
        Returns:
            Comprehensive risk profile dictionary
        """
        logger.info(f"Generating risk profile for user {user_address}")
        
        # Check cache unless force refresh is requested
        if not force_refresh and user_address in self.user_profiles_cache:
            if time.time() < self.cache_expiry.get(user_address, 0):
                logger.info(f"Using cached risk profile for {user_address}")
                return self.user_profiles_cache[user_address]
        
        # Collect user data from multiple sources
        user_data = self._collect_user_data(user_address, iota_address)
        
        # Generate base risk assessment
        risk_assessment = self.risk_model.assess_risk(user_data)
        
        # Enhanced with behavioral analysis
        behavioral_analysis = self.behavioral_analyzer.analyze_user_behavior(user_data)
        
        # Get collateralization recommendations
        collateral_recommendations = self.collateralization_advisor.get_recommendations(
            user_data, 
            risk_assessment['riskScore']
        )
        
        # Get liquidation predictions
        liquidation_predictions = self.liquidation_predictor.predict_liquidation_scenarios(
            user_data,
            risk_assessment['riskScore']
        )
        
        # Combine all components into a comprehensive risk profile
        risk_profile = {
            'address': user_address,
            'iotaAddress': iota_address,
            'timestamp': datetime.now().isoformat(),
            'riskScore': risk_assessment['riskScore'],
            'riskClass': risk_assessment['riskClass'],
            'confidenceScore': risk_assessment['confidenceScore'],
            'componentScores': risk_assessment.get('componentScores', {}),
            'riskFactors': risk_assessment.get('riskFactors', []),
            'behavioralAnalysis': behavioral_analysis,
            'collateralizationRecommendations': collateral_recommendations,
            'liquidationPredictions': liquidation_predictions,
            'recommendedActions': self._generate_action_recommendations(
                risk_assessment, 
                behavioral_analysis,
                collateral_recommendations,
                liquidation_predictions
            ),
            'dataQuality': risk_assessment.get('dataQuality', {})
        }
        
        # Cache the profile
        self.user_profiles_cache[user_address] = risk_profile
        self.cache_expiry[user_address] = time.time() + self.cache_ttl
        
        logger.info(f"Generated risk profile for {user_address}: score={risk_profile['riskScore']}, class={risk_profile['riskClass']}")
        
        return risk_profile
    
    def _collect_user_data(
        self, 
        user_address: str, 
        iota_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Collect user data from multiple sources, including transaction history from IOTA.
        
        Args:
            user_address: User's EVM address
            iota_address: User's IOTA address (optional)
            
        Returns:
            Combined user data dictionary
        """
        logger.info(f"Collecting user data for {user_address}")
        
        # Initialize with base user data
        user_data = {
            'address': user_address,
            'has_iota_address': iota_address is not None,
            'iota_address': iota_address
        }
        
        # Collect on-chain EVM data
        evm_data = self._get_evm_data(user_address)
        user_data.update(evm_data)
        
        # Collect IOTA data if address is provided and connection is available
        if iota_address and self.iota_connection and self.iota_connection.is_connected:
            try:
                logger.info(f"Fetching IOTA transaction history for {iota_address}")
                iota_data = self.iota_connection.get_address_data(iota_address)
                
                # Process IOTA transaction history
                tx_history = iota_data.get('transactions', [])
                tx_features = self._process_iota_transactions(tx_history)
                
                # Add IOTA-specific data
                user_data.update({
                    'iota_transaction_count': len(tx_history),
                    'iota_balance': iota_data.get('balance', 0),
                    'iota_first_transaction_timestamp': iota_data.get('firstTransactionTimestamp'),
                    'iota_latest_transaction_timestamp': iota_data.get('latestTransactionTimestamp'),
                    'iota_message_count': iota_data.get('messageCount', 0),
                    'iota_native_tokens_count': len(iota_data.get('nativeTokens', [])),
                    'iota_activity_regularity': tx_features.get('activity_regularity', 0.5),
                    'cross_layer_transfers': tx_features.get('cross_layer_transfers', 0),
                    'iota_raw_transactions': tx_history
                })
                
                # Add extracted transaction features
                user_data.update(tx_features)
                
                logger.info(f"Successfully collected IOTA data for {iota_address}: {len(tx_history)} transactions")
            except Exception as e:
                logger.error(f"Error collecting IOTA data for {iota_address}: {e}")
                logger.info("Continuing with limited IOTA data")
        
        return user_data
    
    def _get_evm_data(self, user_address: str) -> Dict[str, Any]:
        """
        Get user data from EVM layer.
        
        This would normally fetch data from the blockchain, but for simplicity,
        we'll simulate some data.
        
        Args:
            user_address: User's EVM address
            
        Returns:
            Dictionary of EVM data
        """
        # This is a simplified version, in a real implementation this would
        # interact with the blockchain to get real user data
        
        # TODO: Replace with actual blockchain interaction
        # Simulate some data for demonstration
        return {
            'wallet_age_days': 120,
            'transaction_count': 45,
            'current_collaterals': 1000,
            'current_borrows': 500,
            'collateral_ratio': 2.0,  # Collateral / Borrows
            'repayment_ratio': 0.95,  # Historical repayment ratio
            'previous_loans_count': 3,
            'market_volatility_correlation': 0.3,
            'identity_verified': True,
            'identity_verification_level': 'advanced'
        }
    
    def _process_iota_transactions(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process IOTA transactions to extract features for risk assessment.
        
        Args:
            transactions: List of IOTA transactions
            
        Returns:
            Dictionary of extracted features
        """
        if not transactions:
            return {
                'activity_regularity': 0.5,
                'cross_layer_transfers': 0,
                'transaction_pattern_score': 50,
                'transaction_growth_rate': 0,
                'average_transaction_value': 0,
                'incoming_transaction_ratio': 0.5
            }
        
        # Extract transaction timestamps and values
        timestamps = []
        values = []
        incoming_count = 0
        cross_layer_count = 0
        
        for tx in transactions:
            if 'timestamp' in tx:
                timestamps.append(tx['timestamp'])
            
            if 'value' in tx:
                values.append(tx['value'])
                
            # Count incoming transactions
            if tx.get('incoming', False):
                incoming_count += 1
                
            # Count cross-layer transfers
            if tx.get('tag') == 'CROSS_LAYER_TRANSFER':
                cross_layer_count += 1
        
        # Convert timestamps to datetime and sort
        timestamps = sorted([
            datetime.fromtimestamp(ts) if isinstance(ts, (int, float)) else datetime.fromisoformat(ts)
            for ts in timestamps if ts
        ])
        
        # Calculate features
        features = {}
        
        # Activity regularity - based on consistency of transaction intervals
        if len(timestamps) > 1:
            intervals = [(timestamps[i] - timestamps[i-1]).total_seconds() 
                        for i in range(1, len(timestamps))]
            
            # Calculate coefficient of variation (lower means more regular)
            mean_interval = np.mean(intervals)
            std_interval = np.std(intervals)
            if mean_interval > 0:
                cv = std_interval / mean_interval
                # Transform to 0-1 scale (1 is most regular)
                features['activity_regularity'] = 1.0 / (1.0 + cv)
            else:
                features['activity_regularity'] = 0.5
        else:
            features['activity_regularity'] = 0.5
        
        # Cross-layer transfers count
        features['cross_layer_transfers'] = cross_layer_count
        
        # Transaction pattern score - based on frequency and consistency
        # Higher score means more predictable/better patterns
        pattern_score = 50  # Default medium score
        
        # Adjust based on transaction frequency
        tx_per_day = len(transactions) / max(1, (datetime.now() - timestamps[0]).days)
        if tx_per_day > 1.0:
            pattern_score += 15  # Active user
        elif tx_per_day > 0.5:
            pattern_score += 10  # Moderately active
        elif tx_per_day < 0.1:
            pattern_score -= 10  # Very infrequent
        
        # Adjust based on regularity
        if features['activity_regularity'] > 0.8:
            pattern_score += 15  # Very regular
        elif features['activity_regularity'] > 0.6:
            pattern_score += 10  # Moderately regular
        elif features['activity_regularity'] < 0.3:
            pattern_score -= 10  # Very irregular
        
        features['transaction_pattern_score'] = max(0, min(100, pattern_score))
        
        # Transaction growth rate
        if len(timestamps) > 10 and (datetime.now() - timestamps[0]).days > 30:
            # Compare first half vs second half transaction frequency
            mid_point = len(timestamps) // 2
            first_half_days = max(1, (timestamps[mid_point] - timestamps[0]).days)
            second_half_days = max(1, (timestamps[-1] - timestamps[mid_point]).days)
            
            first_half_freq = mid_point / first_half_days
            second_half_freq = (len(timestamps) - mid_point) / second_half_days
            
            if first_half_freq > 0:
                growth_rate = (second_half_freq - first_half_freq) / first_half_freq
                features['transaction_growth_rate'] = growth_rate
            else:
                features['transaction_growth_rate'] = 0
        else:
            features['transaction_growth_rate'] = 0
        
        # Average transaction value
        if values:
            features['average_transaction_value'] = np.mean(values)
        else:
            features['average_transaction_value'] = 0
        
        # Incoming transaction ratio
        if transactions:
            features['incoming_transaction_ratio'] = incoming_count / len(transactions)
        else:
            features['incoming_transaction_ratio'] = 0.5
        
        return features
    
    def _generate_action_recommendations(
        self,
        risk_assessment: Dict[str, Any],
        behavioral_analysis: Dict[str, Any],
        collateral_recommendations: Dict[str, Any],
        liquidation_predictions: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized action recommendations based on risk profile.
        
        Args:
            risk_assessment: Risk assessment results
            behavioral_analysis: Behavioral analysis results
            collateral_recommendations: Collateralization recommendations
            liquidation_predictions: Liquidation predictions
            
        Returns:
            List of recommended actions
        """
        recommendations = []
        risk_score = risk_assessment['riskScore']
        
        # Add collateralization recommendations
        if 'recommendedRatio' in collateral_recommendations:
            recommendations.append({
                'type': 'collateral',
                'title': 'Optimize Collateralization Ratio',
                'description': f"Set your collateralization ratio to {collateral_recommendations['recommendedRatio']:.2f} for optimal balance between risk and capital efficiency.",
                'impact': 'high',
                'urgency': 'medium' if risk_score > 60 else 'low'
            })
        
        # Add liquidation risk recommendations
        if 'liquidationRisk' in liquidation_predictions and liquidation_predictions['liquidationRisk'] > 0.2:
            recommendations.append({
                'type': 'liquidation',
                'title': 'Reduce Liquidation Risk',
                'description': 'Your position has a significant liquidation risk. Consider reducing your borrowed amount or adding more collateral.',
                'impact': 'high',
                'urgency': 'high'
            })
        
        # Add behavioral recommendations
        if 'defaultPatterns' in behavioral_analysis and behavioral_analysis['defaultPatterns']['detected']:
            recommendations.append({
                'type': 'behavioral',
                'title': 'Address Concerning Behavior Patterns',
                'description': 'Your transaction patterns show signs associated with higher default risk. Consider more regular repayment schedules.',
                'impact': 'high',
                'urgency': 'medium'
            })
        
        # Add identity verification recommendation if not already verified
        if not risk_assessment.get('dataQuality', {}).get('hasIdentityVerification', True):
            recommendations.append({
                'type': 'identity',
                'title': 'Complete Identity Verification',
                'description': 'Verify your identity to improve your risk score and access better terms.',
                'impact': 'medium',
                'urgency': 'medium'
            })
        
        # Add IOTA address recommendation if not already connected
        if not risk_assessment.get('dataQuality', {}).get('hasIotaAddress', True):
            recommendations.append({
                'type': 'connection',
                'title': 'Connect IOTA Address',
                'description': 'Connect your IOTA address to improve your risk profile with cross-chain activity data.',
                'impact': 'medium',
                'urgency': 'low'
            })
        
        # Sort recommendations by urgency and impact
        urgency_map = {'high': 3, 'medium': 2, 'low': 1}
        impact_map = {'high': 3, 'medium': 2, 'low': 1}
        
        recommendations.sort(key=lambda x: (
            urgency_map.get(x.get('urgency', 'low'), 0),
            impact_map.get(x.get('impact', 'low'), 0)
        ), reverse=True)
        
        return recommendations
    
    def analyze_transaction_history(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze transaction history for risk profiling.
        
        Args:
            transactions: List of transaction data
            
        Returns:
            Transaction analysis results
        """
        return self.behavioral_analyzer.analyze_transactions(transactions)
    
    def get_collateralization_recommendation(
        self, 
        user_address: str, 
        asset_type: str,
        current_collateral_ratio: float,
        loan_amount: float
    ) -> Dict[str, Any]:
        """
        Get personalized collateralization ratio recommendation.
        
        Args:
            user_address: User's address
            asset_type: Type of collateral asset
            current_collateral_ratio: Current collateralization ratio
            loan_amount: Amount of the loan
            
        Returns:
            Collateralization recommendation
        """
        # Get user's risk profile
        risk_profile = self.get_user_risk_profile(user_address)
        
        # Generate recommendation based on profile and asset
        return self.collateralization_advisor.get_asset_recommendation(
            risk_profile,
            asset_type, 
            current_collateral_ratio,
            loan_amount
        )
    
    def predict_liquidation_probability(
        self,
        user_address: str,
        market_scenarios: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Predict liquidation probability under various market scenarios.
        
        Args:
            user_address: User's address
            market_scenarios: List of market scenario dictionaries (optional)
            
        Returns:
            Liquidation probability predictions
        """
        # Get user's risk profile
        risk_profile = self.get_user_risk_profile(user_address)
        
        # Generate liquidation predictions
        return self.liquidation_predictor.predict_market_scenarios(
            risk_profile,
            market_scenarios
        )
    
    def detect_default_patterns(self, user_address: str) -> Dict[str, Any]:
        """
        Detect patterns that might indicate potential default.
        
        Args:
            user_address: User's address
            
        Returns:
            Default pattern detection results
        """
        # Get user's risk profile
        risk_profile = self.get_user_risk_profile(user_address)
        
        # Run behavioral analysis to detect patterns
        return self.behavioral_analyzer.detect_default_patterns(risk_profile)
    
    def invalidate_cache(self, user_address: Optional[str] = None):
        """
        Invalidate cached risk profiles.
        
        Args:
            user_address: Specific user address to invalidate, or None for all
        """
        if user_address:
            if user_address in self.user_profiles_cache:
                del self.user_profiles_cache[user_address]
                if user_address in self.cache_expiry:
                    del self.cache_expiry[user_address]
                logger.info(f"Invalidated cache for user {user_address}")
        else:
            self.user_profiles_cache.clear()
            self.cache_expiry.clear()
            logger.info("Invalidated all cached risk profiles")


# Main function for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IntelliLend Personalized Risk Profiler")
    parser.add_argument("--config", type=str, default="config/risk_profiler_config.json", help="Path to configuration file")
    parser.add_argument("--address", type=str, required=True, help="User address to analyze")
    parser.add_argument("--iota-address", type=str, help="IOTA address (optional)")
    args = parser.parse_args()
    
    # Create risk profiler
    profiler = PersonalizedRiskProfiler(args.config)
    
    # Get risk profile
    profile = profiler.get_user_risk_profile(args.address, args.iota_address)
    
    # Print results
    print(json.dumps(profile, indent=2))
