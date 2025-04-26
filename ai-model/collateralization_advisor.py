#!/usr/bin/env python
"""
IntelliLend Collateralization Advisor

This module provides personalized collateralization ratio recommendations
based on asset volatility, user risk profiles, and market conditions.
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

# Import IOTA connection for real-time data
from ai_iota_connection import get_iota_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("collateralization_advisor.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("collateralization_advisor")

class CollateralizationAdvisor:
    """
    Provides personalized collateralization ratio recommendations 
    based on asset volatility and user risk profiles.
    """
    
    def __init__(self, config_path: str = 'config/collateralization_config.json'):
        """
        Initialize the collateralization advisor with configuration.
        
        Args:
            config_path: Path to configuration file
        """
        logger.info("Initializing Collateralization Advisor")
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize asset volatility tracking
        self.asset_volatility = self._initialize_asset_volatility()
        
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
        
        # Last time asset volatility was updated
        self.last_volatility_update = 0
        self.volatility_update_interval = self.config.get('volatility_update_interval', 3600)  # 1 hour default
        
        logger.info("Collateralization Advisor initialized successfully")
    
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
                'base_collateral_ratio': 1.5,
                'risk_adjustment_factor': 0.1,
                'volatility_adjustment_factor': 0.5,
                'min_collateral_ratio': 1.1,
                'max_collateral_ratio': 3.0,
                'volatility_update_interval': 3600,
                'iota_connection_config': 'config/iota_connection_config.json',
                'asset_config': {
                    'IOTA': {
                        'base_volatility': 0.25,
                        'risk_factor': 1.0
                    },
                    'ETH': {
                        'base_volatility': 0.2,
                        'risk_factor': 0.9
                    },
                    'BTC': {
                        'base_volatility': 0.18,
                        'risk_factor': 0.85
                    },
                    'USDC': {
                        'base_volatility': 0.01,
                        'risk_factor': 0.5
                    },
                    'DAI': {
                        'base_volatility': 0.01,
                        'risk_factor': 0.5
                    }
                },
                'market_scenario_adjustments': {
                    'bull': -0.1,    # Lower collateral requirements in bull markets
                    'neutral': 0,    # No adjustment in neutral markets
                    'bear': 0.2,     # Higher collateral requirements in bear markets
                    'extreme_volatility': 0.3  # Much higher in extreme volatility
                }
            }
    
    def _initialize_asset_volatility(self) -> Dict[str, Dict[str, float]]:
        """
        Initialize asset volatility tracking.
        
        Returns:
            Dictionary of asset volatility data
        """
        # Initialize with configured base volatilities
        assets = {}
        
        for asset, config in self.config.get('asset_config', {}).items():
            assets[asset] = {
                'current_volatility': config.get('base_volatility', 0.2),
                'historical_volatility': config.get('base_volatility', 0.2),
                'forecasted_volatility': config.get('base_volatility', 0.2),
                'risk_factor': config.get('risk_factor', 1.0),
                'last_updated': time.time()
            }
        
        return assets
    
    def get_recommendations(
        self, 
        user_data: Dict[str, Any], 
        risk_score: float
    ) -> Dict[str, Any]:
        """
        Get personalized collateralization ratio recommendations.
        
        Args:
            user_data: User data dictionary
            risk_score: User risk score (0-100)
            
        Returns:
            Recommendations dictionary
        """
        logger.info(f"Generating collateralization recommendations for user {user_data.get('address')}")
        
        # Update asset volatility if needed
        self._update_asset_volatility()
        
        # Get user's current collateral information
        current_ratio = user_data.get('collateral_ratio', 1.5)
        current_collateral = user_data.get('current_collaterals', 0)
        current_borrows = user_data.get('current_borrows', 0)
        
        # Get market conditions
        market_condition = self._assess_market_condition()
        
        # Generate a base recommended ratio based on risk score
        # Higher risk score = higher collateral ratio
        base_ratio = self.config.get('base_collateral_ratio', 1.5)
        risk_adjustment = (risk_score / 100.0) * self.config.get('risk_adjustment_factor', 0.1)
        
        # Determine the primary asset type from user data or default to IOTA
        primary_asset = user_data.get('primary_asset_type', 'IOTA')
        
        # Get asset-specific adjustments
        asset_volatility = self.asset_volatility.get(primary_asset, {})
        volatility = asset_volatility.get('current_volatility', 0.2)
        risk_factor = asset_volatility.get('risk_factor', 1.0)
        
        # Calculate volatility adjustment
        volatility_adjustment = volatility * self.config.get('volatility_adjustment_factor', 0.5)
        
        # Get market scenario adjustment
        market_adjustment = self.config.get('market_scenario_adjustments', {}).get(market_condition, 0)
        
        # Calculate recommended ratio
        recommended_ratio = base_ratio + risk_adjustment + volatility_adjustment + market_adjustment
        
        # Apply asset risk factor
        recommended_ratio *= risk_factor
        
        # Ensure within bounds
        min_ratio = self.config.get('min_collateral_ratio', 1.1)
        max_ratio = self.config.get('max_collateral_ratio', 3.0)
        recommended_ratio = max(min_ratio, min(max_ratio, recommended_ratio))
        
        # Calculate additional collateral needed if below recommended
        additional_collateral = 0
        if current_ratio < recommended_ratio and current_borrows > 0:
            additional_collateral = (recommended_ratio * current_borrows) - current_collateral
            additional_collateral = max(0, additional_collateral)
        
        # Generate recommendations
        recommendations = {
            'currentRatio': current_ratio,
            'recommendedRatio': recommended_ratio,
            'primaryAsset': primary_asset,
            'marketCondition': market_condition,
            'additionalCollateralNeeded': additional_collateral,
            'ratioComponents': {
                'baseRatio': base_ratio,
                'riskAdjustment': risk_adjustment,
                'volatilityAdjustment': volatility_adjustment,
                'marketAdjustment': market_adjustment,
                'assetRiskFactor': risk_factor
            },
            'assetVolatility': volatility,
            'marketAssessment': {
                'condition': market_condition,
                'volatilityTrend': self._get_volatility_trend(primary_asset),
                'riskLevel': self._calculate_asset_risk_level(primary_asset)
            }
        }
        
        logger.info(f"Generated collateralization recommendations for {user_data.get('address')}: " +
                   f"recommended ratio = {recommended_ratio:.2f}")
        
        return recommendations
    
    def get_asset_recommendation(
        self,
        user_profile: Dict[str, Any],
        asset_type: str,
        current_ratio: float,
        loan_amount: float
    ) -> Dict[str, Any]:
        """
        Get asset-specific collateralization recommendation.
        
        Args:
            user_profile: User risk profile
            asset_type: Asset type for collateral
            current_ratio: Current collateralization ratio
            loan_amount: Amount of the loan
            
        Returns:
            Asset-specific recommendation
        """
        logger.info(f"Generating asset-specific recommendation for {asset_type}")
        
        # Update asset volatility if needed
        self._update_asset_volatility()
        
        # Get user risk score from profile
        risk_score = user_profile.get('riskScore', 50)
        
        # Get asset-specific details
        asset_config = self.config.get('asset_config', {}).get(asset_type, {})
        if not asset_config:
            logger.warning(f"No configuration for asset type {asset_type}, using defaults")
            asset_config = {
                'base_volatility': 0.2,
                'risk_factor': 1.0
            }
        
        # Get asset volatility data
        asset_volatility = self.asset_volatility.get(asset_type, {})
        volatility = asset_volatility.get('current_volatility', asset_config.get('base_volatility', 0.2))
        risk_factor = asset_config.get('risk_factor', 1.0)
        
        # Calculate recommended ratio similar to get_recommendations
        base_ratio = self.config.get('base_collateral_ratio', 1.5)
        risk_adjustment = (risk_score / 100.0) * self.config.get('risk_adjustment_factor', 0.1)
        volatility_adjustment = volatility * self.config.get('volatility_adjustment_factor', 0.5) 
        
        # Get market scenario adjustment
        market_condition = self._assess_market_condition()
        market_adjustment = self.config.get('market_scenario_adjustments', {}).get(market_condition, 0)
        
        # Calculate the optimal buffer based on combined factors
        # Higher volatility and risk score = higher buffer
        volatility_buffer = self._calculate_volatility_buffer(volatility)
        risk_buffer = self._calculate_risk_buffer(risk_score)
        
        # Calculate recommended ratio with all factors
        recommended_ratio = (base_ratio + risk_adjustment + volatility_adjustment + market_adjustment) * risk_factor
        
        # Ensure within bounds
        min_ratio = self.config.get('min_collateral_ratio', 1.1)
        max_ratio = self.config.get('max_collateral_ratio', 3.0)
        recommended_ratio = max(min_ratio, min(max_ratio, recommended_ratio))
        
        # Calculate collateral needed
        required_collateral = loan_amount * recommended_ratio
        additional_collateral = required_collateral - (loan_amount * current_ratio)
        additional_collateral = max(0, additional_collateral)
        
        # Generate asset-specific recommendation
        recommendation = {
            'assetType': asset_type,
            'currentRatio': current_ratio,
            'recommendedRatio': recommended_ratio,
            'volatility': volatility,
            'riskFactor': risk_factor,
            'volatilityBuffer': volatility_buffer,
            'riskBuffer': risk_buffer,
            'requiredCollateral': required_collateral,
            'additionalCollateralNeeded': additional_collateral,
            'marketCondition': market_condition,
            'ratioComponents': {
                'baseRatio': base_ratio,
                'riskAdjustment': risk_adjustment,
                'volatilityAdjustment': volatility_adjustment,
                'marketAdjustment': market_adjustment
            },
            'safetyLevel': self._calculate_safety_level(current_ratio, recommended_ratio),
            'explanation': self._generate_explanation(asset_type, current_ratio, recommended_ratio, 
                                                    volatility, market_condition)
        }
        
        logger.info(f"Generated recommendation for {asset_type}: ratio = {recommended_ratio:.2f}, " +
                   f"safety = {recommendation['safetyLevel']}")
        
        return recommendation
    
    def _update_asset_volatility(self):
        """
        Update asset volatility data from real-time sources.
        """
        current_time = time.time()
        
        # Only update if enough time has passed
        if current_time - self.last_volatility_update < self.volatility_update_interval:
            return
        
        logger.info("Updating asset volatility data")
        
        # Update each asset
        for asset in self.asset_volatility:
            try:
                # Update with real-time data if IOTA connection available
                if self.iota_connection and self.iota_connection.is_connected:
                    logger.debug(f"Fetching real-time volatility data for {asset}")
                    volatility_data = self._fetch_asset_volatility(asset)
                    
                    if volatility_data:
                        self.asset_volatility[asset].update(volatility_data)
                        logger.debug(f"Updated volatility for {asset}: {volatility_data['current_volatility']:.4f}")
                else:
                    # Simulate updates with random walk for demo purposes
                    # In a real system, this would fetch data from price feeds
                    current = self.asset_volatility[asset]['current_volatility']
                    change = np.random.normal(0, 0.01)  # Small random change
                    new_volatility = max(0.01, min(0.5, current + change))  # Keep in reasonable range
                    
                    self.asset_volatility[asset]['current_volatility'] = new_volatility
                    self.asset_volatility[asset]['last_updated'] = current_time
                    
                    logger.debug(f"Simulated volatility update for {asset}: {new_volatility:.4f}")
            except Exception as e:
                logger.error(f"Error updating volatility for {asset}: {e}")
        
        self.last_volatility_update = current_time
        logger.info("Asset volatility data updated")
    
    def _fetch_asset_volatility(self, asset: str) -> Dict[str, float]:
        """
        Fetch real-time volatility data for an asset.
        
        Args:
            asset: Asset symbol
            
        Returns:
            Dictionary with volatility data
        """
        # This would normally fetch data from market APIs
        # For IOTA, we can use the IOTA connection to get some data
        if asset == 'IOTA' and self.iota_connection:
            try:
                # Get token price data
                price_data = self.iota_connection.get_token_price_history('IOTA', days=30)
                
                if not price_data or len(price_data) < 2:
                    return {}
                
                # Calculate daily returns
                prices = [p['price'] for p in price_data]
                returns = np.diff(prices) / prices[:-1]
                
                # Calculate volatility (standard deviation of returns)
                volatility = np.std(returns)
                
                # Forecasted volatility using simple exponential smoothing
                if len(returns) > 5:
                    recent_volatility = np.std(returns[-5:])
                    alpha = 0.7  # Smoothing factor
                    forecasted_volatility = alpha * recent_volatility + (1 - alpha) * volatility
                else:
                    forecasted_volatility = volatility
                
                return {
                    'current_volatility': volatility,
                    'historical_volatility': volatility,
                    'forecasted_volatility': forecasted_volatility,
                    'last_updated': time.time()
                }
            except Exception as e:
                logger.error(f"Error fetching IOTA volatility data: {e}")
                return {}
        
        # For other assets or if IOTA fetch fails, return empty dict
        return {}
    
    def _assess_market_condition(self) -> str:
        """
        Assess current market conditions.
        
        Returns:
            Market condition string: 'bull', 'neutral', 'bear', or 'extreme_volatility'
        """
        # This would normally analyze market data
        # For now, we'll use IOTA as a proxy for market conditions
        
        if 'IOTA' in self.asset_volatility:
            iota_volatility = self.asset_volatility['IOTA'].get('current_volatility', 0.2)
            
            if iota_volatility > 0.4:
                return 'extreme_volatility'
            elif iota_volatility > 0.3:
                return 'bear'
            elif iota_volatility < 0.15:
                return 'bull'
            else:
                return 'neutral'
        
        # Default if IOTA data not available
        return 'neutral'
    
    def _get_volatility_trend(self, asset: str) -> str:
        """
        Get the trend in volatility for an asset.
        
        Args:
            asset: Asset symbol
            
        Returns:
            Trend string: 'increasing', 'stable', or 'decreasing'
        """
        if asset in self.asset_volatility:
            asset_data = self.asset_volatility[asset]
            current = asset_data.get('current_volatility', 0.2)
            historical = asset_data.get('historical_volatility', 0.2)
            
            if current > historical * 1.2:
                return 'increasing'
            elif current < historical * 0.8:
                return 'decreasing'
            else:
                return 'stable'
        
        return 'stable'
    
    def _calculate_asset_risk_level(self, asset: str) -> str:
        """
        Calculate risk level for an asset based on volatility.
        
        Args:
            asset: Asset symbol
            
        Returns:
            Risk level string
        """
        if asset not in self.asset_volatility:
            return 'medium'
        
        volatility = self.asset_volatility[asset].get('current_volatility', 0.2)
        
        if volatility > 0.35:
            return 'very_high'
        elif volatility > 0.25:
            return 'high'
        elif volatility > 0.15:
            return 'medium'
        elif volatility > 0.05:
            return 'low'
        else:
            return 'very_low'
    
    def _calculate_volatility_buffer(self, volatility: float) -> float:
        """
        Calculate volatility buffer based on asset volatility.
        
        Args:
            volatility: Asset volatility
            
        Returns:
            Volatility buffer (percentage)
        """
        # Higher volatility needs higher buffer
        # This is a simple linear function
        base_buffer = 0.05  # 5% minimum buffer
        volatility_factor = 3.0  # Multiplier for volatility
        
        return base_buffer + (volatility * volatility_factor)
    
    def _calculate_risk_buffer(self, risk_score: float) -> float:
        """
        Calculate risk buffer based on user risk score.
        
        Args:
            risk_score: User risk score (0-100)
            
        Returns:
            Risk buffer (percentage)
        """
        # Higher risk score needs higher buffer
        # This is a simple linear function
        base_buffer = 0.02  # 2% minimum buffer
        risk_factor = 0.002  # 0.2% per risk point
        
        return base_buffer + (risk_score * risk_factor)
    
    def _calculate_safety_level(self, current_ratio: float, recommended_ratio: float) -> str:
        """
        Calculate safety level based on current vs recommended ratio.
        
        Args:
            current_ratio: Current collateralization ratio
            recommended_ratio: Recommended collateralization ratio
            
        Returns:
            Safety level string
        """
        if current_ratio >= recommended_ratio * 1.2:
            return 'very_safe'
        elif current_ratio >= recommended_ratio:
            return 'safe'
        elif current_ratio >= recommended_ratio * 0.9:
            return 'moderate'
        elif current_ratio >= recommended_ratio * 0.8:
            return 'risky'
        else:
            return 'very_risky'
    
    def _generate_explanation(
        self, 
        asset: str, 
        current_ratio: float, 
        recommended_ratio: float,
        volatility: float,
        market_condition: str
    ) -> str:
        """
        Generate human-readable explanation for the recommendation.
        
        Args:
            asset: Asset type
            current_ratio: Current collateralization ratio
            recommended_ratio: Recommended collateralization ratio
            volatility: Asset volatility
            market_condition: Current market condition
            
        Returns:
            Explanation string
        """
        risk_level = self._calculate_asset_risk_level(asset)
        safety_level = self._calculate_safety_level(current_ratio, recommended_ratio)
        
        explanation = f"Your current collateralization ratio is {current_ratio:.2f}. "
        
        if safety_level == 'very_risky' or safety_level == 'risky':
            explanation += f"This is significantly below our recommended ratio of {recommended_ratio:.2f} for {asset}. "
            explanation += f"Given the {risk_level} risk level of {asset} with a volatility of {volatility:.2%}, "
            explanation += "we strongly recommend increasing your collateralization to avoid liquidation risk."
        elif safety_level == 'moderate':
            explanation += f"This is slightly below our recommended ratio of {recommended_ratio:.2f} for {asset}. "
            explanation += f"Considering the {risk_level} risk level of {asset} and current {market_condition} market conditions, "
            explanation += "we recommend a moderate increase in collateralization for better protection."
        elif safety_level == 'safe':
            explanation += f"This matches our recommended ratio of {recommended_ratio:.2f} for {asset}. "
            explanation += f"This is appropriate given the {risk_level} risk level of {asset} and {market_condition} market conditions."
        else:  # very_safe
            explanation += f"This exceeds our recommended ratio of {recommended_ratio:.2f} for {asset}. "
            explanation += "Your position is very well protected, but you may be over-collateralized. "
            explanation += "Consider optimizing capital efficiency by adjusting your collateral level."
        
        return explanation


# Main function for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IntelliLend Collateralization Advisor")
    parser.add_argument("--config", type=str, default="config/collateralization_config.json", help="Path to configuration file")
    parser.add_argument("--asset", type=str, default="IOTA", help="Asset type")
    parser.add_argument("--risk-score", type=float, default=50.0, help="User risk score (0-100)")
    parser.add_argument("--current-ratio", type=float, default=1.5, help="Current collateralization ratio")
    args = parser.parse_args()
    
    # Create advisor
    advisor = CollateralizationAdvisor(args.config)
    
    # Simulate user data
    user_data = {
        'address': '0x0123456789abcdef0123456789abcdef01234567',
        'collateral_ratio': args.current_ratio,
        'current_collaterals': 1000,
        'current_borrows': 1000 / args.current_ratio,
        'primary_asset_type': args.asset
    }
    
    # Get recommendations
    recommendations = advisor.get_recommendations(user_data, args.risk_score)
    
    # Print results
    print(json.dumps(recommendations, indent=2))
