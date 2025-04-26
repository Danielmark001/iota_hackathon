#!/usr/bin/env python
"""
IntelliLend Liquidation Predictor

This module implements advanced predictive models for liquidation probability
analysis under various market scenarios, providing early warnings and
risk assessment for borrowers.
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
from scipy.stats import norm

# Import IOTA connection for real-time data
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("liquidation_predictor.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("liquidation_predictor")

class LiquidationPredictor:
    """
    Advanced predictive modeling for liquidation risk assessment.
    
    Provides forecasting of liquidation probability under various market
    scenarios and stress testing for user positions.
    """
    
    def __init__(self, config_path: str = 'config/liquidation_config.json'):
        """
        Initialize the liquidation predictor with configuration.
        
        Args:
            config_path: Path to configuration file
        """
        logger.info("Initializing Liquidation Predictor")
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize price feeds and market data cache
        self.market_data = {}
        self.price_history = {}
        self.last_data_update = 0
        
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
        
        # Initialize pre-defined market scenarios
        self.market_scenarios = self._initialize_scenarios()
        
        # Update initial market data
        self._update_market_data()
        
        logger.info("Liquidation Predictor initialized successfully")
    
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
                'liquidation_threshold': 1.0,  # Collateral ratio threshold for liquidation
                'data_update_interval': 3600,  # 1 hour
                'forecast_days': 7,           # Number of days to forecast
                'monte_carlo_simulations': 1000,  # Number of simulations
                'confidence_interval': 0.95,  # 95% confidence interval
                'risk_factor_weights': {      # Weights for different risk factors
                    'collateral_ratio': 0.35,
                    'market_volatility': 0.25,
                    'price_correlation': 0.15,
                    'user_risk_score': 0.15,
                    'historical_liquidations': 0.1
                },
                'market_scenarios': {
                    'normal': {
                        'price_change_mean': 0.0,
                        'price_change_std': 0.02,
                        'volatility_change': 0.0
                    },
                    'bull': {
                        'price_change_mean': 0.02,
                        'price_change_std': 0.025,
                        'volatility_change': -0.1
                    },
                    'bear': {
                        'price_change_mean': -0.02,
                        'price_change_std': 0.035,
                        'volatility_change': 0.2
                    },
                    'extreme_bull': {
                        'price_change_mean': 0.04,
                        'price_change_std': 0.04,
                        'volatility_change': 0.1
                    },
                    'extreme_bear': {
                        'price_change_mean': -0.04,
                        'price_change_std': 0.05,
                        'volatility_change': 0.3
                    },
                    'high_volatility': {
                        'price_change_mean': 0.0,
                        'price_change_std': 0.05,
                        'volatility_change': 0.5
                    }
                },
                'iota_connection_config': 'config/iota_connection_config.json',
                'assets': ['IOTA', 'ETH', 'BTC', 'USDC', 'DAI']
            }
    
    def _initialize_scenarios(self) -> Dict[str, Dict[str, Any]]:
        """
        Initialize pre-defined market scenarios.
        
        Returns:
            Dictionary of market scenarios
        """
        return self.config.get('market_scenarios', {})
    
    def _update_market_data(self):
        """
        Update market data from real-time sources.
        """
        current_time = time.time()
        update_interval = self.config.get('data_update_interval', 3600)
        
        # Only update if enough time has passed
        if current_time - self.last_data_update < update_interval:
            return
        
        logger.info("Updating market data")
        
        # Update market data for each asset
        for asset in self.config.get('assets', ['IOTA']):
            try:
                # Fetch real-time data if IOTA connection is available
                if asset == 'IOTA' and self.iota_connection and self.iota_connection.is_connected:
                    # Get price data
                    price_data = self.iota_connection.get_token_price_history('IOTA', days=30)
                    
                    if price_data:
                        # Process price history
                        prices = [p['price'] for p in price_data]
                        timestamps = [p['timestamp'] for p in price_data]
                        
                        # Calculate volatility and other metrics
                        if len(prices) >= 2:
                            returns = np.diff(prices) / prices[:-1]
                            volatility = np.std(returns)
                            current_price = prices[-1]
                            
                            # Store in market data
                            self.market_data[asset] = {
                                'current_price': current_price,
                                'volatility': volatility,
                                'last_updated': current_time
                            }
                            
                            # Store price history
                            self.price_history[asset] = {
                                'prices': prices,
                                'timestamps': timestamps,
                                'returns': returns.tolist()
                            }
                            
                            logger.info(f"Updated market data for {asset}: price=${current_price:.2f}, volatility={volatility:.4f}")
                else:
                    # Simulate data for other assets or if IOTA connection isn't available
                    
                    # Use previous data as base if available
                    if asset in self.market_data:
                        base_price = self.market_data[asset].get('current_price', 100.0)
                        base_volatility = self.market_data[asset].get('volatility', 0.02)
                    else:
                        # Default values if no previous data
                        if asset == 'IOTA':
                            base_price = 0.25
                            base_volatility = 0.025
                        elif asset == 'ETH':
                            base_price = 2000.0
                            base_volatility = 0.02
                        elif asset == 'BTC':
                            base_price = 40000.0
                            base_volatility = 0.018
                        elif asset in ['USDC', 'DAI']:
                            base_price = 1.0
                            base_volatility = 0.001
                        else:
                            base_price = 100.0
                            base_volatility = 0.02
                    
                    # Simulate price change
                    price_change = np.random.normal(0, base_volatility)
                    current_price = base_price * (1 + price_change)
                    
                    # Calculate new volatility with some mean reversion
                    volatility = base_volatility * 0.8 + np.random.normal(0, 0.005)
                    volatility = max(0.001, min(0.1, volatility))  # Keep in reasonable range
                    
                    # Store in market data
                    self.market_data[asset] = {
                        'current_price': current_price,
                        'volatility': volatility,
                        'last_updated': current_time,
                        'simulated': True
                    }
                    
                    # Simulate price history if needed
                    if asset not in self.price_history:
                        # Generate simulated history
                        days = 30
                        price_series = [current_price]
                        for i in range(days-1):
                            prev_price = price_series[0]
                            daily_return = np.random.normal(0, volatility)
                            price = prev_price / (1 + daily_return)  # Working backwards
                            price_series.insert(0, price)
                        
                        timestamps = [
                            (datetime.now() - timedelta(days=days-i)).timestamp()
                            for i in range(days)
                        ]
                        
                        returns = np.diff(price_series) / price_series[:-1]
                        
                        self.price_history[asset] = {
                            'prices': price_series,
                            'timestamps': timestamps,
                            'returns': returns.tolist(),
                            'simulated': True
                        }
                    
                    logger.debug(f"Simulated market data for {asset}: price=${current_price:.2f}, volatility={volatility:.4f}")
            except Exception as e:
                logger.error(f"Error updating market data for {asset}: {e}")
        
        self.last_data_update = current_time
        logger.info("Market data update completed")
    
    def predict_liquidation_scenarios(
        self, 
        user_data: Dict[str, Any],
        risk_score: float
    ) -> Dict[str, Any]:
        """
        Generate comprehensive liquidation predictions for a user.
        
        Args:
            user_data: User data dictionary
            risk_score: User risk score (0-100)
            
        Returns:
            Dictionary of liquidation predictions
        """
        logger.info(f"Generating liquidation predictions for user {user_data.get('address')}")
        
        # Update market data
        self._update_market_data()
        
        # Extract user position data
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        collateral_ratio = user_data.get('collateral_ratio', 1.5)
        
        # Skip prediction if user has no loans
        if current_borrows <= 0:
            logger.info(f"User {user_data.get('address')} has no borrows, skipping liquidation prediction")
            return {
                'liquidationRisk': 0.0,
                'scenario_predictions': {},
                'monte_carlo_results': {},
                'message': 'No active loans, no liquidation risk'
            }
        
        # Determine primary asset type (default to IOTA)
        primary_asset = user_data.get('primary_asset_type', 'IOTA')
        
        # Get asset volatility and price
        asset_data = self.market_data.get(primary_asset, {})
        asset_volatility = asset_data.get('volatility', 0.025)
        
        # Calculate base liquidation risk using distance to liquidation threshold
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        distance_to_liquidation = collateral_ratio - liquidation_threshold
        
        # Higher volatility and closer to threshold = higher risk
        base_liquidation_risk = self._calculate_base_liquidation_risk(
            distance_to_liquidation, 
            asset_volatility
        )
        
        # Adjust based on risk score
        risk_factor = self._calculate_risk_factor(
            risk_score, 
            collateral_ratio, 
            asset_volatility
        )
        
        # Run Monte Carlo simulation for various scenarios
        scenario_predictions = {}
        for scenario_name, scenario in self.market_scenarios.items():
            scenario_prediction = self._simulate_scenario(
                user_data, 
                scenario, 
                scenario_name,
                primary_asset
            )
            scenario_predictions[scenario_name] = scenario_prediction
        
        # Run more detailed Monte Carlo simulation for current market
        monte_carlo_results = self._run_monte_carlo_simulation(
            user_data,
            primary_asset
        )
        
        # Get the current most relevant scenario
        current_scenario = self._determine_current_scenario()
        
        # Use predictions from the most relevant scenario
        if current_scenario in scenario_predictions:
            current_prediction = scenario_predictions[current_scenario]
            liquidation_risk = current_prediction.get('liquidation_probability', base_liquidation_risk)
        else:
            liquidation_risk = base_liquidation_risk
        
        # Generate timeline of risk levels
        timeline = self._generate_risk_timeline(
            user_data,
            monte_carlo_results,
            days=self.config.get('forecast_days', 7)
        )
        
        # Final liquidation prediction
        prediction = {
            'liquidationRisk': liquidation_risk,
            'riskFactor': risk_factor,
            'currentScenario': current_scenario,
            'scenario_predictions': scenario_predictions,
            'monte_carlo_results': monte_carlo_results,
            'timeline': timeline,
            'asset': primary_asset,
            'volatility': asset_volatility,
            'currentRatio': collateral_ratio,
            'liquidationThreshold': liquidation_threshold,
            'distanceToLiquidation': distance_to_liquidation,
            'preventive_actions': self._recommend_preventive_actions(
                liquidation_risk,
                user_data,
                monte_carlo_results
            ),
            'analysis': self._generate_analysis(
                liquidation_risk, 
                scenario_predictions,
                monte_carlo_results
            )
        }
        
        logger.info(f"Generated liquidation prediction for {user_data.get('address')}: " +
                   f"risk={liquidation_risk:.4f}, scenario={current_scenario}")
        
        return prediction
    
    def predict_market_scenarios(
        self,
        user_profile: Dict[str, Any],
        custom_scenarios: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Predict liquidation probability under specified market scenarios.
        
        Args:
            user_profile: User risk profile
            custom_scenarios: List of custom scenario dictionaries (optional)
            
        Returns:
            Dictionary with scenario predictions
        """
        logger.info(f"Predicting market scenarios for user {user_profile.get('address')}")
        
        # Extract user data from profile
        user_data = {
            'address': user_profile.get('address'),
            'collateral_ratio': user_profile.get('collateralRatio', 1.5),
            'current_collaterals': user_profile.get('currentCollaterals', 1000),
            'current_borrows': user_profile.get('currentBorrows', 500),
            'primary_asset_type': user_profile.get('primaryAsset', 'IOTA')
        }
        
        risk_score = user_profile.get('riskScore', 50)
        
        # If there are no custom scenarios, use the standard scenarios
        if not custom_scenarios:
            return self.predict_liquidation_scenarios(user_data, risk_score)
        
        # Process custom scenarios
        scenario_predictions = {}
        
        for i, scenario_config in enumerate(custom_scenarios):
            scenario_name = scenario_config.get('name', f'custom_scenario_{i+1}')
            
            # Extract scenario parameters
            scenario = {
                'price_change_mean': scenario_config.get('price_change', 0.0),
                'price_change_std': scenario_config.get('volatility', 0.02),
                'volatility_change': scenario_config.get('volatility_change', 0.0),
                'duration_days': scenario_config.get('duration_days', 7)
            }
            
            # Run simulation for this scenario
            scenario_prediction = self._simulate_scenario(
                user_data,
                scenario,
                scenario_name,
                user_data.get('primary_asset_type', 'IOTA')
            )
            
            scenario_predictions[scenario_name] = scenario_prediction
        
        # Find worst-case scenario
        worst_case = max(
            scenario_predictions.items(),
            key=lambda x: x[1].get('liquidation_probability', 0)
        )
        
        # Find best-case scenario
        best_case = min(
            scenario_predictions.items(),
            key=lambda x: x[1].get('liquidation_probability', 0)
        )
        
        # Calculate average risk across scenarios
        avg_risk = np.mean([
            s.get('liquidation_probability', 0)
            for s in scenario_predictions.values()
        ])
        
        # Return consolidated results
        return {
            'scenarios': scenario_predictions,
            'worstCaseScenario': {
                'name': worst_case[0],
                'liquidationRisk': worst_case[1].get('liquidation_probability', 0)
            },
            'bestCaseScenario': {
                'name': best_case[0],
                'liquidationRisk': best_case[1].get('liquidation_probability', 0)
            },
            'averageRisk': avg_risk,
            'analysis': self._generate_scenario_analysis(scenario_predictions),
            'preventive_actions': self._recommend_scenario_actions(
                scenario_predictions,
                user_data
            )
        }
    
    def stress_test_position(
        self,
        user_address: str,
        collateral_ratio: float,
        asset_type: str,
        loan_amount: float
    ) -> Dict[str, Any]:
        """
        Perform stress testing on a user's position.
        
        Args:
            user_address: User's address
            collateral_ratio: Collateralization ratio to test
            asset_type: Type of collateral asset
            loan_amount: Amount of the loan
            
        Returns:
            Stress test results
        """
        logger.info(f"Stress testing position for user {user_address}")
        
        # Update market data
        self._update_market_data()
        
        # Create user data structure for testing
        user_data = {
            'address': user_address,
            'collateral_ratio': collateral_ratio,
            'current_collaterals': loan_amount * collateral_ratio,
            'current_borrows': loan_amount,
            'primary_asset_type': asset_type
        }
        
        # Use a middle-of-the-road risk score for stress testing
        risk_score = 50
        
        # Define stress scenarios
        stress_scenarios = [
            {
                'name': 'moderate_stress',
                'price_change': -0.15,  # 15% price drop
                'volatility': 0.03,
                'volatility_change': 0.1,
                'duration_days': 7
            },
            {
                'name': 'severe_stress',
                'price_change': -0.3,  # 30% price drop
                'volatility': 0.05,
                'volatility_change': 0.3,
                'duration_days': 7
            },
            {
                'name': 'extreme_stress',
                'price_change': -0.5,  # 50% price drop
                'volatility': 0.08,
                'volatility_change': 0.5,
                'duration_days': 7
            },
            {
                'name': 'flash_crash',
                'price_change': -0.3,  # 30% price drop
                'volatility': 0.1,
                'volatility_change': 1.0,
                'duration_days': 1
            }
        ]
        
        # Test position against stress scenarios
        result = self.predict_market_scenarios(
            {'address': user_address, 'riskScore': risk_score, 'collateralRatio': collateral_ratio,
             'currentCollaterals': user_data['current_collaterals'], 'currentBorrows': loan_amount,
             'primaryAsset': asset_type},
            stress_scenarios
        )
        
        # Add stress test specific information
        result['stressTestSummary'] = {
            'positionSurvived': result['worstCaseScenario']['liquidationRisk'] < 0.5,
            'maxSurvivableDropPercentage': self._calculate_max_drop(user_data, asset_type),
            'daysToUnsustainability': self._estimate_days_to_unsustainability(user_data, asset_type),
            'recommendedMinimumRatio': self._recommend_minimum_ratio(
                result['scenarios'],
                user_data,
                asset_type
            )
        }
        
        logger.info(f"Completed stress test for {user_address}: " +
                   f"position survived: {result['stressTestSummary']['positionSurvived']}")
        
        return result
    
    def _calculate_base_liquidation_risk(
        self,
        distance_to_liquidation: float,
        asset_volatility: float
    ) -> float:
        """
        Calculate base liquidation risk based on distance to liquidation threshold
        and asset volatility.
        
        Args:
            distance_to_liquidation: Distance from current ratio to liquidation threshold
            asset_volatility: Volatility of the collateral asset
            
        Returns:
            Base liquidation risk (probability from 0 to 1)
        """
        if distance_to_liquidation <= 0:
            # Already below liquidation threshold
            return 1.0
        
        # Calculate probability using normal distribution
        # Assume daily price changes are normally distributed
        # The probability of crossing the liquidation threshold is the
        # probability of a price drop larger than distance_to_liquidation
        
        # Standardize the distance (z-score)
        z_score = distance_to_liquidation / asset_volatility
        
        # Calculate probability of exceeding this distance (one-tailed)
        # Using cumulative distribution function of standard normal
        probability = 1 - norm.cdf(z_score)
        
        return probability
    
    def _calculate_risk_factor(
        self,
        risk_score: float,
        collateral_ratio: float,
        asset_volatility: float
    ) -> float:
        """
        Calculate combined risk factor based on user risk score and position factors.
        
        Args:
            risk_score: User risk score (0-100)
            collateral_ratio: Collateralization ratio
            asset_volatility: Volatility of the collateral asset
            
        Returns:
            Combined risk factor (0 to 1)
        """
        # Normalize risk score to 0-1 range
        normalized_risk_score = risk_score / 100.0
        
        # Get weights from config
        weights = self.config.get('risk_factor_weights', {
            'collateral_ratio': 0.35,
            'market_volatility': 0.25,
            'user_risk_score': 0.15
        })
        
        # Calculate collateral ratio factor (lower ratio = higher risk)
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        max_ratio = 3.0  # Assume 3.0 as maximum reasonable collateral ratio
        
        collateral_factor = 1.0 - min(1.0, (collateral_ratio - liquidation_threshold) / 
                                    (max_ratio - liquidation_threshold))
        
        # Calculate volatility factor (higher volatility = higher risk)
        max_volatility = 0.1  # Assume 10% as high volatility
        volatility_factor = min(1.0, asset_volatility / max_volatility)
        
        # Combine factors with weights
        risk_factor = (
            weights.get('collateral_ratio', 0.35) * collateral_factor +
            weights.get('market_volatility', 0.25) * volatility_factor +
            weights.get('user_risk_score', 0.15) * normalized_risk_score
        )
        
        # Normalize to ensure 0-1 range
        risk_factor = max(0.0, min(1.0, risk_factor))
        
        return risk_factor
    
    def _simulate_scenario(
        self,
        user_data: Dict[str, Any],
        scenario: Dict[str, float],
        scenario_name: str,
        asset_type: str
    ) -> Dict[str, Any]:
        """
        Simulate a market scenario and predict liquidation probability.
        
        Args:
            user_data: User data dictionary
            scenario: Scenario parameters
            scenario_name: Name of the scenario
            asset_type: Type of collateral asset
            
        Returns:
            Scenario simulation results
        """
        # Extract scenario parameters
        price_change_mean = scenario.get('price_change_mean', 0.0)
        price_change_std = scenario.get('price_change_std', 0.02)
        volatility_change = scenario.get('volatility_change', 0.0)
        duration_days = scenario.get('duration_days', 7)
        
        # Extract user position data
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        current_ratio = user_data.get('collateral_ratio', 1.5)
        
        # Get asset data
        asset_data = self.market_data.get(asset_type, {})
        base_volatility = asset_data.get('volatility', 0.025)
        
        # Calculate adjusted volatility for this scenario
        adjusted_volatility = base_volatility * (1 + volatility_change)
        
        # Liquidation threshold
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Run Monte Carlo simulation for this scenario
        num_simulations = self.config.get('monte_carlo_simulations', 1000)
        liquidation_count = 0
        min_ratios = []
        price_paths = []
        
        # For performance, just store a few sample paths
        num_sample_paths = min(10, num_simulations)
        sample_indices = np.linspace(0, num_simulations-1, num_sample_paths, dtype=int)
        
        for i in range(num_simulations):
            # Simulate price path for duration
            price = 1.0  # Start with normalized price
            price_path = [price]
            
            for day in range(duration_days):
                # Daily price change based on scenario
                daily_return = np.random.normal(price_change_mean / duration_days, 
                                             price_change_std)
                price *= (1 + daily_return)
                price_path.append(price)
            
            # Calculate minimum collateral ratio during this path
            min_ratio = current_ratio * min(price_path)
            min_ratios.append(min_ratio)
            
            # Check if liquidation would occur
            if min_ratio < liquidation_threshold:
                liquidation_count += 1
            
            # Store sample paths
            if i in sample_indices:
                price_paths.append(price_path)
        
        # Calculate liquidation probability
        liquidation_probability = liquidation_count / num_simulations
        
        # Calculate percentiles of minimum ratios
        percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99]
        ratio_percentiles = {
            f'p{p}': np.percentile(min_ratios, p)
            for p in percentiles
        }
        
        # Result dictionary
        result = {
            'scenario': scenario_name,
            'liquidation_probability': liquidation_probability,
            'min_ratio_percentiles': ratio_percentiles,
            'expected_min_ratio': np.mean(min_ratios),
            'ratio_std': np.std(min_ratios),
            'price_change_mean': price_change_mean,
            'price_change_std': price_change_std,
            'adjusted_volatility': adjusted_volatility,
            'base_volatility': base_volatility,
            'volatility_change': volatility_change,
            'duration_days': duration_days,
            'sample_paths': price_paths
        }
        
        return result
    
    def _run_monte_carlo_simulation(
        self,
        user_data: Dict[str, Any],
        asset_type: str
    ) -> Dict[str, Any]:
        """
        Run a detailed Monte Carlo simulation for liquidation prediction.
        
        Args:
            user_data: User data dictionary
            asset_type: Type of collateral asset
            
        Returns:
            Monte Carlo simulation results
        """
        # Extract user position data
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        current_ratio = user_data.get('collateral_ratio', 1.5)
        
        # Get asset data
        asset_data = self.market_data.get(asset_type, {})
        volatility = asset_data.get('volatility', 0.025)
        
        # Get asset price history if available
        asset_history = self.price_history.get(asset_type, {})
        returns = asset_history.get('returns', [])
        
        # Number of days to simulate
        days = self.config.get('forecast_days', 7)
        
        # Use historical returns distribution if available
        if returns and len(returns) > 30:
            # Use bootstrap resampling from historical returns
            use_historical = True
            samples = returns
        else:
            # Use normal distribution with estimated parameters
            use_historical = False
            mean_return = 0.0  # Assume zero mean return
            std_return = volatility
        
        # Run Monte Carlo simulation
        num_simulations = self.config.get('monte_carlo_simulations', 1000)
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Arrays to store results
        liquidation_days = []  # Day on which liquidation occurred
        min_ratios = []        # Minimum ratio during simulation
        end_ratios = []        # Final ratio at end of simulation
        
        # Keep track of liquidation probability per day
        daily_liquidation_probs = np.zeros(days + 1)
        daily_ratio_percentiles = {p: np.zeros(days + 1) for p in [5, 25, 50, 75, 95]}
        
        # Sample paths for visualization (just store a few)
        num_sample_paths = 10
        sample_paths = []
        sample_indices = np.linspace(0, num_simulations-1, num_sample_paths, dtype=int)
        
        # Run simulations
        for i in range(num_simulations):
            # Simulate price path
            price = 1.0  # Start with normalized price
            ratio = current_ratio
            liquidated = False
            liquidation_day = days + 1  # Default if never liquidated
            
            price_path = [price]
            ratio_path = [ratio]
            
            for day in range(1, days + 1):
                # Generate daily return
                if use_historical:
                    # Sample from historical returns
                    daily_return = np.random.choice(samples)
                else:
                    # Generate from normal distribution
                    daily_return = np.random.normal(mean_return, std_return)
                
                # Update price and ratio
                price *= (1 + daily_return)
                ratio = current_ratio * price
                
                price_path.append(price)
                ratio_path.append(ratio)
                
                # Check for liquidation
                if ratio < liquidation_threshold and not liquidated:
                    liquidated = True
                    liquidation_day = day
                
                # Accumulate daily liquidation count
                if liquidated and liquidation_day == day:
                    daily_liquidation_probs[day] += 1
            
            # Store results
            if liquidated:
                liquidation_days.append(liquidation_day)
            
            min_ratios.append(min(ratio_path))
            end_ratios.append(ratio_path[-1])
            
            # Add all ratio paths to daily percentile tracking
            for day, ratio in enumerate(ratio_path):
                for p in [5, 25, 50, 75, 95]:
                    # This is a simplification - we'll calculate proper percentiles later
                    daily_ratio_percentiles[p][day] += ratio
            
            # Store sample paths
            if i in sample_indices:
                sample_paths.append({
                    'prices': price_path,
                    'ratios': ratio_path,
                    'liquidated': liquidated,
                    'liquidation_day': liquidation_day if liquidated else None
                })
        
        # Calculate overall liquidation probability
        liquidation_probability = len(liquidation_days) / num_simulations
        
        # Calculate daily liquidation probabilities
        daily_liquidation_probs = daily_liquidation_probs / num_simulations
        
        # Calculate cumulative liquidation probabilities
        cumulative_liquidation_probs = np.cumsum(daily_liquidation_probs)
        
        # Calculate proper daily ratio percentiles
        all_ratios = np.zeros((num_simulations, days + 1))
        for i in range(num_simulations):
            # Simulate price path again
            price = 1.0
            ratio = current_ratio
            all_ratios[i, 0] = ratio
            
            for day in range(1, days + 1):
                if use_historical:
                    daily_return = np.random.choice(samples)
                else:
                    daily_return = np.random.normal(mean_return, std_return)
                
                price *= (1 + daily_return)
                ratio = current_ratio * price
                all_ratios[i, day] = ratio
        
        # Calculate percentiles for each day
        percentile_paths = {}
        for p in [5, 25, 50, 75, 95]:
            percentile_paths[p] = np.percentile(all_ratios, p, axis=0)
        
        # Return simulation results
        return {
            'liquidation_probability': liquidation_probability,
            'daily_liquidation_probs': daily_liquidation_probs.tolist(),
            'cumulative_liquidation_probs': cumulative_liquidation_probs.tolist(),
            'percentile_paths': percentile_paths,
            'min_ratio_statistics': {
                'mean': np.mean(min_ratios),
                'std': np.std(min_ratios),
                'min': np.min(min_ratios),
                'max': np.max(min_ratios),
                'p5': np.percentile(min_ratios, 5),
                'p25': np.percentile(min_ratios, 25),
                'p50': np.percentile(min_ratios, 50),
                'p75': np.percentile(min_ratios, 75),
                'p95': np.percentile(min_ratios, 95)
            },
            'end_ratio_statistics': {
                'mean': np.mean(end_ratios),
                'std': np.std(end_ratios),
                'min': np.min(end_ratios),
                'max': np.max(end_ratios),
                'p5': np.percentile(end_ratios, 5),
                'p25': np.percentile(end_ratios, 25),
                'p50': np.percentile(end_ratios, 50),
                'p75': np.percentile(end_ratios, 75),
                'p95': np.percentile(end_ratios, 95)
            },
            'sample_paths': sample_paths,
            'days_simulated': days,
            'num_simulations': num_simulations,
            'liquidation_threshold': liquidation_threshold,
            'volatility': volatility
        }
    
    def _determine_current_scenario(self) -> str:
        """
        Determine which market scenario is currently most relevant.
        
        Returns:
            Name of the current scenario
        """
        # This could be enhanced with a more sophisticated approach
        # For now, we'll use IOTA volatility as a proxy
        
        if 'IOTA' in self.market_data:
            volatility = self.market_data['IOTA'].get('volatility', 0.025)
            
            # Check recent price history to determine trend
            if 'IOTA' in self.price_history:
                prices = self.price_history['IOTA'].get('prices', [])
                if len(prices) > 7:
                    recent_change = (prices[-1] / prices[-7] - 1)  # 7-day change
                    
                    if recent_change > 0.1 and volatility > 0.04:
                        return 'extreme_bull'
                    elif recent_change > 0.05:
                        return 'bull'
                    elif recent_change < -0.1 and volatility > 0.04:
                        return 'extreme_bear'
                    elif recent_change < -0.05:
                        return 'bear'
                    elif volatility > 0.04:
                        return 'high_volatility'
            
            # Default based just on volatility
            if volatility > 0.04:
                return 'high_volatility'
        
        # Default scenario
        return 'normal'
    
    def _generate_risk_timeline(
        self,
        user_data: Dict[str, Any],
        monte_carlo_results: Dict[str, Any],
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Generate a timeline of risk levels.
        
        Args:
            user_data: User data dictionary
            monte_carlo_results: Monte Carlo simulation results
            days: Number of days in timeline
            
        Returns:
            List of daily risk assessments
        """
        # Extract probabilities from MC results
        daily_probs = monte_carlo_results.get('daily_liquidation_probs', [])
        cumulative_probs = monte_carlo_results.get('cumulative_liquidation_probs', [])
        
        # Get percentile paths
        percentile_paths = monte_carlo_results.get('percentile_paths', {})
        
        # Generate timeline entries
        timeline = []
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        for day in range(days + 1):
            # Skip day 0 (current day)
            if day == 0:
                continue
                
            if day < len(daily_probs) and day < len(cumulative_probs):
                daily_prob = daily_probs[day]
                cumulative_prob = cumulative_probs[day]
                
                # Get ratio from percentile paths
                median_ratio = percentile_paths.get(50, [])[day] if 50 in percentile_paths else None
                lower_ratio = percentile_paths.get(5, [])[day] if 5 in percentile_paths else None
                upper_ratio = percentile_paths.get(95, [])[day] if 95 in percentile_paths else None
                
                # Determine risk level
                risk_level = 'low'
                if cumulative_prob > 0.5:
                    risk_level = 'very_high'
                elif cumulative_prob > 0.25:
                    risk_level = 'high'
                elif cumulative_prob > 0.1:
                    risk_level = 'medium'
                
                timeline.append({
                    'day': day,
                    'date': (datetime.now() + timedelta(days=day)).strftime('%Y-%m-%d'),
                    'daily_liquidation_probability': daily_prob,
                    'cumulative_liquidation_probability': cumulative_prob,
                    'median_ratio': median_ratio,
                    'lower_ratio': lower_ratio,
                    'upper_ratio': upper_ratio,
                    'risk_level': risk_level,
                    'is_critical': median_ratio is not None and median_ratio < liquidation_threshold * 1.2
                })
        
        return timeline
    
    def _recommend_preventive_actions(
        self,
        liquidation_risk: float,
        user_data: Dict[str, Any],
        monte_carlo_results: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Recommend preventive actions based on liquidation risk.
        
        Args:
            liquidation_risk: Calculated liquidation risk
            user_data: User data dictionary
            monte_carlo_results: Monte Carlo simulation results
            
        Returns:
            List of recommended preventive actions
        """
        recommendations = []
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        current_ratio = user_data.get('collateral_ratio', 1.5)
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Default minimum safe ratio (higher if higher risk)
        if liquidation_risk > 0.5:
            min_safe_ratio = 1.8  # High safety margin
        elif liquidation_risk > 0.25:
            min_safe_ratio = 1.6  # Moderately high margin
        elif liquidation_risk > 0.1:
            min_safe_ratio = 1.4  # Medium margin
        else:
            min_safe_ratio = 1.3  # Lower but still safe margin
        
        # Recommend adding collateral if below safe ratio
        if current_ratio < min_safe_ratio:
            additional_collateral = (min_safe_ratio * current_borrows) - current_collateral
            
            recommendations.append({
                'action': 'add_collateral',
                'description': f'Add {additional_collateral:.2f} collateral to reach a safer ratio of {min_safe_ratio:.2f}',
                'target_ratio': min_safe_ratio,
                'amount': additional_collateral,
                'urgency': 'high' if liquidation_risk > 0.25 else 'medium',
                'impact': 'high'
            })
        
        # Recommend reducing debt if collateralization is tight
        if liquidation_risk > 0.1:
            # Suggest repaying some percentage of the loan
            repay_percentage = 0.2 if liquidation_risk > 0.4 else 0.1
            repay_amount = current_borrows * repay_percentage
            
            new_borrows = current_borrows - repay_amount
            new_ratio = current_collateral / new_borrows if new_borrows > 0 else 999
            
            recommendations.append({
                'action': 'repay_debt',
                'description': f'Repay {repay_amount:.2f} ({repay_percentage * 100:.0f}% of your loan) to improve your collateral ratio to {new_ratio:.2f}',
                'amount': repay_amount,
                'new_ratio': new_ratio,
                'urgency': 'high' if liquidation_risk > 0.25 else 'medium',
                'impact': 'high'
            })
        
        # Check for critical periods in the timeline
        min_ratio_p5 = monte_carlo_results.get('min_ratio_statistics', {}).get('p5')
        if min_ratio_p5 and min_ratio_p5 < liquidation_threshold * 1.1:
            # 5% chance of getting very close to liquidation
            recommendations.append({
                'action': 'prepare_funds',
                'description': 'Keep funds ready for emergency collateral addition as your position has a risk of approaching liquidation',
                'urgency': 'medium',
                'impact': 'medium',
                'min_recommended_reserve': current_collateral * 0.2
            })
        
        # If risk is very low, suggest optimizing
        if liquidation_risk < 0.01 and current_ratio > 2.0:
            optimize_ratio = max(current_ratio * 0.8, 1.5)
            freed_collateral = current_collateral - (optimize_ratio * current_borrows)
            
            recommendations.append({
                'action': 'optimize_collateral',
                'description': f'You may safely reduce your collateral by {freed_collateral:.2f} to a ratio of {optimize_ratio:.2f} for better capital efficiency',
                'target_ratio': optimize_ratio,
                'amount': freed_collateral,
                'urgency': 'low',
                'impact': 'medium'
            })
        
        return recommendations
    
    def _generate_analysis(
        self,
        liquidation_risk: float,
        scenario_predictions: Dict[str, Dict[str, Any]],
        monte_carlo_results: Dict[str, Any]
    ) -> str:
        """
        Generate a human-readable analysis of liquidation risk.
        
        Args:
            liquidation_risk: Calculated liquidation risk
            scenario_predictions: Scenario prediction results
            monte_carlo_results: Monte Carlo simulation results
            
        Returns:
            Analysis text
        """
        # Determine risk level text
        if liquidation_risk > 0.5:
            risk_text = "very high"
        elif liquidation_risk > 0.25:
            risk_text = "high"
        elif liquidation_risk > 0.1:
            risk_text = "moderate"
        elif liquidation_risk > 0.01:
            risk_text = "low"
        else:
            risk_text = "very low"
        
        # Find worst and best scenarios
        if scenario_predictions:
            worst_scenario = max(
                scenario_predictions.items(),
                key=lambda x: x[1].get('liquidation_probability', 0)
            )
            
            best_scenario = min(
                scenario_predictions.items(),
                key=lambda x: x[1].get('liquidation_probability', 0)
            )
            
            worst_name = worst_scenario[0]
            worst_prob = worst_scenario[1].get('liquidation_probability', 0)
            
            best_name = best_scenario[0]
            best_prob = best_scenario[1].get('liquidation_probability', 0)
        else:
            worst_name = "unknown"
            worst_prob = liquidation_risk
            best_name = "unknown"
            best_prob = liquidation_risk
        
        # Get some statistics from Monte Carlo
        mc_stats = monte_carlo_results.get('min_ratio_statistics', {})
        min_ratio_p5 = mc_stats.get('p5')
        
        # Construct analysis
        analysis = f"Your position currently has a {risk_text} liquidation risk of {liquidation_risk:.1%}. "
        
        if liquidation_risk > 0.1:
            analysis += f"The highest risk would be under a {worst_name} scenario, with a {worst_prob:.1%} chance of liquidation. "
            analysis += f"Even in the most favorable {best_name} scenario, there is still a {best_prob:.1%} chance of liquidation. "
            
            if min_ratio_p5:
                analysis += f"In the worst 5% of cases, your collateral ratio could fall to {min_ratio_p5:.2f}. "
                
            analysis += "Consider adding more collateral or reducing your borrowed amount to secure your position."
        else:
            analysis += f"Even in a {worst_name} scenario, the liquidation risk is only {worst_prob:.1%}. "
            
            if min_ratio_p5 and min_ratio_p5 > 1.2:
                analysis += f"In 95% of simulated cases, your collateral ratio stays above {min_ratio_p5:.2f}, providing a good safety margin. "
                
            analysis += "Your position appears to be adequately collateralized based on current market conditions."
        
        return analysis
    
    def _generate_scenario_analysis(
        self,
        scenario_predictions: Dict[str, Dict[str, Any]]
    ) -> str:
        """
        Generate analysis for market scenario predictions.
        
        Args:
            scenario_predictions: Scenario prediction results
            
        Returns:
            Analysis text
        """
        # Find scenarios above certain risk thresholds
        high_risk_scenarios = [
            name for name, data in scenario_predictions.items()
            if data.get('liquidation_probability', 0) > 0.25
        ]
        
        moderate_risk_scenarios = [
            name for name, data in scenario_predictions.items()
            if 0.1 < data.get('liquidation_probability', 0) <= 0.25
        ]
        
        low_risk_scenarios = [
            name for name, data in scenario_predictions.items()
            if data.get('liquidation_probability', 0) <= 0.1
        ]
        
        # Construct analysis
        analysis = "Scenario Analysis: "
        
        if high_risk_scenarios:
            analysis += f"Your position faces significant risk in the following scenarios: {', '.join(high_risk_scenarios)}. "
        
        if moderate_risk_scenarios:
            analysis += f"There is moderate risk in these scenarios: {', '.join(moderate_risk_scenarios)}. "
        
        if low_risk_scenarios:
            analysis += f"Your position appears safe in these scenarios: {', '.join(low_risk_scenarios)}. "
        
        # Add recommendations based on scenarios
        if high_risk_scenarios:
            analysis += "Consider strengthening your position with additional collateral to protect against high-risk market movements."
        elif moderate_risk_scenarios and not high_risk_scenarios:
            analysis += "Your position is moderately robust but could benefit from some additional collateral to ensure safety in all scenarios."
        elif low_risk_scenarios and not moderate_risk_scenarios and not high_risk_scenarios:
            analysis += "Your position appears to be well-protected across all tested market scenarios."
        
        return analysis
    
    def _recommend_scenario_actions(
        self,
        scenario_predictions: Dict[str, Dict[str, Any]],
        user_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate recommended actions based on scenario analysis.
        
        Args:
            scenario_predictions: Scenario prediction results
            user_data: User data dictionary
            
        Returns:
            List of recommended actions
        """
        recommendations = []
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        current_ratio = user_data.get('collateral_ratio', 1.5)
        
        # Find worst-case scenario
        worst_case = max(
            scenario_predictions.items(),
            key=lambda x: x[1].get('liquidation_probability', 0)
        )
        
        worst_name = worst_case[0]
        worst_prob = worst_case[1].get('liquidation_probability', 0)
        worst_min_ratio = worst_case[1].get('min_ratio_percentiles', {}).get('p5', 1.0)
        
        # Calculate additional collateral for worst-case scenario
        if worst_prob > 0.1:
            safe_ratio = 1.2  # Target safe ratio
            if worst_min_ratio < safe_ratio:
                # Calculate what ratio we'd need to stay above safe_ratio in worst case
                current_to_worst_ratio = worst_min_ratio / current_ratio
                target_ratio = safe_ratio / current_to_worst_ratio
                
                additional_collateral = (target_ratio * current_borrows) - current_collateral
                
                recommendations.append({
                    'action': 'add_scenario_collateral',
                    'description': f'Add {additional_collateral:.2f} collateral to protect against the {worst_name} scenario',
                    'scenario': worst_name,
                    'target_ratio': target_ratio,
                    'amount': additional_collateral,
                    'urgency': 'high' if worst_prob > 0.25 else 'medium',
                    'impact': 'high'
                })
        
        # Check for hedge opportunities
        if 'bear' in worst_name or 'extreme_bear' in worst_name:
            recommendations.append({
                'action': 'hedge_position',
                'description': 'Consider hedging your position with a short position or options to protect against price declines',
                'urgency': 'medium',
                'impact': 'medium',
                'hedge_type': 'short',
                'hedge_amount': current_collateral * 0.5  # Hedge half of collateral value
            })
        
        # If high volatility is a concern
        if 'high_volatility' in scenario_predictions and \
           scenario_predictions['high_volatility'].get('liquidation_probability', 0) > 0.2:
            recommendations.append({
                'action': 'volatility_hedge',
                'description': 'Consider volatility hedging strategies such as options to protect against market turbulence',
                'urgency': 'medium',
                'impact': 'medium'
            })
        
        return recommendations
    
    def _calculate_max_drop(
        self,
        user_data: Dict[str, Any],
        asset_type: str
    ) -> float:
        """
        Calculate maximum price drop percentage that the position can survive.
        
        Args:
            user_data: User data dictionary
            asset_type: Type of collateral asset
            
        Returns:
            Maximum sustainable price drop percentage
        """
        current_ratio = user_data.get('collateral_ratio', 1.5)
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Maximum sustainable drop is the percentage drop that would bring the ratio to the threshold
        if current_ratio > liquidation_threshold:
            max_drop = 1.0 - (liquidation_threshold / current_ratio)
        else:
            max_drop = 0.0  # Already at or below threshold
            
        return max_drop * 100.0  # Convert to percentage
    
    def _estimate_days_to_unsustainability(
        self,
        user_data: Dict[str, Any],
        asset_type: str
    ) -> Union[float, str]:
        """
        Estimate days until position becomes unsustainable given current market conditions.
        
        Args:
            user_data: User data dictionary
            asset_type: Type of collateral asset
            
        Returns:
            Estimated days or 'stable' if position appears sustainable
        """
        current_ratio = user_data.get('collateral_ratio', 1.5)
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Get asset volatility
        asset_data = self.market_data.get(asset_type, {})
        volatility = asset_data.get('volatility', 0.025)
        
        # If already close to threshold, position is already at risk
        if current_ratio < liquidation_threshold * 1.05:
            return 0  # Immediate risk
            
        # Distance to liquidation
        distance = current_ratio - liquidation_threshold
        
        # Using a simplified model based on random walk
        # In a random walk with no drift, expected time to reach barrier is proportional to square of distance
        # Adjust for volatility - higher volatility means faster to reach barrier
        expected_days = (distance * distance) / (volatility * volatility)
        
        # If expected days is very large, position is effectively stable
        if expected_days > 365:
            return 'stable'
            
        return round(expected_days, 1)
    
    def _recommend_minimum_ratio(
        self,
        scenario_results: Dict[str, Dict[str, Any]],
        user_data: Dict[str, Any],
        asset_type: str
    ) -> float:
        """
        Recommend minimum collateralization ratio based on scenario analysis.
        
        Args:
            scenario_results: Results from scenario predictions
            user_data: User data dictionary
            asset_type: Type of collateral asset
            
        Returns:
            Recommended minimum collateralization ratio
        """
        # Find worst-case scenario
        worst_case = max(
            scenario_results.items(),
            key=lambda x: x[1].get('liquidation_probability', 0)
        )
        
        worst_prob = worst_case[1].get('liquidation_probability', 0)
        
        # Get asset volatility
        asset_data = self.market_data.get(asset_type, {})
        volatility = asset_data.get('volatility', 0.025)
        
        # Base minimum ratio on liquidation threshold
        liquidation_threshold = self.config.get('liquidation_threshold', 1.0)
        
        # Higher volatility and higher risk warrant higher safety margin
        safety_margin = 0.2  # Base safety margin
        
        # Adjust for volatility
        volatility_adjustment = volatility * 2.0  # 2x volatility as safety
        
        # Adjust for worst-case scenario risk
        risk_adjustment = worst_prob * 0.5  # Up to 0.5 additional margin for high risk
        
        # Calculate recommended minimum
        min_ratio = liquidation_threshold + safety_margin + volatility_adjustment + risk_adjustment
        
        # Ensure reasonable bounds
        min_ratio = max(1.2, min(3.0, min_ratio))
        
        return min_ratio


# Main function for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IntelliLend Liquidation Predictor")
    parser.add_argument("--config", type=str, default="config/liquidation_config.json", help="Path to configuration file")
    parser.add_argument("--address", type=str, default="0x0123456789abcdef0123456789abcdef01234567", help="User address")
    parser.add_argument("--collateral-ratio", type=float, default=1.5, help="Current collateralization ratio")
    parser.add_argument("--asset", type=str, default="IOTA", help="Asset type")
    parser.add_argument("--risk-score", type=float, default=50.0, help="User risk score (0-100)")
    args = parser.parse_args()
    
    # Create predictor
    predictor = LiquidationPredictor(args.config)
    
    # Simulate user data
    user_data = {
        'address': args.address,
        'collateral_ratio': args.collateral_ratio,
        'current_collaterals': 1000,
        'current_borrows': 1000 / args.collateral_ratio,
        'primary_asset_type': args.asset
    }
    
    # Get predictions
    predictions = predictor.predict_liquidation_scenarios(user_data, args.risk_score)
    
    # Print results
    print(json.dumps(predictions, indent=2))
