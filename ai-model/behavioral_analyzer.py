#!/usr/bin/env python
"""
IntelliLend Behavioral Analyzer

This module implements behavioral analysis to detect potential default patterns
before they occur, analyzing transaction history and identifying warning signs.
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
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

# Import IOTA connection for real-time data
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("behavioral_analyzer.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("behavioral_analyzer")

class BehavioralAnalyzer:
    """
    Analyzes user transaction behavior to detect patterns that may indicate
    potential defaults before they occur.
    """
    
    def __init__(self, config_path: str = 'config/behavioral_config.json'):
        """
        Initialize the behavioral analyzer with configuration.
        
        Args:
            config_path: Path to configuration file
        """
        logger.info("Initializing Behavioral Analyzer")
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize IOTA connection for real-time data
        try:
            self.iota_connection = get_iota_connection(
                self.config.get('iota_connection_config', 'config/iota_connection_config.json')
            )
            logger.info(f"Connected to IOTA network: {self.iota_connection.is_connected}")
        except Exception as e:
            logger.error(f"Error connecting to IOTA network: {e}")
            logger.warning("Continuing with limited functionality")
            self.iota_connection = None
        
        # Initialize behavioral pattern detection models
        self.models = self._initialize_models()
        
        # Initialize historical pattern database
        self.pattern_database = self._load_pattern_database()
        
        logger.info("Behavioral Analyzer initialized successfully")
    
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
                'pattern_database_path': 'data/pattern_database.json',
                'default_pattern_weights': {
                    'irregular_activity': 0.2,
                    'increasing_debt': 0.2,
                    'declining_repayments': 0.25,
                    'collateral_withdrawals': 0.15,
                    'cross_chain_transfers': 0.1,
                    'volatility_correlation': 0.1
                },
                'anomaly_detection_threshold': 0.75,
                'min_transaction_history': 5,
                'analysis_period_days': 90,
                'pattern_update_interval': 86400,  # 1 day
                'warning_thresholds': {
                    'high': 0.7,
                    'medium': 0.5,
                    'low': 0.25
                },
                'default_indicators': {
                    'repayment_gaps': {
                        'weight': 0.3,
                        'max_gap_days': 30
                    },
                    'collateral_reduction': {
                        'weight': 0.25,
                        'threshold': 0.1  # 10% reduction
                    },
                    'debt_increase': {
                        'weight': 0.2,
                        'threshold': 0.15  # 15% increase
                    },
                    'market_stress_correlation': {
                        'weight': 0.15,
                        'lookback_days': 30
                    },
                    'activity_anomalies': {
                        'weight': 0.1
                    }
                },
                'iota_connection_config': 'config/iota_connection_config.json'
            }
    
    def _initialize_models(self) -> Dict[str, Any]:
        """
        Initialize behavioral analysis models.
        
        Returns:
            Dictionary of initialized models
        """
        models = {}
        
        # Isolation Forest for anomaly detection
        models['isolation_forest'] = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42
        )
        
        # DBSCAN for clustering behavior patterns
        models['dbscan'] = DBSCAN(
            eps=0.5,
            min_samples=5,
            metric='euclidean',
            n_jobs=-1
        )
        
        # KMeans for behavioral clustering
        models['kmeans'] = KMeans(
            n_clusters=3,  # Default, low/medium/high risk clusters
            random_state=42,
            n_init=10
        )
        
        # Standard scaler for preprocessing
        models['scaler'] = StandardScaler()
        
        return models
    
    def _load_pattern_database(self) -> Dict[str, Any]:
        """
        Load historical pattern database.
        
        Returns:
            Pattern database dictionary
        """
        db_path = self.config.get('pattern_database_path', 'data/pattern_database.json')
        
        try:
            with open(db_path, 'r') as f:
                database = json.load(f)
            logger.info(f"Loaded pattern database from {db_path} with {len(database.get('patterns', []))} patterns")
            return database
        except FileNotFoundError:
            logger.warning(f"Pattern database not found at {db_path}. Creating new database.")
            # Create new database
            database = {
                'patterns': [],
                'default_signatures': [],
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'pattern_count': 0
            }
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            
            # Save empty database
            with open(db_path, 'w') as f:
                json.dump(database, f, indent=2)
                
            return database
    
    def analyze_user_behavior(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a user's behavior for default risk patterns.
        
        Args:
            user_data: User data dictionary
            
        Returns:
            Behavioral analysis results
        """
        logger.info(f"Analyzing behavior for user {user_data.get('address')}")
        
        # Extract transaction history
        transactions = user_data.get('iota_raw_transactions', [])
        
        # Check if we have enough transaction history
        min_transactions = self.config.get('min_transaction_history', 5)
        if len(transactions) < min_transactions:
            logger.info(f"Insufficient transaction history for user {user_data.get('address')}: {len(transactions)} < {min_transactions}")
            return {
                'status': 'insufficient_data',
                'requiredTransactions': min_transactions,
                'availableTransactions': len(transactions),
                'defaultPatterns': {
                    'detected': False,
                    'confidence': 0.0,
                    'patterns': []
                }
            }
        
        # Process transactions to extract behavioral features
        behavior_features = self._extract_behavior_features(transactions, user_data)
        
        # Detect default patterns
        default_patterns = self._detect_default_patterns(behavior_features, user_data)
        
        # Identify activity anomalies
        anomalies = self._detect_anomalies(behavior_features, transactions)
        
        # Generate behavioral insights
        insights = self._generate_behavioral_insights(behavior_features, default_patterns, anomalies)
        
        # Create comprehensive analysis
        analysis = {
            'status': 'success',
            'behaviorFeatures': behavior_features,
            'defaultPatterns': default_patterns,
            'activityAnomalies': anomalies,
            'insights': insights,
            'recommendations': self._generate_behavioral_recommendations(default_patterns, anomalies, user_data)
        }
        
        logger.info(f"Behavioral analysis completed for {user_data.get('address')}: " +
                   f"default patterns detected: {default_patterns.get('detected', False)}")
        
        return analysis
    
    def analyze_transactions(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze a list of transactions for patterns and insights.
        
        Args:
            transactions: List of transaction data
            
        Returns:
            Transaction analysis results
        """
        logger.info(f"Analyzing {len(transactions)} transactions")
        
        # Check if we have enough transactions
        min_transactions = self.config.get('min_transaction_history', 5)
        if len(transactions) < min_transactions:
            logger.info(f"Insufficient transactions: {len(transactions)} < {min_transactions}")
            return {
                'status': 'insufficient_data',
                'requiredTransactions': min_transactions,
                'availableTransactions': len(transactions)
            }
        
        # Process transactions to extract features
        features = self._process_transaction_features(transactions)
        
        # Detect transaction patterns
        patterns = self._detect_transaction_patterns(features)
        
        # Identify anomalies
        anomalies = self._identify_transaction_anomalies(features)
        
        # Generate insights
        insights = self._generate_transaction_insights(features, patterns, anomalies)
        
        return {
            'status': 'success',
            'transactionFeatures': features,
            'patterns': patterns,
            'anomalies': anomalies,
            'insights': insights
        }
    
    def detect_default_patterns(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect patterns that might indicate potential default.
        
        Args:
            user_profile: User risk profile
            
        Returns:
            Default pattern detection results
        """
        logger.info(f"Detecting default patterns for user {user_profile.get('address')}")
        
        # Extract behavioral analysis from profile if available
        if 'behavioralAnalysis' in user_profile:
            return user_profile['behavioralAnalysis'].get('defaultPatterns', {
                'detected': False,
                'confidence': 0.0,
                'patterns': []
            })
        
        # Extract user data from profile
        user_data = {
            'address': user_profile.get('address'),
            'collateral_ratio': user_profile.get('collateralRatio', 1.5),
            'current_collaterals': user_profile.get('currentCollaterals', 1000),
            'current_borrows': user_profile.get('currentBorrows', 500),
            'iota_raw_transactions': user_profile.get('iotaTransactions', [])
        }
        
        # Perform behavioral analysis
        analysis = self.analyze_user_behavior(user_data)
        
        return analysis.get('defaultPatterns', {
            'detected': False,
            'confidence': 0.0,
            'patterns': []
        })
    
    def _extract_behavior_features(
        self, 
        transactions: List[Dict[str, Any]], 
        user_data: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Extract behavioral features from transaction history.
        
        Args:
            transactions: List of transaction data
            user_data: User data dictionary
            
        Returns:
            Dictionary of behavioral features
        """
        # Initialize features with defaults
        features = {
            'transaction_frequency': 0.0,
            'transaction_regularity': 0.5,
            'transaction_growth_rate': 0.0,
            'incoming_ratio': 0.5,
            'average_transaction_size': 0.0,
            'transaction_size_variance': 0.0,
            'activity_pattern_score': 50.0,
            'temporal_consistency': 0.5,
            'repayment_regularity': 0.5,
            'collateral_management_score': 50.0,
            'debt_management_score': 50.0,
            'cross_chain_activity': 0.0,
            'default_risk_score': 50.0
        }
        
        # If no transactions, return defaults
        if not transactions:
            return features
        
        # Process transactions
        # Extract timestamps and values
        timestamps = []
        values = []
        incoming_count = 0
        outgoing_count = 0
        cross_chain_count = 0
        
        for tx in transactions:
            if 'timestamp' in tx:
                # Ensure timestamp is in a consistent format
                if isinstance(tx['timestamp'], (int, float)):
                    timestamps.append(datetime.fromtimestamp(tx['timestamp']))
                else:
                    # Assume ISO format string
                    try:
                        timestamps.append(datetime.fromisoformat(tx['timestamp']))
                    except ValueError:
                        continue  # Skip this transaction if timestamp isn't valid
            
            if 'value' in tx:
                values.append(tx['value'])
            
            # Track incoming vs outgoing
            if tx.get('incoming', False):
                incoming_count += 1
            else:
                outgoing_count += 1
            
            # Track cross-chain activities
            if tx.get('tag') == 'CROSS_CHAIN_TRANSFER':
                cross_chain_count += 1
        
        # Calculate features if we have enough data
        if timestamps and len(timestamps) >= 2:
            # Sort timestamps
            timestamps.sort()
            
            # Transaction frequency (average transactions per day)
            days_range = (timestamps[-1] - timestamps[0]).days + 1
            if days_range > 0:
                features['transaction_frequency'] = len(timestamps) / days_range
            
            # Transaction regularity (based on time intervals)
            intervals = [(timestamps[i] - timestamps[i-1]).total_seconds() for i in range(1, len(timestamps))]
            mean_interval = np.mean(intervals)
            if mean_interval > 0:
                std_interval = np.std(intervals)
                cv = std_interval / mean_interval  # Coefficient of variation
                # Transform to 0-1 scale (1 means perfectly regular)
                features['transaction_regularity'] = 1.0 / (1.0 + cv)
            
            # Transaction growth rate
            if len(timestamps) > 10 and days_range >= 30:
                # Compare first half vs second half frequency
                mid_point = len(timestamps) // 2
                first_half_period = (timestamps[mid_point] - timestamps[0]).days + 1
                second_half_period = (timestamps[-1] - timestamps[mid_point]).days + 1
                
                if first_half_period > 0 and second_half_period > 0:
                    first_half_freq = mid_point / first_half_period
                    second_half_freq = (len(timestamps) - mid_point) / second_half_period
                    
                    if first_half_freq > 0:
                        features['transaction_growth_rate'] = (second_half_freq - first_half_freq) / first_half_freq
            
            # Incoming ratio
            total_tx = incoming_count + outgoing_count
            if total_tx > 0:
                features['incoming_ratio'] = incoming_count / total_tx
            
            # Cross-chain activity
            features['cross_chain_activity'] = cross_chain_count / len(timestamps)
        
        # Calculate value-based features if we have values
        if values and len(values) > 0:
            features['average_transaction_size'] = np.mean(values)
            features['transaction_size_variance'] = np.var(values) / (np.mean(values) ** 2) if np.mean(values) > 0 else 0
        
        # Calculate temporal consistency
        # This measures if transactions happen around the same time (e.g., monthly payments)
        if timestamps and len(timestamps) >= 5:
            # Extract hour of day and day of month
            hours = [ts.hour for ts in timestamps]
            days = [ts.day for ts in timestamps]
            
            # Calculate concentration metrics
            hour_counts = np.bincount(hours, minlength=24)
            day_counts = np.bincount(days, minlength=32)[1:]  # Skip day 0
            
            # Higher concentration = more consistent timing
            hour_concentration = np.max(hour_counts) / len(timestamps)
            day_concentration = np.max(day_counts) / len(timestamps)
            
            # Average the two metrics
            features['temporal_consistency'] = (hour_concentration + day_concentration) / 2
        
        # Calculate repayment regularity
        # This would normally look at loan repayment transactions
        # For demo, we'll use a simple heuristic based on outgoing transactions
        if outgoing_count > 2:
            # Filter outgoing transactions
            outgoing_tx = [tx for tx in transactions if not tx.get('incoming', False)]
            outgoing_timestamps = []
            
            for tx in outgoing_tx:
                if 'timestamp' in tx:
                    # Convert timestamp to datetime
                    if isinstance(tx['timestamp'], (int, float)):
                        outgoing_timestamps.append(datetime.fromtimestamp(tx['timestamp']))
                    else:
                        try:
                            outgoing_timestamps.append(datetime.fromisoformat(tx['timestamp']))
                        except ValueError:
                            continue
            
            # Sort timestamps
            outgoing_timestamps.sort()
            
            if len(outgoing_timestamps) >= 3:
                # Calculate intervals
                intervals = [(outgoing_timestamps[i] - outgoing_timestamps[i-1]).total_seconds() 
                           for i in range(1, len(outgoing_timestamps))]
                
                # Standard deviation of intervals
                std_interval = np.std(intervals)
                mean_interval = np.mean(intervals)
                
                if mean_interval > 0:
                    cv = std_interval / mean_interval
                    # Transform to 0-1 scale
                    features['repayment_regularity'] = 1.0 / (1.0 + cv)
        
        # Calculate collateral management score
        # This would normally look at collateral-related transactions
        # For now, we'll use a simplistic approach
        
        # Calculate debt management score
        # This would normally analyze borrowing and repayment behavior
        # For now, we'll use a simplistic approach
        
        # Calculate default risk score based on all features
        if features['transaction_regularity'] < 0.3:
            features['default_risk_score'] += 15  # Very irregular transactions
        
        if features['transaction_growth_rate'] < -0.3:
            features['default_risk_score'] += 10  # Declining activity
        
        if features['repayment_regularity'] < 0.3:
            features['default_risk_score'] += 20  # Irregular repayments
        
        # Normalize default risk score
        features['default_risk_score'] = min(100, max(0, features['default_risk_score']))
        
        return features
    
    def _detect_default_patterns(
        self, 
        behavior_features: Dict[str, float],
        user_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detect patterns that may indicate risk of default.
        
        Args:
            behavior_features: Extracted behavioral features
            user_data: User data dictionary
            
        Returns:
            Default pattern detection results
        """
        # Initialize results
        results = {
            'detected': False,
            'confidence': 0.0,
            'patterns': [],
            'overall_score': 0.0
        }
        
        # Get weights for default indicators
        weights = self.config.get('default_indicators', {})
        
        # Check for repayment gaps
        repayment_gap_score = self._check_repayment_gaps(user_data)
        if repayment_gap_score > 0:
            repayment_weight = weights.get('repayment_gaps', {}).get('weight', 0.3)
            results['patterns'].append({
                'type': 'repayment_gaps',
                'score': repayment_gap_score,
                'weight': repayment_weight,
                'description': 'Irregular or missing repayments detected',
                'severity': 'high' if repayment_gap_score > 0.7 else 'medium'
            })
        
        # Check for collateral reduction
        collateral_score = self._check_collateral_reduction(user_data)
        if collateral_score > 0:
            collateral_weight = weights.get('collateral_reduction', {}).get('weight', 0.25)
            results['patterns'].append({
                'type': 'collateral_reduction',
                'score': collateral_score,
                'weight': collateral_weight,
                'description': 'Recent reduction in collateralization detected',
                'severity': 'high' if collateral_score > 0.7 else 'medium'
            })
        
        # Check for debt increase
        debt_score = self._check_debt_increase(user_data)
        if debt_score > 0:
            debt_weight = weights.get('debt_increase', {}).get('weight', 0.2)
            results['patterns'].append({
                'type': 'debt_increase',
                'score': debt_score,
                'weight': debt_weight,
                'description': 'Significant recent increase in debt',
                'severity': 'high' if debt_score > 0.7 else 'medium'
            })
        
        # Check for activity anomalies
        if behavior_features.get('transaction_regularity', 0.5) < 0.3:
            anomaly_weight = weights.get('activity_anomalies', {}).get('weight', 0.1)
            anomaly_score = 1.0 - behavior_features.get('transaction_regularity', 0.5)
            results['patterns'].append({
                'type': 'activity_anomalies',
                'score': anomaly_score,
                'weight': anomaly_weight,
                'description': 'Highly irregular transaction patterns',
                'severity': 'medium' if anomaly_score > 0.7 else 'low'
            })
        
        # Calculate overall score as weighted average of pattern scores
        if results['patterns']:
            total_weight = sum(pattern['weight'] for pattern in results['patterns'])
            if total_weight > 0:
                weighted_sum = sum(pattern['score'] * pattern['weight'] for pattern in results['patterns'])
                results['overall_score'] = weighted_sum / total_weight
        
        # Determine if default patterns were detected
        threshold = self.config.get('anomaly_detection_threshold', 0.75)
        results['detected'] = results['overall_score'] >= threshold
        
        # Set confidence based on number and strength of patterns
        if results['patterns']:
            # More patterns = higher confidence
            pattern_factor = min(1.0, len(results['patterns']) / 4)  # Max out at 4 patterns
            score_factor = results['overall_score']
            results['confidence'] = (pattern_factor + score_factor) / 2
        
        return results
    
    def _detect_anomalies(
        self, 
        behavior_features: Dict[str, float],
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies in user behavior.
        
        Args:
            behavior_features: Extracted behavioral features
            transactions: List of transaction data
            
        Returns:
            List of detected anomalies
        """
        anomalies = []
        
        # Check for transaction regularity anomalies
        if behavior_features.get('transaction_regularity', 0.5) < 0.3:
            anomalies.append({
                'type': 'irregular_transactions',
                'score': 1.0 - behavior_features.get('transaction_regularity', 0.5),
                'description': 'Highly irregular transaction pattern',
                'severity': 'medium'
            })
        
        # Check for sudden drop in transaction frequency
        if behavior_features.get('transaction_growth_rate', 0.0) < -0.5:
            anomalies.append({
                'type': 'activity_decline',
                'score': min(1.0, abs(behavior_features.get('transaction_growth_rate', 0.0))),
                'description': 'Significant decline in transaction activity',
                'severity': 'high'
            })
        
        # Check for unusual transaction size
        if behavior_features.get('transaction_size_variance', 0.0) > 5.0:
            anomalies.append({
                'type': 'variable_transaction_size',
                'score': min(1.0, behavior_features.get('transaction_size_variance', 0.0) / 10.0),
                'description': 'Highly variable transaction sizes',
                'severity': 'low'
            })
        
        # Look for timing anomalies (e.g., unusual hours)
        if len(transactions) >= 10:
            hour_anomalies = self._detect_timing_anomalies(transactions)
            if hour_anomalies:
                anomalies.append(hour_anomalies)
        
        return anomalies
    
    def _generate_behavioral_insights(
        self, 
        behavior_features: Dict[str, float],
        default_patterns: Dict[str, Any],
        anomalies: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate insights from behavioral analysis.
        
        Args:
            behavior_features: Extracted behavioral features
            default_patterns: Default pattern detection results
            anomalies: Detected anomalies
            
        Returns:
            List of behavioral insights
        """
        insights = []
        
        # Insight based on transaction regularity
        regularity = behavior_features.get('transaction_regularity', 0.5)
        if regularity > 0.7:
            insights.append({
                'type': 'transaction_pattern',
                'title': 'Consistent Transaction Pattern',
                'description': 'User exhibits very regular transaction patterns, suggesting structured financial behavior.',
                'impact': 'positive'
            })
        elif regularity < 0.3:
            insights.append({
                'type': 'transaction_pattern',
                'title': 'Irregular Transaction Pattern',
                'description': 'User shows highly irregular transaction patterns, which may indicate financial instability.',
                'impact': 'negative'
            })
        
        # Insight based on growth rate
        growth_rate = behavior_features.get('transaction_growth_rate', 0.0)
        if growth_rate > 0.3:
            insights.append({
                'type': 'activity_trend',
                'title': 'Increasing Activity',
                'description': 'User activity is increasing over time, showing growing engagement.',
                'impact': 'positive'
            })
        elif growth_rate < -0.3:
            insights.append({
                'type': 'activity_trend',
                'title': 'Decreasing Activity',
                'description': 'User activity is decreasing over time, which may be cause for attention.',
                'impact': 'negative'
            })
        
        # Insight based on repayment regularity
        repayment_reg = behavior_features.get('repayment_regularity', 0.5)
        if repayment_reg > 0.7:
            insights.append({
                'type': 'repayment_behavior',
                'title': 'Consistent Repayment Pattern',
                'description': 'User shows very regular repayment behavior, suggesting financial discipline.',
                'impact': 'positive'
            })
        elif repayment_reg < 0.3:
            insights.append({
                'type': 'repayment_behavior',
                'title': 'Irregular Repayment Pattern',
                'description': 'User shows irregular repayment patterns, which may indicate repayment difficulties.',
                'impact': 'negative'
            })
        
        # Insight based on default patterns
        if default_patterns.get('detected', False):
            pattern_count = len(default_patterns.get('patterns', []))
            insights.append({
                'type': 'default_risk',
                'title': 'Default Risk Patterns Detected',
                'description': f'User exhibits {pattern_count} patterns associated with higher default risk.',
                'impact': 'negative'
            })
        
        # Insight based on cross-chain activity
        cross_chain = behavior_features.get('cross_chain_activity', 0.0)
        if cross_chain > 0.2:
            insights.append({
                'type': 'cross_chain',
                'title': 'Active Cross-Chain User',
                'description': 'User is actively engaging in cross-chain activities, showing blockchain sophistication.',
                'impact': 'positive'
            })
        
        return insights
    
    def _generate_behavioral_recommendations(
        self,
        default_patterns: Dict[str, Any],
        anomalies: List[Dict[str, Any]],
        user_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized recommendations based on behavioral analysis.
        
        Args:
            default_patterns: Default pattern detection results
            anomalies: Detected anomalies
            user_data: User data dictionary
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        # Recommendation based on default patterns
        if default_patterns.get('detected', False):
            recommendations.append({
                'title': 'Improve Repayment Consistency',
                'description': 'Consider setting up automatic payments to improve repayment consistency and reduce default risk.',
                'action_type': 'repayment_schedule',
                'urgency': 'high',
                'impact': 'high'
            })
        
        # Recommendation based on irregular activity
        for anomaly in anomalies:
            if anomaly.get('type') == 'irregular_transactions' and anomaly.get('score', 0) > 0.6:
                recommendations.append({
                    'title': 'Establish Regular Activity',
                    'description': 'More regular transaction patterns could improve your risk profile and borrowing terms.',
                    'action_type': 'activity_pattern',
                    'urgency': 'medium',
                    'impact': 'medium'
                })
                break
        
        # Recommendation for cross-chain activity
        if user_data.get('iota_address') and not user_data.get('cross_layer_transfers', 0):
            recommendations.append({
                'title': 'Explore Cross-Layer Functionality',
                'description': 'Try using the cross-layer functionality between IOTA L1 and L2 to improve your profile.',
                'action_type': 'cross_layer',
                'urgency': 'low',
                'impact': 'medium'
            })
        
        # Recommendation for collateral management
        collateral_ratio = user_data.get('collateral_ratio', 1.5)
        if collateral_ratio < 1.3 and any(p['type'] == 'debt_increase' for p in default_patterns.get('patterns', [])):
            recommendations.append({
                'title': 'Strengthen Collateralization',
                'description': 'Increasing your collateralization ratio would reduce risk, especially given your recent borrowing activity.',
                'action_type': 'collateral',
                'urgency': 'high',
                'impact': 'high'
            })
        
        return recommendations
    
    def _process_transaction_features(
        self, 
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process transactions to extract meaningful features.
        
        Args:
            transactions: List of transaction data
            
        Returns:
            Dictionary of transaction features
        """
        # Initialize features
        features = {
            'count': len(transactions),
            'value_stats': {},
            'temporal_stats': {},
            'pattern_metrics': {},
            'incoming_outgoing_ratio': 0.5
        }
        
        # Extract values and timestamps
        values = []
        timestamps = []
        incoming_count = 0
        
        for tx in transactions:
            if 'value' in tx and tx['value'] is not None:
                values.append(tx['value'])
            
            if 'timestamp' in tx:
                # Convert timestamp to datetime
                if isinstance(tx['timestamp'], (int, float)):
                    timestamps.append(datetime.fromtimestamp(tx['timestamp']))
                else:
                    try:
                        timestamps.append(datetime.fromisoformat(tx['timestamp']))
                    except ValueError:
                        continue
            
            if tx.get('incoming', False):
                incoming_count += 1
        
        # Calculate value statistics
        if values:
            features['value_stats'] = {
                'mean': np.mean(values),
                'median': np.median(values),
                'std': np.std(values),
                'min': np.min(values),
                'max': np.max(values)
            }
        
        # Calculate temporal statistics
        if timestamps and len(timestamps) >= 2:
            # Sort timestamps
            timestamps.sort()
            
            # Calculate intervals
            intervals = [(timestamps[i] - timestamps[i-1]).total_seconds() for i in range(1, len(timestamps))]
            
            # Get statistics about intervals
            features['temporal_stats'] = {
                'first_tx_time': timestamps[0].isoformat(),
                'last_tx_time': timestamps[-1].isoformat(),
                'time_span_days': (timestamps[-1] - timestamps[0]).days,
                'mean_interval_hours': np.mean(intervals) / 3600 if intervals else 0,
                'median_interval_hours': np.median(intervals) / 3600 if intervals else 0,
                'interval_std_hours': np.std(intervals) / 3600 if intervals else 0
            }
            
            # Calculate temporal pattern metrics
            if len(timestamps) >= 5:
                # Get hour of day and day of week/month distributions
                hours = [ts.hour for ts in timestamps]
                weekdays = [ts.weekday() for ts in timestamps]
                days = [ts.day for ts in timestamps]
                
                # Calculate entropy of distributions as a measure of randomness
                hour_counts = np.bincount(hours, minlength=24)
                hour_probs = hour_counts / len(hours)
                hour_entropy = -np.sum(p * np.log(p) if p > 0 else 0 for p in hour_probs)
                
                weekday_counts = np.bincount(weekdays, minlength=7)
                weekday_probs = weekday_counts / len(weekdays)
                weekday_entropy = -np.sum(p * np.log(p) if p > 0 else 0 for p in weekday_probs)
                
                day_counts = np.bincount(days, minlength=32)[1:]  # Skip day 0
                day_probs = day_counts / len(days)
                day_entropy = -np.sum(p * np.log(p) if p > 0 else 0 for p in day_probs)
                
                # Normalize entropy values (lower entropy = more regular pattern)
                max_hour_entropy = np.log(24)
                max_weekday_entropy = np.log(7)
                max_day_entropy = np.log(31)
                
                hour_regularity = 1 - (hour_entropy / max_hour_entropy) if max_hour_entropy > 0 else 0
                weekday_regularity = 1 - (weekday_entropy / max_weekday_entropy) if max_weekday_entropy > 0 else 0
                day_regularity = 1 - (day_entropy / max_day_entropy) if max_day_entropy > 0 else 0
                
                features['pattern_metrics'] = {
                    'hour_regularity': hour_regularity,
                    'weekday_regularity': weekday_regularity,
                    'day_regularity': day_regularity,
                    'overall_regularity': (hour_regularity + weekday_regularity + day_regularity) / 3
                }
        
        # Calculate incoming/outgoing ratio
        if features['count'] > 0:
            features['incoming_outgoing_ratio'] = incoming_count / features['count']
        
        return features
    
    def _detect_transaction_patterns(self, features: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Detect patterns in transaction features.
        
        Args:
            features: Transaction features
            
        Returns:
            List of detected patterns
        """
        patterns = []
        
        # Time-based patterns
        if 'pattern_metrics' in features:
            metrics = features['pattern_metrics']
            
            # Check for high regularity in timing
            if metrics.get('hour_regularity', 0) > 0.7:
                patterns.append({
                    'type': 'time_of_day',
                    'description': 'Transactions occur at consistent times of day',
                    'strength': metrics['hour_regularity'],
                    'significance': 'medium'
                })
            
            if metrics.get('weekday_regularity', 0) > 0.7:
                patterns.append({
                    'type': 'day_of_week',
                    'description': 'Transactions occur on consistent days of the week',
                    'strength': metrics['weekday_regularity'],
                    'significance': 'medium'
                })
            
            if metrics.get('day_regularity', 0) > 0.7:
                patterns.append({
                    'type': 'day_of_month',
                    'description': 'Transactions occur on consistent days of the month (potential salary or payment cycles)',
                    'strength': metrics['day_regularity'],
                    'significance': 'high'
                })
        
        # Value-based patterns
        if 'value_stats' in features:
            stats = features['value_stats']
            
            # Check for consistent transaction sizes
            if 'std' in stats and 'mean' in stats and stats['mean'] > 0:
                cv = stats['std'] / stats['mean']  # Coefficient of variation
                
                if cv < 0.1:
                    patterns.append({
                        'type': 'consistent_amounts',
                        'description': 'Transactions have very consistent amounts',
                        'strength': 1.0 - cv,
                        'significance': 'high'
                    })
                elif cv < 0.3:
                    patterns.append({
                        'type': 'moderately_consistent_amounts',
                        'description': 'Transactions have moderately consistent amounts',
                        'strength': 1.0 - cv,
                        'significance': 'medium'
                    })
            
            # Check for bi-modal distribution (might indicate different types of regular payments)
            # This would require more sophisticated analysis in a real implementation
        
        # Volume patterns
        incoming_ratio = features.get('incoming_outgoing_ratio', 0.5)
        if incoming_ratio > 0.8:
            patterns.append({
                'type': 'mostly_incoming',
                'description': 'Mostly receiving transactions, with few outgoing',
                'strength': incoming_ratio,
                'significance': 'medium'
            })
        elif incoming_ratio < 0.2:
            patterns.append({
                'type': 'mostly_outgoing',
                'description': 'Mostly sending transactions, with few incoming',
                'strength': 1.0 - incoming_ratio,
                'significance': 'medium'
            })
        
        return patterns
    
    def _identify_transaction_anomalies(self, features: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Identify anomalies in transaction patterns.
        
        Args:
            features: Transaction features
            
        Returns:
            List of identified anomalies
        """
        anomalies = []
        
        # Check for irregularity in timing
        if 'pattern_metrics' in features:
            metrics = features['pattern_metrics']
            
            if metrics.get('overall_regularity', 0.5) < 0.3:
                anomalies.append({
                    'type': 'irregular_timing',
                    'description': 'Highly irregular transaction timing',
                    'severity': 'medium',
                    'score': 1.0 - metrics.get('overall_regularity', 0.5)
                })
        
        # Check for high variance in transaction sizes
        if 'value_stats' in features:
            stats = features['value_stats']
            
            if 'std' in stats and 'mean' in stats and stats['mean'] > 0:
                cv = stats['std'] / stats['mean']  # Coefficient of variation
                
                if cv > 1.5:
                    anomalies.append({
                        'type': 'high_amount_variance',
                        'description': 'Extremely variable transaction amounts',
                        'severity': 'medium',
                        'score': min(1.0, cv / 3.0)
                    })
        
        # Check for unusual gaps in transaction history
        if 'temporal_stats' in features:
            stats = features['temporal_stats']
            
            if 'median_interval_hours' in stats and 'interval_std_hours' in stats:
                median = stats['median_interval_hours']
                std = stats['interval_std_hours']
                
                if std > median * 3:
                    anomalies.append({
                        'type': 'inconsistent_frequency',
                        'description': 'Highly inconsistent transaction frequency with unusual gaps',
                        'severity': 'high',
                        'score': min(1.0, std / (median * 5))
                    })
        
        return anomalies
    
    def _generate_transaction_insights(
        self,
        features: Dict[str, Any],
        patterns: List[Dict[str, Any]],
        anomalies: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Generate insights based on transaction analysis.
        
        Args:
            features: Transaction features
            patterns: Detected patterns
            anomalies: Identified anomalies
            
        Returns:
            List of insights
        """
        insights = []
        
        # Insight based on transaction regularity
        if 'pattern_metrics' in features:
            regularity = features['pattern_metrics'].get('overall_regularity', 0.5)
            
            if regularity > 0.7:
                insights.append({
                    'type': 'regularity',
                    'title': 'Highly Regular Activity',
                    'description': 'Transactions follow a very consistent pattern, suggesting disciplined financial behavior',
                    'impact': 'positive'
                })
            elif regularity < 0.3:
                insights.append({
                    'type': 'irregularity',
                    'title': 'Irregular Activity',
                    'description': 'Transaction patterns are highly irregular, which may indicate inconsistent financial management',
                    'impact': 'negative'
                })
        
        # Insight based on transaction frequency
        if 'temporal_stats' in features:
            timespan_days = features['temporal_stats'].get('time_span_days', 0)
            tx_count = features.get('count', 0)
            
            if timespan_days > 0:
                tx_per_day = tx_count / timespan_days
                
                if tx_per_day > 1.0:
                    insights.append({
                        'type': 'high_activity',
                        'title': 'High Activity Level',
                        'description': f'More than one transaction per day ({tx_per_day:.1f}) on average, showing significant engagement',
                        'impact': 'positive'
                    })
                elif tx_per_day < 0.05:  # Less than one transaction every 20 days
                    insights.append({
                        'type': 'low_activity',
                        'title': 'Low Activity Level',
                        'description': 'Very infrequent transactions may indicate limited engagement',
                        'impact': 'neutral'
                    })
        
        # Insights based on detected patterns
        for pattern in patterns:
            if pattern['type'] == 'day_of_month' and pattern['strength'] > 0.8:
                insights.append({
                    'type': 'payment_cycle',
                    'title': 'Regular Payment Cycle',
                    'description': 'Transactions occur on specific days of the month, suggesting salary or scheduled payment patterns',
                    'impact': 'positive'
                })
        
        # Insights based on anomalies
        for anomaly in anomalies:
            if anomaly['type'] == 'inconsistent_frequency' and anomaly['severity'] == 'high':
                insights.append({
                    'type': 'frequency_anomaly',
                    'title': 'Inconsistent Activity',
                    'description': 'Transaction frequency is highly inconsistent with unusual gaps',
                    'impact': 'negative'
                })
        
        return insights
    
    def _check_repayment_gaps(self, user_data: Dict[str, Any]) -> float:
        """
        Check for gaps in repayment history.
        
        Args:
            user_data: User data dictionary
            
        Returns:
            Score indicating severity of repayment gaps (0-1)
        """
        # This would normally analyze loan repayment transactions
        # For now, we'll use a simple heuristic based on user data
        
        # Check if we have outgoing transactions
        transactions = user_data.get('iota_raw_transactions', [])
        outgoing_tx = [tx for tx in transactions if not tx.get('incoming', False)]
        
        if len(outgoing_tx) < 3:
            return 0.0  # Not enough data
        
        # Extract timestamps
        timestamps = []
        for tx in outgoing_tx:
            if 'timestamp' in tx:
                if isinstance(tx['timestamp'], (int, float)):
                    timestamps.append(datetime.fromtimestamp(tx['timestamp']))
                else:
                    try:
                        timestamps.append(datetime.fromisoformat(tx['timestamp']))
                    except ValueError:
                        continue
        
        if len(timestamps) < 3:
            return 0.0  # Not enough timestamp data
        
        # Sort timestamps
        timestamps.sort()
        
        # Calculate intervals in days
        intervals = [(timestamps[i] - timestamps[i-1]).days for i in range(1, len(timestamps))]
        
        # Calculate mean and standard deviation
        mean_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        
        # Check for large gaps relative to mean interval
        max_interval = max(intervals)
        
        # Get max gap threshold from config
        max_gap_days = self.config.get('default_indicators', {}).get('repayment_gaps', {}).get('max_gap_days', 30)
        
        # Calculate gap score
        if mean_interval > 0:
            # Normalize based on how much the max gap exceeds the mean
            gap_ratio = max_interval / mean_interval
            
            if gap_ratio > 3.0:
                # Large gap relative to typical interval
                severity = min(1.0, (gap_ratio - 3.0) / 7.0)  # Scale to 0-1
                return severity
        
        # Also check for absolute gaps
        if max_interval > max_gap_days:
            absolute_severity = min(1.0, (max_interval - max_gap_days) / 30.0)  # Scale to 0-1
            return absolute_severity
        
        return 0.0
    
    def _check_collateral_reduction(self, user_data: Dict[str, Any]) -> float:
        """
        Check for recent reductions in collateral.
        
        Args:
            user_data: User data dictionary
            
        Returns:
            Score indicating severity of collateral reduction (0-1)
        """
        # This would normally analyze collateral transactions
        # For now, we'll use a simple simulation based on user data
        
        # Get collateral data
        current_collateral = user_data.get('current_collaterals', 0)
        
        # Simulate historical collateral data
        # In a real implementation, this would come from transaction history
        if 'iota_raw_transactions' in user_data:
            transactions = user_data['iota_raw_transactions']
            
            # Look for collateral withdrawal transactions
            reduction_score = 0.0
            
            for tx in transactions:
                if tx.get('tag') == 'COLLATERAL_WITHDRAW' and not tx.get('incoming', True):
                    # Found a collateral withdrawal
                    
                    # Calculate as percentage of current collateral
                    if current_collateral > 0 and 'value' in tx:
                        withdrawal_ratio = tx['value'] / current_collateral
                        
                        # Get threshold from config
                        threshold = self.config.get('default_indicators', {}).get('collateral_reduction', {}).get('threshold', 0.1)
                        
                        if withdrawal_ratio > threshold:
                            # Significant withdrawal
                            severity = min(1.0, withdrawal_ratio / (threshold * 5))  # Scale to 0-1
                            reduction_score = max(reduction_score, severity)  # Take highest score
            
            return reduction_score
        
        return 0.0
    
    def _check_debt_increase(self, user_data: Dict[str, Any]) -> float:
        """
        Check for significant increases in debt.
        
        Args:
            user_data: User data dictionary
            
        Returns:
            Score indicating severity of debt increase (0-1)
        """
        # This would normally analyze borrowing transactions
        # For now, we'll use a simple simulation based on user data
        
        # Get current borrows
        current_borrows = user_data.get('current_borrows', 0)
        
        # Simulate historical borrow data
        # In a real implementation, this would come from transaction history
        if 'iota_raw_transactions' in user_data:
            transactions = user_data['iota_raw_transactions']
            
            # Look for borrow transactions
            increase_score = 0.0
            
            for tx in transactions:
                if tx.get('tag') == 'BORROW' and tx.get('incoming', False):
                    # Found a borrow transaction
                    
                    # Calculate as percentage of current borrows
                    if current_borrows > 0 and 'value' in tx:
                        borrow_ratio = tx['value'] / current_borrows
                        
                        # Get threshold from config
                        threshold = self.config.get('default_indicators', {}).get('debt_increase', {}).get('threshold', 0.15)
                        
                        if borrow_ratio > threshold:
                            # Significant borrowing
                            severity = min(1.0, borrow_ratio / (threshold * 3))  # Scale to 0-1
                            increase_score = max(increase_score, severity)  # Take highest score
            
            return increase_score
        
        return 0.0
    
    def _detect_timing_anomalies(self, transactions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Detect anomalies in transaction timing.
        
        Args:
            transactions: List of transaction data
            
        Returns:
            Timing anomaly detection result or None
        """
        # Extract timestamps
        timestamps = []
        for tx in transactions:
            if 'timestamp' in tx:
                if isinstance(tx['timestamp'], (int, float)):
                    timestamps.append(datetime.fromtimestamp(tx['timestamp']))
                else:
                    try:
                        timestamps.append(datetime.fromisoformat(tx['timestamp']))
                    except ValueError:
                        continue
        
        if len(timestamps) < 5:
            return None  # Not enough data
        
        # Extract hour of day
        hours = [ts.hour for ts in timestamps]
        
        # Calculate hour distribution
        hour_counts = np.bincount(hours, minlength=24)
        hour_probs = hour_counts / len(hours)
        
        # Check for unusual hours
        night_hours = sum(hour_counts[0:6])  # Midnight to 6 AM
        night_ratio = night_hours / len(timestamps)
        
        if night_ratio > 0.3:
            # More than 30% of transactions at unusual hours
            return {
                'type': 'unusual_hours',
                'score': min(1.0, night_ratio * 2),  # Scale to 0-1
                'description': 'Significant activity during unusual hours (midnight to 6 AM)',
                'severity': 'medium' if night_ratio > 0.5 else 'low'
            }
        
        return None


# Main function for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IntelliLend Behavioral Analyzer")
    parser.add_argument("--config", type=str, default="config/behavioral_config.json", help="Path to configuration file")
    parser.add_argument("--address", type=str, default="0x0123456789abcdef0123456789abcdef01234567", help="User address")
    args = parser.parse_args()
    
    # Create analyzer
    analyzer = BehavioralAnalyzer(args.config)
    
    # Generate some synthetic transaction data for testing
    num_transactions = 50
    transactions = []
    
    # Create timestamps for the last 90 days
    for i in range(num_transactions):
        # Random timestamp in the last 90 days
        days_ago = np.random.randint(0, 90)
        hours_ago = np.random.randint(0, 24)
        tx_time = datetime.now() - timedelta(days=days_ago, hours=hours_ago)
        
        # Random transaction value
        value = np.random.exponential(100)
        
        # Random incoming/outgoing
        incoming = np.random.choice([True, False])
        
        transactions.append({
            'timestamp': tx_time.isoformat(),
            'value': value,
            'incoming': incoming,
            'tag': np.random.choice(['TRANSFER', 'PAYMENT', 'COLLATERAL', None], p=[0.4, 0.3, 0.2, 0.1])
        })
    
    # Simulate user data
    user_data = {
        'address': args.address,
        'collateral_ratio': 1.5,
        'current_collaterals': 1000,
        'current_borrows': 500,
        'iota_raw_transactions': transactions
    }
    
    # Analyze behavior
    analysis = analyzer.analyze_user_behavior(user_data)
    
    # Print results
    print(json.dumps(analysis, indent=2))
