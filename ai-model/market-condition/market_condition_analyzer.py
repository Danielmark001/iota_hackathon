"""
Market Condition Analysis Module

This module provides comprehensive market analysis for IOTA tokens and related assets
to support lending risk assessment, including time-series forecasting, correlation
analysis, volatility prediction, and enhanced sentiment analysis with real-time data.
"""

import os
import logging
import json
import time
import asyncio
import aiohttp
import datetime
from typing import Dict, List, Optional, Tuple, Union, Any
import numpy as np
import pandas as pd
import requests

# Import local modules
from .time_series_forecaster import TimeSeriesForecaster
from .correlation_analyzer import CorrelationAnalyzer
from .volatility_predictor import VolatilityPredictor

# Import system modules
import sys
sys.path.append('../')  # Add parent directory to path
from market_sentiment import MarketSentimentAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MarketConditionAnalyzer:
    """
    Comprehensive market condition analysis for IOTA and related assets
    to enhance risk assessment for the IntelliLend platform.
    """
    
    def __init__(
        self,
        config_path: str = '../config/market_condition_config.json',
        cache_dir: str = "./cache/market",
        use_real_data: bool = True
    ):
        """
        Initialize the market condition analyzer
        
        Args:
            config_path: Path to configuration file
            cache_dir: Directory to cache data
            use_real_data: Whether to use real data sources or simulations
        """
        self.config_path = config_path
        self.cache_dir = cache_dir
        self.use_real_data = use_real_data
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Load configuration
        self._load_config()
        
        # Initialize components
        self.forecaster = TimeSeriesForecaster(
            config=self.config.get('time_series_config', {}),
            cache_dir=os.path.join(cache_dir, 'forecaster')
        )
        
        self.correlation_analyzer = CorrelationAnalyzer(
            config=self.config.get('correlation_config', {}),
            cache_dir=os.path.join(cache_dir, 'correlation')
        )
        
        self.volatility_predictor = VolatilityPredictor(
            config=self.config.get('volatility_config', {}),
            cache_dir=os.path.join(cache_dir, 'volatility')
        )
        
        # Initialize sentiment analyzer with real-data connections
        api_key = self.config.get('sentiment_config', {}).get('api_key')
        self.sentiment_analyzer = MarketSentimentAnalyzer(
            api_key=api_key,
            cache_dir=os.path.join(cache_dir, 'sentiment')
        )
        
        # Cache for market data
        self.market_data_cache = {}
        self.last_update_time = 0
        
        logger.info("Market Condition Analyzer initialized")
    
    def _load_config(self):
        """Load configuration from JSON file"""
        try:
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
                logger.info(f"Loaded configuration from {self.config_path}")
        except FileNotFoundError:
            logger.warning(f"Configuration file not found at {self.config_path}. Using default configuration.")
            # Default configuration
            self.config = {
                "update_interval_seconds": 300,  # 5 minutes
                "assets": ["IOTA", "ETH", "BTC", "USDT"],
                "default_lookback_days": 30,
                "data_sources": {
                    "price": {
                        "primary": "coingecko",
                        "backup": "binance",
                        "api_url": "https://api.coingecko.com/api/v3"
                    },
                    "on_chain": {
                        "primary": "iota_node",
                        "backup": "tangle_explorer",
                        "iota_node_url": "https://api.lb-0.h.chrysalis-devnet.iota.cafe"
                    },
                    "news": {
                        "primary": "cryptopanic",
                        "backup": "cryptocontrol",
                        "api_url": "https://cryptopanic.com/api/v1"
                    },
                    "social": {
                        "primary": "twitter",
                        "backup": "reddit",
                        "api_url": "https://api.twitter.com/2"
                    }
                },
                "time_series_config": {
                    "forecast_days": 7,
                    "model_type": "lstm",  # "lstm", "arima", "prophet"
                    "confidence_interval": 0.95,
                    "retrain_interval_days": 7
                },
                "correlation_config": {
                    "metrics": ["price", "volume", "volatility", "sentiment"],
                    "loan_data_lookback_days": 90,
                    "min_correlation_threshold": 0.3
                },
                "volatility_config": {
                    "model_type": "garch",  # "garch", "ewma", "ml"
                    "forecast_days": 7,
                    "confidence_interval": 0.95
                },
                "sentiment_config": {
                    "api_key": "",
                    "update_interval_hours": 6,
                    "sentiment_impact_weight": 0.3
                }
            }
    
    async def get_market_overview(self, assets: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get comprehensive overview of current market conditions
        
        Args:
            assets: List of assets to include (default: all configured assets)
            
        Returns:
            Dictionary with market overview data
        """
        if assets is None:
            assets = self.config["assets"]
        
        # Update market data if needed
        await self._update_market_data(assets)
        
        # Prepare overview data
        overview = {
            "timestamp": datetime.datetime.now().isoformat(),
            "assets": {},
            "market_indicators": {
                "overall_sentiment": await self._get_overall_sentiment(),
                "volatility_index": await self._calculate_volatility_index(),
                "correlation_matrix": await self._generate_correlation_matrix(assets),
                "fear_greed_index": await self._calculate_fear_greed_index()
            }
        }
        
        # Add data for each asset
        for asset in assets:
            asset_data = await self._get_asset_data(asset)
            if asset_data:
                overview["assets"][asset] = asset_data
        
        return overview
    
    async def forecast_price(
        self, 
        asset: str = "IOTA",
        days: int = 7,
        confidence_interval: float = 0.95
    ) -> Dict[str, Any]:
        """
        Forecast price for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with forecast data
        """
        logger.info(f"Forecasting price for {asset} for {days} days")
        
        # Update market data if needed
        await self._update_market_data([asset])
        
        # Get historical price data
        price_data = await self._get_price_history(asset)
        
        # Generate forecast
        forecast = await self.forecaster.forecast_price(
            price_data=price_data,
            asset=asset,
            days=days,
            confidence_interval=confidence_interval
        )
        
        return forecast
    
    async def analyze_correlations(
        self, 
        assets: Optional[List[str]] = None,
        metrics: Optional[List[str]] = None,
        lookback_days: int = 90
    ) -> Dict[str, Any]:
        """
        Analyze correlations between market conditions and loan performance
        
        Args:
            assets: List of assets to include
            metrics: List of metrics to correlate
            lookback_days: Number of days to look back
            
        Returns:
            Dictionary with correlation analysis
        """
        if assets is None:
            assets = self.config["assets"]
        
        if metrics is None:
            metrics = self.config["correlation_config"]["metrics"]
        
        logger.info(f"Analyzing correlations for {assets}")
        
        # Update market data if needed
        await self._update_market_data(assets)
        
        # Get loan performance data
        loan_data = await self._get_loan_performance_data(lookback_days)
        
        # Get market condition data
        market_condition_data = {}
        for asset in assets:
            asset_data = {}
            for metric in metrics:
                if metric == "price":
                    asset_data[metric] = await self._get_price_history(asset, lookback_days)
                elif metric == "volume":
                    asset_data[metric] = await self._get_volume_history(asset, lookback_days)
                elif metric == "volatility":
                    asset_data[metric] = await self._get_volatility_history(asset, lookback_days)
                elif metric == "sentiment":
                    asset_data[metric] = await self._get_sentiment_history(asset, lookback_days)
            
            market_condition_data[asset] = asset_data
        
        # Analyze correlations
        correlations = await self.correlation_analyzer.analyze_correlations(
            market_condition_data=market_condition_data,
            loan_performance_data=loan_data,
            lookback_days=lookback_days
        )
        
        return correlations
    
    async def predict_volatility(
        self, 
        asset: str = "IOTA",
        days: int = 7,
        confidence_interval: float = 0.95
    ) -> Dict[str, Any]:
        """
        Predict volatility for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to predict
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with volatility prediction
        """
        logger.info(f"Predicting volatility for {asset} for {days} days")
        
        # Update market data if needed
        await self._update_market_data([asset])
        
        # Get price history
        price_data = await self._get_price_history(asset)
        
        # Predict volatility
        volatility_prediction = await self.volatility_predictor.predict_volatility(
            price_data=price_data,
            asset=asset,
            days=days,
            confidence_interval=confidence_interval
        )
        
        return volatility_prediction
    
    async def get_sentiment_analysis(
        self, 
        asset: str = "IOTA",
        lookback_days: int = 7
    ) -> Dict[str, Any]:
        """
        Get sentiment analysis for an asset
        
        Args:
            asset: Asset symbol
            lookback_days: Number of days to look back
            
        Returns:
            Dictionary with sentiment analysis
        """
        logger.info(f"Getting sentiment analysis for {asset}")
        
        # Get sentiment from the real-data connected sentiment analyzer
        sentiment = await asyncio.to_thread(
            self.sentiment_analyzer.get_sentiment_for_asset,
            asset_symbol=asset,
            time_range=f"{lookback_days}d"
        )
        
        return sentiment
    
    async def get_market_risk_assessment(
        self,
        asset: str = "IOTA",
        user_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive market risk assessment
        
        Args:
            asset: Asset symbol
            user_address: Optional user address for personalized assessment
            
        Returns:
            Dictionary with market risk assessment
        """
        logger.info(f"Getting market risk assessment for {asset}")
        
        # Get market data
        await self._update_market_data([asset])
        
        # Get current price and volatility
        current_price = await self._get_current_price(asset)
        current_volatility = await self._get_current_volatility(asset)
        
        # Get sentiment
        sentiment = await self.get_sentiment_analysis(asset)
        
        # Predict future volatility
        volatility_prediction = await self.predict_volatility(asset)
        
        # Get user portfolio if address provided
        user_portfolio = None
        if user_address:
            user_portfolio = await self._get_user_portfolio(user_address)
        
        # Get market risk factors from sentiment analyzer
        market_risk_factors = await asyncio.to_thread(
            self.sentiment_analyzer.get_market_risk_factors,
            asset_symbol=asset,
            user_portfolio=user_portfolio
        )
        
        # Compile risk assessment
        risk_assessment = {
            "asset": asset,
            "timestamp": datetime.datetime.now().isoformat(),
            "current_price": current_price,
            "current_volatility": current_volatility,
            "sentiment_score": sentiment["sentiment_score"],
            "predicted_volatility": volatility_prediction["predictions"][0] if "predictions" in volatility_prediction else 0,
            "market_risk_factors": market_risk_factors,
            "risk_indicators": {
                "price_stability": self._calculate_price_stability(asset),
                "market_liquidity": self._calculate_market_liquidity(asset),
                "smart_money_flow": self._analyze_smart_money_flow(asset),
                "institutional_interest": self._analyze_institutional_interest(asset)
            },
            "risk_score": self._calculate_market_risk_score(
                asset,
                current_volatility,
                sentiment["sentiment_score"],
                volatility_prediction["predictions"][0] if "predictions" in volatility_prediction else 0
            )
        }
        
        return risk_assessment
    
    async def _update_market_data(self, assets: List[str]):
        """
        Update market data if it's stale
        
        Args:
            assets: List of assets to update
        """
        current_time = time.time()
        update_interval = self.config.get("update_interval_seconds", 300)
        
        # Check if update is needed
        if current_time - self.last_update_time < update_interval:
            return
        
        logger.info(f"Updating market data for {assets}")
        
        update_tasks = []
        for asset in assets:
            update_tasks.append(self._update_asset_data(asset))
        
        # Run all update tasks
        await asyncio.gather(*update_tasks)
        
        self.last_update_time = current_time
    
    async def _update_asset_data(self, asset: str):
        """
        Update data for a specific asset
        
        Args:
            asset: Asset symbol
        """
        try:
            # Update price data
            await self._update_price_data(asset)
            
            # Update on-chain data
            await self._update_onchain_data(asset)
            
            # Update news data (for sentiment)
            await self._update_news_data(asset)
            
            # Update social data (for sentiment)
            await self._update_social_data(asset)
        except Exception as e:
            logger.error(f"Error updating data for {asset}: {e}")
    
    async def _update_price_data(self, asset: str):
        """
        Update price data for an asset
        
        Args:
            asset: Asset symbol
        """
        try:
            data_source = self.config["data_sources"]["price"]
            primary_source = data_source["primary"]
            
            if primary_source == "coingecko" and self.use_real_data:
                # Fetch from CoinGecko API
                url = f"{data_source['api_url']}/coins/{asset.lower()}/market_chart"
                params = {
                    "vs_currency": "usd",
                    "days": self.config["default_lookback_days"],
                    "interval": "daily"
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # Process data
                            prices = data.get("prices", [])
                            volumes = data.get("total_volumes", [])
                            market_caps = data.get("market_caps", [])
                            
                            # Store in cache
                            self.market_data_cache[f"{asset}_price"] = prices
                            self.market_data_cache[f"{asset}_volume"] = volumes
                            self.market_data_cache[f"{asset}_market_cap"] = market_caps
                            
                            logger.info(f"Updated price data for {asset} from CoinGecko")
                        else:
                            logger.warning(f"Failed to fetch price data for {asset}: {response.status}")
                            
                            # Try backup source
                            await self._update_price_data_backup(asset)
            elif primary_source == "binance" and self.use_real_data:
                # Implement Binance API fetching
                # For brevity, skipping implementation here
                pass
            else:
                # Use simulated data for testing
                await self._update_price_data_simulated(asset)
        except Exception as e:
            logger.error(f"Error updating price data for {asset}: {e}")
            
            # Fall back to simulated data
            await self._update_price_data_simulated(asset)
    
    async def _update_price_data_backup(self, asset: str):
        """
        Update price data from backup source
        
        Args:
            asset: Asset symbol
        """
        # Implement backup data source logic
        # For brevity, just use simulated data
        await self._update_price_data_simulated(asset)
    
    async def _update_price_data_simulated(self, asset: str):
        """
        Update price data with simulated values
        
        Args:
            asset: Asset symbol
        """
        logger.info(f"Using simulated price data for {asset}")
        
        days = self.config["default_lookback_days"]
        
        # Set base price depending on asset
        if asset == "IOTA":
            base_price = 0.25
        elif asset == "BTC":
            base_price = 30000
        elif asset == "ETH":
            base_price = 2000
        else:
            base_price = 1.0
        
        # Generate random price data
        now = datetime.datetime.now()
        prices = []
        volumes = []
        market_caps = []
        
        for i in range(days):
            # Calculate timestamp
            timestamp = int((now - datetime.timedelta(days=days-i-1)).timestamp() * 1000)
            
            # Generate price with some randomness and trend
            volatility = 0.01 + 0.02 * np.random.random()
            trend = 0.002 * (np.random.random() - 0.5)
            
            if i == 0:
                price = base_price
            else:
                price = prices[-1][1] * (1 + np.random.normal(trend, volatility))
            
            # Generate volume
            volume = base_price * 1000000 * (0.5 + np.random.random())
            
            # Generate market cap
            market_cap = price * (base_price * 10000000)
            
            prices.append([timestamp, price])
            volumes.append([timestamp, volume])
            market_caps.append([timestamp, market_cap])
        
        # Store in cache
        self.market_data_cache[f"{asset}_price"] = prices
        self.market_data_cache[f"{asset}_volume"] = volumes
        self.market_data_cache[f"{asset}_market_cap"] = market_caps
    
    async def _update_onchain_data(self, asset: str):
        """
        Update on-chain data for an asset
        
        Args:
            asset: Asset symbol
        """
        if asset != "IOTA" or not self.use_real_data:
            # Only implemented for IOTA
            return
        
        try:
            data_source = self.config["data_sources"]["on_chain"]
            iota_node_url = data_source["iota_node_url"]
            
            # Fetch on-chain data from IOTA node
            url = f"{iota_node_url}/api/v1/network/metrics/basic"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Process data
                        confirmed_transactions = data.get("confirmedTransactions", 0)
                        tps = data.get("tps", 0)
                        confirmed_value = data.get("confirmedValue", 0)
                        
                        # Store in cache
                        self.market_data_cache[f"{asset}_onchain"] = {
                            "confirmed_transactions": confirmed_transactions,
                            "tps": tps,
                            "confirmed_value": confirmed_value,
                            "timestamp": datetime.datetime.now().isoformat()
                        }
                        
                        logger.info(f"Updated on-chain data for {asset}")
                    else:
                        logger.warning(f"Failed to fetch on-chain data for {asset}: {response.status}")
        except Exception as e:
            logger.error(f"Error updating on-chain data for {asset}: {e}")
    
    async def _update_news_data(self, asset: str):
        """
        Update news data for an asset
        
        Args:
            asset: Asset symbol
        """
        if not self.use_real_data:
            return
        
        try:
            data_source = self.config["data_sources"]["news"]
            api_url = data_source["api_url"]
            
            # Fetch news data from API
            url = f"{api_url}/posts"
            params = {
                "currencies": asset.lower(),
                "public": "true",
                "kind": "news"
            }
            
            if "api_key" in data_source:
                params["auth_token"] = data_source["api_key"]
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Process data
                        news_items = data.get("results", [])
                        
                        # Store in cache
                        self.market_data_cache[f"{asset}_news"] = {
                            "items": news_items,
                            "timestamp": datetime.datetime.now().isoformat()
                        }
                        
                        logger.info(f"Updated news data for {asset}")
                    else:
                        logger.warning(f"Failed to fetch news data for {asset}: {response.status}")
        except Exception as e:
            logger.error(f"Error updating news data for {asset}: {e}")
    
    async def _update_social_data(self, asset: str):
        """
        Update social media data for an asset
        
        Args:
            asset: Asset symbol
        """
        if not self.use_real_data:
            return
        
        try:
            data_source = self.config["data_sources"]["social"]
            api_url = data_source["api_url"]
            
            # This would fetch data from Twitter or other social APIs
            # For simplicity, we'll skip the implementation here
            logger.info(f"Social data update for {asset} not implemented yet with real API")
        except Exception as e:
            logger.error(f"Error updating social data for {asset}: {e}")
    
    async def _get_price_history(self, asset: str, days: Optional[int] = None) -> pd.DataFrame:
        """
        Get historical price data for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to look back
            
        Returns:
            DataFrame with price history
        """
        # Make sure data is updated
        await self._update_market_data([asset])
        
        # Get data from cache
        price_data = self.market_data_cache.get(f"{asset}_price", [])
        
        # Convert to DataFrame
        df = pd.DataFrame(price_data, columns=["timestamp", "price"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit='ms')
        df.set_index("timestamp", inplace=True)
        
        # Filter by days if specified
        if days:
            start_date = datetime.datetime.now() - datetime.timedelta(days=days)
            df = df[df.index >= start_date]
        
        return df
    
    async def _get_volume_history(self, asset: str, days: Optional[int] = None) -> pd.DataFrame:
        """
        Get historical volume data for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to look back
            
        Returns:
            DataFrame with volume history
        """
        # Make sure data is updated
        await self._update_market_data([asset])
        
        # Get data from cache
        volume_data = self.market_data_cache.get(f"{asset}_volume", [])
        
        # Convert to DataFrame
        df = pd.DataFrame(volume_data, columns=["timestamp", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit='ms')
        df.set_index("timestamp", inplace=True)
        
        # Filter by days if specified
        if days:
            start_date = datetime.datetime.now() - datetime.timedelta(days=days)
            df = df[df.index >= start_date]
        
        return df
    
    async def _get_volatility_history(self, asset: str, days: Optional[int] = None) -> pd.DataFrame:
        """
        Calculate historical volatility for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to look back
            
        Returns:
            DataFrame with volatility history
        """
        # Get price history
        price_df = await self._get_price_history(asset, days)
        
        # Calculate daily returns
        price_df["return"] = price_df["price"].pct_change()
        
        # Calculate rolling volatility (20-day window)
        price_df["volatility"] = price_df["return"].rolling(window=20).std() * np.sqrt(252)
        
        # Drop NaN values
        price_df.dropna(inplace=True)
        
        return price_df[["volatility"]]
    
    async def _get_sentiment_history(self, asset: str, days: Optional[int] = None) -> pd.DataFrame:
        """
        Get historical sentiment data for an asset
        
        Args:
            asset: Asset symbol
            days: Number of days to look back
            
        Returns:
            DataFrame with sentiment history
        """
        # This would be provided by the real-data sentiment analyzer
        # For now, we'll generate synthetic data
        
        # Generate dates
        if days is None:
            days = self.config["default_lookback_days"]
        
        dates = pd.date_range(end=datetime.datetime.now(), periods=days)
        
        # Generate sentiment scores with some randomness
        base_sentiment = 0.2  # Slightly positive
        sentiments = []
        
        for i in range(days):
            # Add some randomness and trend
            noise = 0.3 * np.random.random() - 0.15
            trend = 0.05 * np.sin(i / 10)  # Cyclical trend
            
            sentiment = base_sentiment + noise + trend
            sentiment = max(-1, min(1, sentiment))  # Clamp to [-1, 1]
            
            sentiments.append(sentiment)
        
        # Create DataFrame
        df = pd.DataFrame({
            "timestamp": dates,
            "sentiment": sentiments
        })
        df.set_index("timestamp", inplace=True)
        
        return df
    
    async def _get_loan_performance_data(self, lookback_days: int) -> pd.DataFrame:
        """
        Get historical loan performance data
        
        Args:
            lookback_days: Number of days to look back
            
        Returns:
            DataFrame with loan performance metrics
        """
        # This would fetch real loan performance data from backend
        # For now, we'll generate synthetic data
        
        # Generate dates
        dates = pd.date_range(end=datetime.datetime.now(), periods=lookback_days)
        
        # Generate loan metrics
        data = []
        
        for date in dates:
            # Base metrics
            utilization_rate = 0.7 + 0.1 * np.random.random()
            default_rate = 0.02 + 0.01 * np.random.random()
            liquidation_rate = 0.01 + 0.005 * np.random.random()
            avg_health_factor = 1.5 + 0.2 * np.random.random()
            
            data.append({
                "date": date,
                "utilization_rate": utilization_rate,
                "default_rate": default_rate,
                "liquidation_rate": liquidation_rate,
                "avg_health_factor": avg_health_factor
            })
        
        # Create DataFrame
        df = pd.DataFrame(data)
        df.set_index("date", inplace=True)
        
        return df
    
    async def _get_current_price(self, asset: str) -> float:
        """
        Get current price of an asset
        
        Args:
            asset: Asset symbol
            
        Returns:
            Current price
        """
        # Make sure data is updated
        await self._update_market_data([asset])
        
        # Get data from cache
        price_data = self.market_data_cache.get(f"{asset}_price", [])
        
        if price_data:
            return price_data[-1][1]
        else:
            return 0.0
    
    async def _get_current_volatility(self, asset: str) -> float:
        """
        Get current volatility of an asset
        
        Args:
            asset: Asset symbol
            
        Returns:
            Current volatility
        """
        # Get volatility history
        volatility_df = await self._get_volatility_history(asset)
        
        if not volatility_df.empty:
            return volatility_df["volatility"].iloc[-1]
        else:
            return 0.0
    
    async def _get_overall_sentiment(self) -> float:
        """
        Get overall market sentiment
        
        Returns:
            Sentiment score
        """
        # Get individual asset sentiments
        asset_sentiments = []
        
        for asset in self.config["assets"]:
            sentiment = await self.get_sentiment_analysis(asset)
            asset_sentiments.append(sentiment["sentiment_score"])
        
        # Calculate weighted average
        return np.mean(asset_sentiments)
    
    async def _get_asset_data(self, asset: str) -> Dict[str, Any]:
        """
        Get comprehensive data for an asset
        
        Args:
            asset: Asset symbol
            
        Returns:
            Dictionary with asset data
        """
        # Make sure data is updated
        await self._update_market_data([asset])
        
        # Get current price
        current_price = await self._get_current_price(asset)
        
        # Get price history
        price_history = await self._get_price_history(asset)
        
        # Calculate 24h change
        if len(price_history) >= 2:
            price_24h_ago = price_history["price"].iloc[-2]
            price_change_24h = (current_price - price_24h_ago) / price_24h_ago
        else:
            price_change_24h = 0.0
        
        # Get volume
        volume_history = await self._get_volume_history(asset)
        current_volume = volume_history["volume"].iloc[-1] if not volume_history.empty else 0.0
        
        # Get market cap
        market_cap_data = self.market_data_cache.get(f"{asset}_market_cap", [])
        current_market_cap = market_cap_data[-1][1] if market_cap_data else 0.0
        
        # Get volatility
        current_volatility = await self._get_current_volatility(asset)
        
        # Get sentiment
        sentiment = await self.get_sentiment_analysis(asset)
        
        # Compile asset data
        asset_data = {
            "symbol": asset,
            "price": current_price,
            "price_change_24h": price_change_24h,
            "volume_24h": current_volume,
            "market_cap": current_market_cap,
            "volatility": current_volatility,
            "sentiment_score": sentiment["sentiment_score"],
            "sentiment_label": sentiment["sentiment_label"],
            "onchain_data": self.market_data_cache.get(f"{asset}_onchain", {})
        }
        
        return asset_data
    
    async def _calculate_volatility_index(self) -> float:
        """
        Calculate overall market volatility index
        
        Returns:
            Volatility index
        """
        # Get volatility for all assets
        asset_volatilities = []
        
        for asset in self.config["assets"]:
            volatility = await self._get_current_volatility(asset)
            asset_volatilities.append(volatility)
        
        # Calculate weighted average
        return np.mean(asset_volatilities) * 100  # Scale to 0-100
    
    async def _generate_correlation_matrix(self, assets: List[str]) -> Dict[str, Dict[str, float]]:
        """
        Generate correlation matrix for assets
        
        Args:
            assets: List of assets
            
        Returns:
            Correlation matrix
        """
        # Get price history for all assets
        price_data = {}
        
        for asset in assets:
            price_history = await self._get_price_history(asset)
            price_data[asset] = price_history["price"]
        
        # Create DataFrame from price data
        df = pd.DataFrame(price_data)
        
        # Calculate correlation matrix
        corr_matrix = df.corr().to_dict()
        
        return corr_matrix
    
    async def _calculate_fear_greed_index(self) -> Dict[str, Any]:
        """
        Calculate fear and greed index
        
        Returns:
            Fear and greed index data
        """
        # This would implement a fear and greed index calculation
        # For now, use a simplified approach based on overall sentiment and volatility
        
        sentiment = await self._get_overall_sentiment()
        volatility_index = await self._calculate_volatility_index()
        
        # Scale sentiment to 0-100
        sentiment_component = (sentiment + 1) * 50
        
        # Invert volatility (higher volatility = more fear)
        volatility_component = 100 - volatility_index
        
        # Combine components
        fear_greed_value = 0.7 * sentiment_component + 0.3 * volatility_component
        
        # Determine category
        if fear_greed_value >= 80:
            category = "Extreme Greed"
        elif fear_greed_value >= 60:
            category = "Greed"
        elif fear_greed_value >= 40:
            category = "Neutral"
        elif fear_greed_value >= 20:
            category = "Fear"
        else:
            category = "Extreme Fear"
        
        return {
            "value": fear_greed_value,
            "category": category,
            "timestamp": datetime.datetime.now().isoformat()
        }
    
    def _calculate_price_stability(self, asset: str) -> float:
        """
        Calculate price stability metric
        
        Args:
            asset: Asset symbol
            
        Returns:
            Price stability score
        """
        # Implement price stability calculation
        # For brevity, return a random value
        return 0.7 + 0.2 * np.random.random()
    
    def _calculate_market_liquidity(self, asset: str) -> float:
        """
        Calculate market liquidity metric
        
        Args:
            asset: Asset symbol
            
        Returns:
            Market liquidity score
        """
        # Implement market liquidity calculation
        # For brevity, return a random value
        return 0.6 + 0.3 * np.random.random()
    
    def _analyze_smart_money_flow(self, asset: str) -> float:
        """
        Analyze smart money flow
        
        Args:
            asset: Asset symbol
            
        Returns:
            Smart money flow score
        """
        # Implement smart money flow analysis
        # For brevity, return a random value
        return 0.5 + 0.4 * np.random.random() - 0.2
    
    def _analyze_institutional_interest(self, asset: str) -> float:
        """
        Analyze institutional interest
        
        Args:
            asset: Asset symbol
            
        Returns:
            Institutional interest score
        """
        # Implement institutional interest analysis
        # For brevity, return a random value
        return 0.4 + 0.3 * np.random.random()
    
    def _calculate_market_risk_score(
        self,
        asset: str,
        current_volatility: float,
        sentiment_score: float,
        predicted_volatility: float
    ) -> float:
        """
        Calculate market risk score
        
        Args:
            asset: Asset symbol
            current_volatility: Current volatility
            sentiment_score: Sentiment score
            predicted_volatility: Predicted volatility
            
        Returns:
            Market risk score
        """
        # Convert sentiment score to risk component (-1 to 1 scale to 0 to 1 scale)
        sentiment_risk = (1 - sentiment_score) / 2
        
        # Normalize volatility to 0 to 1 scale
        volatility_risk = min(1.0, current_volatility / 0.4)
        
        # Normalize predicted volatility
        predicted_volatility_risk = min(1.0, predicted_volatility / 0.5)
        
        # Weight components
        weighted_score = (
            0.3 * sentiment_risk +
            0.4 * volatility_risk +
            0.3 * predicted_volatility_risk
        )
        
        # Scale to 0-100
        return weighted_score * 100
    
    async def _get_user_portfolio(self, user_address: str) -> Dict[str, float]:
        """
        Get user portfolio
        
        Args:
            user_address: User address
            
        Returns:
            Dictionary with portfolio composition
        """
        # This would fetch the user's portfolio from the blockchain
        # For now, return a simulated portfolio
        
        return {
            "IOTA": 0.6,
            "ETH": 0.3,
            "BTC": 0.1
        }