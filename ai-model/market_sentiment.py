"""
Market Sentiment Analysis Module

This module implements real-time market sentiment analysis for DeFi risk assessment
using transformer-based NLP models and external data sources.
"""

import pandas as pd
import numpy as np
import tensorflow as tf
from transformers import AutoTokenizer, TFAutoModelForSequenceClassification
import requests
import json
import time
from datetime import datetime, timedelta

class MarketSentimentAnalyzer:
    """
    Advanced sentiment analysis for crypto and DeFi markets
    using transformer-based NLP and multi-source data integration
    """
    
    def __init__(self, api_key=None, cache_dir=None):
        self.api_key = api_key
        self.cache_dir = cache_dir or "./cache"
        
        # Initialize tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained("finiteautomata/bertweet-base-sentiment-analysis")
        self.model = TFAutoModelForSequenceClassification.from_pretrained("finiteautomata/bertweet-base-sentiment-analysis")
        
        # Cache for sentiment data
        self.sentiment_cache = {}
        self.price_data_cache = {}
        self.last_cache_refresh = datetime.now()
        
        # Data sources configuration
        self.data_sources = {
            "news": {
                "weight": 0.3,
                "url": "https://crypto-news-api.example.com/articles"
            },
            "social": {
                "weight": 0.4,
                "url": "https://crypto-social-api.example.com/mentions"
            },
            "github": {
                "weight": 0.1,
                "url": "https://api.github.com/repos/iotaledger/iota"
            },
            "market_data": {
                "weight": 0.2,
                "url": "https://crypto-market-api.example.com/metrics"
            }
        }
    
    def get_sentiment_for_asset(self, asset_symbol, time_range="24h"):
        """
        Get comprehensive sentiment analysis for a specific asset
        
        Args:
            asset_symbol (str): Symbol of the asset (e.g., "IOTA")
            time_range (str): Time range for analysis ("24h", "7d", "30d")
            
        Returns:
            dict: Sentiment analysis results
        """
        # Check cache for recent data
        cache_key = f"{asset_symbol}_{time_range}"
        current_time = datetime.now()
        
        if (cache_key in self.sentiment_cache and 
            (current_time - self.sentiment_cache[cache_key]["timestamp"]).total_seconds() < 3600):
            return self.sentiment_cache[cache_key]["data"]
        
        # Get data from multiple sources
        news_data = self._get_news_data(asset_symbol, time_range)
        social_data = self._get_social_data(asset_symbol, time_range)
        github_data = self._get_github_activity(asset_symbol)
        market_data = self._get_market_data(asset_symbol, time_range)
        
        # Analyze sentiment for textual data
        news_sentiment = self._analyze_text_sentiment(news_data)
        social_sentiment = self._analyze_text_sentiment(social_data)
        
        # Analyze technical indicators
        technical_signals = self._analyze_technical_indicators(market_data)
        
        # Analyze on-chain metrics
        onchain_analysis = self._analyze_onchain_metrics(asset_symbol)
        
        # Calculate weighted sentiment score
        sentiment_score = (
            self.data_sources["news"]["weight"] * news_sentiment["compound"] +
            self.data_sources["social"]["weight"] * social_sentiment["compound"] +
            self.data_sources["github"]["weight"] * self._normalize_github_activity(github_data) +
            self.data_sources["market_data"]["weight"] * technical_signals["overall_signal"]
        )
        
        # Classify sentiment
        sentiment_label = self._classify_sentiment(sentiment_score)
        
        # Calculate volatility forecast
        volatility_forecast = self._forecast_volatility(asset_symbol, market_data)
        
        # Calculate sentiment momentum
        sentiment_momentum = self._calculate_sentiment_momentum(asset_symbol, sentiment_score)
        
        # Format results
        result = {
            "asset": asset_symbol,
            "time_range": time_range,
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "sentiment_components": {
                "news": news_sentiment,
                "social": social_sentiment,
                "github_activity": self._normalize_github_activity(github_data),
                "technical_signals": technical_signals["signal_summary"]
            },
            "volatility_forecast": volatility_forecast,
            "sentiment_momentum": sentiment_momentum,
            "market_correlation": self._calculate_market_correlation(asset_symbol),
            "onchain_metrics": onchain_analysis,
            "timestamp": current_time.isoformat()
        }
        
        # Cache results
        self.sentiment_cache[cache_key] = {
            "data": result,
            "timestamp": current_time
        }
        
        return result
    
    def get_market_risk_factors(self, asset_symbol, user_portfolio=None):
        """
        Calculate market risk factors specific to a user's portfolio or an asset
        
        Args:
            asset_symbol (str): Symbol of the asset
            user_portfolio (dict, optional): User's portfolio composition
            
        Returns:
            dict: Market risk factors
        """
        # Get sentiment data
        sentiment_data = self.get_sentiment_for_asset(asset_symbol)
        
        # Get market data
        market_data = self._get_market_data(asset_symbol, "30d")
        
        # Calculate volatility
        volatility = self._calculate_volatility(market_data)
        
        # Calculate correlation with other major assets
        correlation = self._calculate_correlations(asset_symbol)
        
        # Calculate liquidity metrics
        liquidity = self._analyze_liquidity(asset_symbol)
        
        # Calculate market dominance
        market_dominance = self._calculate_market_dominance(asset_symbol)
        
        # Portfolio-specific risk factors
        portfolio_risk = {}
        if user_portfolio:
            portfolio_risk = self._calculate_portfolio_risk(user_portfolio)
        
        # Calculate risk metrics
        risk_factors = {
            "market_volatility": volatility["30d_volatility"],
            "sentiment_volatility": self._calculate_sentiment_volatility(asset_symbol),
            "negative_sentiment_exposure": max(0, -sentiment_data["sentiment_score"]) * 100,
            "liquidity_risk": (1 - liquidity["normalized_liquidity"]) * 100,
            "correlation_with_market": correlation["with_market"],
            "momentum_risk": self._calculate_momentum_risk(asset_symbol),
            "market_dominance": market_dominance,
            "on_chain_risk": self._calculate_onchain_risk(asset_symbol)
        }
        
        # Calculate overall market risk score
        weights = {
            "market_volatility": 0.25,
            "sentiment_volatility": 0.15,
            "negative_sentiment_exposure": 0.20,
            "liquidity_risk": 0.15,
            "correlation_with_market": 0.10,
            "momentum_risk": 0.10,
            "on_chain_risk": 0.05
        }
        
        overall_risk = sum(weights[k] * risk_factors[k] for k in weights.keys())
        
        # Add portfolio-specific risks if available
        if portfolio_risk:
            overall_risk = overall_risk * 0.7 + portfolio_risk["overall_risk"] * 0.3
        
        return {
            "asset": asset_symbol,
            "overall_market_risk": overall_risk,
            "risk_factors": risk_factors,
            "portfolio_risk": portfolio_risk if user_portfolio else None,
            "volatility_details": volatility,
            "correlation_details": correlation,
            "liquidity_details": liquidity,
            "time_horizon": "30d",
            "timestamp": datetime.now().isoformat()
        }
    
    def get_realtime_market_pulse(self, assets=None):
        """
        Get real-time market pulse with sentiment trends
        
        Args:
            assets (list, optional): List of assets to analyze
            
        Returns:
            dict: Real-time market pulse data
        """
        if assets is None:
            assets = ["IOTA", "BTC", "ETH", "SOL", "AVAX"]
        
        market_pulse = {
            "overall_market_sentiment": self._get_overall_market_sentiment(),
            "trending_sentiment_shifts": self._get_trending_sentiment_shifts(),
            "fear_greed_index": self._calculate_fear_greed_index(),
            "assets": {}
        }
        
        for asset in assets:
            market_pulse["assets"][asset] = {
                "sentiment": self.get_sentiment_for_asset(asset, "24h")["sentiment_score"],
                "sentiment_change_24h": self._get_sentiment_change(asset, "24h"),
                "sentiment_change_7d": self._get_sentiment_change(asset, "7d"),
                "price_change_24h": self._get_price_change(asset, "24h"),
                "volume_change_24h": self._get_volume_change(asset, "24h"),
                "social_volume_change": self._get_social_volume_change(asset, "24h")
            }
        
        # Add market correlation matrix
        market_pulse["correlation_matrix"] = self._get_correlation_matrix(assets)
        
        # Add global risk indicators
        market_pulse["global_risk_indicators"] = {
            "market_volatility_index": self._calculate_market_volatility_index(),
            "liquidity_stress_indicator": self._calculate_liquidity_stress(),
            "sentiment_divergence": self._calculate_sentiment_price_divergence(),
            "market_momentum": self._calculate_global_momentum(),
            "smart_money_flow": self._analyze_smart_money_flow()
        }
        
        # Add trend predictions
        market_pulse["trend_predictions"] = {
            "short_term": self._predict_trend(timeframe="short"),
            "medium_term": self._predict_trend(timeframe="medium"),
            "sentiment_reversal_probability": self._calculate_sentiment_reversal_probability()
        }
        
        return market_pulse
    
    def _analyze_text_sentiment(self, texts):
        """Analyze sentiment of text data using the transformer model"""
        if not texts:
            return {"negative": 0, "neutral": 0, "positive": 0, "compound": 0}
        
        # Process text data in batches
        sentiments = {"negative": 0, "neutral": 0, "positive": 0}
        
        for text in texts:
            # Tokenize the text
            inputs = self.tokenizer(text, return_tensors="tf", padding=True, truncation=True, max_length=128)
            
            # Get model predictions
            outputs = self.model(inputs)
            scores = tf.nn.softmax(outputs.logits, axis=1).numpy()[0]
            
            # Map scores to sentiments (model specific - adjust based on model labels)
            sentiments["negative"] += scores[0]
            sentiments["neutral"] += scores[1]
            sentiments["positive"] += scores[2]
        
        # Average the sentiment scores
        count = len(texts)
        for key in sentiments:
            sentiments[key] /= count
        
        # Calculate compound score (-1 to 1 range)
        compound = sentiments["positive"] - sentiments["negative"]
        sentiments["compound"] = compound
        
        return sentiments
    
    def _analyze_technical_indicators(self, market_data):
        """Analyze technical indicators for market signals"""
        # In a production environment, this would use technical analysis libraries
        # For this example, we'll use a simplified approach
        
        # Extract price data
        prices = market_data.get('prices', [])
        volumes = market_data.get('volumes', [])
        
        if not prices or len(prices) < 14:
            return {"overall_signal": 0, "signal_summary": {}}
        
        # Calculate basic indicators
        sma_10 = np.mean(prices[-10:])
        sma_30 = np.mean(prices[-30:]) if len(prices) >= 30 else np.mean(prices)
        latest_price = prices[-1]
        
        # Price momentum
        price_momentum = (latest_price / prices[-7] - 1) if len(prices) >= 7 else 0
        
        # Volume trend
        volume_trend = (np.mean(volumes[-3:]) / np.mean(volumes[-10:-3])) - 1 if len(volumes) >= 10 else 0
        
        # RSI (simplified)
        changes = [prices[i+1] - prices[i] for i in range(len(prices)-1)]
        gains = [max(0, change) for change in changes]
        losses = [max(0, -change) for change in changes]
        
        avg_gain = np.mean(gains[-14:]) if len(gains) >= 14 else np.mean(gains) if gains else 0
        avg_loss = np.mean(losses[-14:]) if len(losses) >= 14 else np.mean(losses) if losses else 0.0001
        
        rs = avg_gain / avg_loss if avg_loss > 0 else 1
        rsi = 100 - (100 / (1 + rs))
        
        # MACD (simplified)
        ema_12 = np.mean(prices[-12:]) if len(prices) >= 12 else np.mean(prices)
        ema_26 = np.mean(prices[-26:]) if len(prices) >= 26 else np.mean(prices)
        macd = ema_12 - ema_26
        
        # Signal line (9-day EMA of MACD)
        signal_line = macd  # Simplified
        
        # Generate signals
        signals = {
            "trend": 1 if latest_price > sma_30 else -1,
            "momentum": price_momentum * 10,  # Scale to approximately -1 to 1
            "volume_trend": 1 if volume_trend > 0.1 else (-1 if volume_trend < -0.1 else 0),
            "rsi": -1 if rsi > 70 else (1 if rsi < 30 else 0),
            "macd": 1 if macd > signal_line else -1
        }
        
        # Calculate overall signal (-1 to 1 range)
        signal_weights = {
            "trend": 0.3,
            "momentum": 0.2,
            "volume_trend": 0.1,
            "rsi": 0.2,
            "macd": 0.2
        }
        
        overall_signal = sum(signals[k] * signal_weights[k] for k in signals.keys())
        
        return {
            "overall_signal": overall_signal,
            "signal_summary": signals,
            "indicators": {
                "sma_10": sma_10,
                "sma_30": sma_30,
                "rsi": rsi,
                "macd": macd,
                "price_momentum": price_momentum,
                "volume_trend": volume_trend
            }
        }
    
    def _analyze_onchain_metrics(self, asset_symbol):
        """Analyze on-chain metrics for additional insights"""
        # In a production environment, this would fetch data from blockchain APIs
        # For this example, we'll use simulated data
        
        # Simulated on-chain metrics
        active_addresses = 1500 + np.random.randint(-200, 200)
        transaction_count = 12000 + np.random.randint(-1000, 1000)
        new_addresses = 300 + np.random.randint(-50, 50)
        avg_transaction_value = 450 + np.random.randint(-50, 50)
        large_transactions = 120 + np.random.randint(-20, 20)
        
        # Calculate derived metrics
        network_growth = new_addresses / active_addresses
        transaction_velocity = transaction_count / active_addresses
        concentration_risk = large_transactions / transaction_count
        
        # Calculate network health score
        network_health = (
            0.3 * self._normalize_value(active_addresses, 1000, 3000) +
            0.3 * self._normalize_value(transaction_count, 8000, 20000) +
            0.2 * self._normalize_value(network_growth, 0.1, 0.3) +
            0.2 * (1 - self._normalize_value(concentration_risk, 0.05, 0.2))
        )
        
        # Calculate adoption trend
        week_ago_addresses = active_addresses * (0.8 + 0.4 * np.random.random())
        adoption_trend = (active_addresses / week_ago_addresses) - 1
        
        return {
            "active_addresses": active_addresses,
            "transaction_count": transaction_count,
            "new_addresses": new_addresses,
            "avg_transaction_value": avg_transaction_value,
            "large_transactions": large_transactions,
            "network_growth": network_growth,
            "transaction_velocity": transaction_velocity,
            "concentration_risk": concentration_risk,
            "network_health": network_health,
            "adoption_trend": adoption_trend
        }
    
    def _get_news_data(self, asset_symbol, time_range):
        """Fetch news articles about the asset"""
        # In a production environment, this would fetch from a news API
        # For this example, we'll use simulated data
        
        # Simulated news headlines
        headlines = [
            f"{asset_symbol} sees increased adoption in enterprise solutions",
            f"New partnership announced for {asset_symbol} blockchain",
            f"Developers showcase new applications built on {asset_symbol}",
            f"{asset_symbol} price fluctuates amid market volatility",
            f"Analysts predict strong growth for {asset_symbol} in coming months"
        ]
        
        return headlines
    
    def _get_social_data(self, asset_symbol, time_range):
        """Fetch social media mentions about the asset"""
        # In a production environment, this would fetch from social media APIs
        # For this example, we'll use simulated data
        
        # Simulated social media posts
        posts = [
            f"Just bought more ${asset_symbol}! Feeling bullish about the tech",
            f"${asset_symbol} network showing impressive growth metrics this month",
            f"Not sure about ${asset_symbol} performance lately, might need to diversify",
            f"The new ${asset_symbol} update looks promising for scalability",
            f"${asset_symbol} community is one of the most engaged in crypto"
        ]
        
        return posts
    
    def _get_github_activity(self, asset_symbol):
        """Fetch GitHub activity for the project"""
        # In a production environment, this would fetch from GitHub API
        # For this example, we'll use simulated data
        
        return {
            "commits_last_week": 47 + np.random.randint(-10, 10),
            "open_issues": 120 + np.random.randint(-20, 20),
            "closed_issues": 35 + np.random.randint(-5, 5),
            "contributors": 15 + np.random.randint(-2, 2),
            "stars": 2500 + np.random.randint(-100, 100),
            "forks": 450 + np.random.randint(-20, 20)
        }
    
    def _get_market_data(self, asset_symbol, time_range):
        """Fetch market data for the asset"""
        # In a production environment, this would fetch from a crypto market API
        # For this example, we'll use simulated data
        
        # Check cache
        cache_key = f"{asset_symbol}_market_{time_range}"
        current_time = datetime.now()
        
        if (cache_key in self.price_data_cache and 
            (current_time - self.price_data_cache[cache_key]["timestamp"]).total_seconds() < 3600):
            return self.price_data_cache[cache_key]["data"]
        
        # Generate simulated price data
        days = 30 if time_range == "30d" else 7 if time_range == "7d" else 1
        data_points = days * 24  # Hourly data
        
        base_price = 1.0 if asset_symbol == "IOTA" else 30000 if asset_symbol == "BTC" else 2000
        volatility = 0.02 if asset_symbol == "IOTA" else 0.015 if asset_symbol == "BTC" else 0.025
        
        # Generate price series with random walk
        prices = [base_price]
        for _ in range(data_points - 1):
            change = np.random.normal(0, volatility)
            new_price = prices[-1] * (1 + change)
            prices.append(new_price)
        
        # Generate volume data
        base_volume = 5000000 if asset_symbol == "IOTA" else 20000000 if asset_symbol == "BTC" else 10000000
        volumes = [base_volume * (0.8 + 0.4 * np.random.random()) for _ in range(data_points)]
        
        # Generate market cap
        circulating_supply = 2800000000 if asset_symbol == "IOTA" else 19000000 if asset_symbol == "BTC" else 120000000
        market_cap = prices[-1] * circulating_supply
        
        # Generate trading pairs data
        trading_pairs = {
            "USDT": 0.6 + 0.1 * np.random.random(),
            "BTC": 0.2 + 0.05 * np.random.random(),
            "ETH": 0.1 + 0.05 * np.random.random(),
            "Others": 0.1 + 0.05 * np.random.random()
        }
        
        market_data = {
            "prices": prices,
            "volumes": volumes,
            "current_price": prices[-1],
            "price_change_24h": (prices[-1] / prices[-24] - 1) if len(prices) >= 24 else 0,
            "price_change_7d": (prices[-1] / prices[-168] - 1) if len(prices) >= 168 else 0,
            "market_cap": market_cap,
            "circulating_supply": circulating_supply,
            "trading_pairs": trading_pairs
        }
        
        # Cache the data
        self.price_data_cache[cache_key] = {
            "data": market_data,
            "timestamp": current_time
        }
        
        return market_data
    
    def _calculate_volatility(self, market_data):
        """Calculate volatility metrics for the asset"""
        prices = market_data.get('prices', [])
        
        if len(prices) < 2:
            return {"24h_volatility": 0, "7d_volatility": 0, "30d_volatility": 0}
        
        # Calculate returns
        returns = [(prices[i] / prices[i-1]) - 1 for i in range(1, len(prices))]
        
        # Calculate volatility for different time periods
        vol_24h = np.std(returns[-24:]) * np.sqrt(24) if len(returns) >= 24 else 0
        vol_7d = np.std(returns[-168:]) * np.sqrt(168) if len(returns) >= 168 else 0
        vol_30d = np.std(returns) * np.sqrt(len(returns)) if returns else 0
        
        return {
            "24h_volatility": vol_24h,
            "7d_volatility": vol_7d,
            "30d_volatility": vol_30d,
            "annualized_volatility": vol_30d * np.sqrt(365) if vol_30d else 0
        }
    
    def _analyze_liquidity(self, asset_symbol):
        """Analyze liquidity metrics for the asset"""
        # Get market data
        market_data = self._get_market_data(asset_symbol, "7d")
        volumes = market_data.get('volumes', [])
        
        if not volumes:
            return {"normalized_liquidity": 0.5}
        
        # Calculate average daily volume
        avg_daily_volume = np.mean(volumes[-24:]) * 24 if len(volumes) >= 24 else np.mean(volumes) * len(volumes)
        
        # Calculate liquidity ratio (volume/market cap)
        market_cap = market_data.get('market_cap', 0)
        liquidity_ratio = avg_daily_volume / market_cap if market_cap > 0 else 0
        
        # Normalize liquidity (0-1 scale)
        normalized_liquidity = min(1.0, liquidity_ratio * 5)  # Scale to make 20% daily volume/market cap = 1.0
        
        # Calculate bid-ask spread (simulated)
        bid_ask_spread = 0.001 + 0.002 * (1 - normalized_liquidity)
        
        # Calculate market depth (simulated)
        market_depth = normalized_liquidity * market_cap * 0.1
        
        return {
            "avg_daily_volume": avg_daily_volume,
            "liquidity_ratio": liquidity_ratio,
            "normalized_liquidity": normalized_liquidity,
            "bid_ask_spread": bid_ask_spread,
            "market_depth": market_depth
        }
    
    def _calculate_correlations(self, asset_symbol):
        """Calculate correlations with other assets and the broader market"""
        # In a production environment, this would use actual correlation calculations
        # For this example, we'll use simulated data
        
        # Simulated correlation coefficients
        correlations = {
            "BTC": 0.7 + 0.2 * np.random.random() - 0.1,
            "ETH": 0.65 + 0.2 * np.random.random() - 0.1,
            "total_market": 0.6 + 0.2 * np.random.random() - 0.1,
            "DeFi_index": 0.5 + 0.3 * np.random.random() - 0.15,
            "S&P500": 0.3 + 0.2 * np.random.random() - 0.1,
            "Gold": -0.2 + 0.3 * np.random.random() - 0.15
        }
        
        return correlations
    
    def _forecast_volatility(self, asset_symbol, market_data):
        """Forecast future volatility using GARCH-like approach"""
        # In a production environment, this would use a proper GARCH model
        # For this example, we'll use a simplified approach
        
        # Get historical volatility
        volatility = self._calculate_volatility(market_data)
        
        # Get sentiment as additional signal
        sentiment = self.get_sentiment_for_asset(asset_symbol)
        
        # Forecast volatility (simple regression-like formula)
        base_volatility = volatility["30d_volatility"]
        sentiment_factor = max(0, 0.5 - sentiment["sentiment_score"])  # Higher for negative sentiment
        
        forecast_1d = base_volatility * (0.9 + 0.2 * sentiment_factor)
        forecast_7d = base_volatility * (1.0 + 0.3 * sentiment_factor)
        forecast_30d = base_volatility * (1.1 + 0.2 * sentiment_factor)
        
        # Adjust for current market conditions
        market_stress = self._calculate_market_volatility_index() / 100
        forecast_1d *= (1 + 0.5 * market_stress)
        forecast_7d *= (1 + 0.3 * market_stress)
        forecast_30d *= (1 + 0.2 * market_stress)
        
        return {
            "forecast_1d": forecast_1d,
            "forecast_7d": forecast_7d,
            "forecast_30d": forecast_30d,
            "confidence": 0.7 - 0.2 * market_stress  # Lower confidence during market stress
        }
    
    def _normalize_github_activity(self, github_data):
        """Normalize GitHub activity to a -1 to 1 scale"""
        if not github_data:
            return 0
        
        # Calculate weighted activity score
        score = (
            0.4 * self._normalize_value(github_data["commits_last_week"], 10, 100) +
            0.2 * self._normalize_value(github_data["closed_issues"], 10, 100) +
            0.2 * self._normalize_value(github_data["contributors"], 5, 30) +
            0.1 * self._normalize_value(github_data["stars"], 1000, 10000) +
            0.1 * self._normalize_value(github_data["forks"], 100, 1000)
        )
        
        # Scale to -1 to 1 range (0.5 is neutral)
        return (score - 0.5) * 2
    
    def _normalize_value(self, value, min_val, max_val):
        """Normalize a value to the 0-1 range"""
        if value <= min_val:
            return 0
        elif value >= max_val:
            return 1
        else:
            return (value - min_val) / (max_val - min_val)
    
    def _classify_sentiment(self, sentiment_score):
        """Classify sentiment score into a label"""
        if sentiment_score >= 0.6:
            return "Very Positive"
        elif sentiment_score >= 0.2:
            return "Positive"
        elif sentiment_score >= -0.2:
            return "Neutral"
        elif sentiment_score >= -0.6:
            return "Negative"
        else:
            return "Very Negative"
    
    def _calculate_market_dominance(self, asset_symbol):
        """Calculate market dominance for the asset"""
        # Simulated market cap data
        asset_market_cap = self._get_market_data(asset_symbol, "24h").get("market_cap", 0)
        total_market_cap = 2000000000000  # $2 trillion (simulated)
        
        # Calculate dominance
        dominance = asset_market_cap / total_market_cap if total_market_cap > 0 else 0
        
        return dominance
    
    def _calculate_sentiment_momentum(self, asset_symbol, current_sentiment):
        """Calculate momentum in sentiment changes"""
        # Check if we have historical sentiment data
        yesterday_key = f"{asset_symbol}_24h"
        week_ago_key = f"{asset_symbol}_7d"
        
        # Get or simulate historical sentiment
        yesterday_sentiment = (
            self.sentiment_cache.get(yesterday_key, {}).get("data", {}).get("sentiment_score", 0)
            if yesterday_key in self.sentiment_cache
            else current_sentiment - 0.1 + 0.2 * np.random.random()
        )
        
        week_ago_sentiment = (
            self.sentiment_cache.get(week_ago_key, {}).get("data", {}).get("sentiment_score", 0)
            if week_ago_key in self.sentiment_cache
            else current_sentiment - 0.2 + 0.4 * np.random.random()
        )
        
        # Calculate momentum
        daily_change = current_sentiment - yesterday_sentiment
        weekly_change = current_sentiment - week_ago_sentiment
        
        return {
            "daily_change": daily_change,
            "weekly_change": weekly_change,
            "sentiment_acceleration": daily_change - weekly_change / 7
        }
    
    def _calculate_market_correlation(self, asset_symbol):
        """Calculate correlation with the broader market"""
        correlations = self._calculate_correlations(asset_symbol)
        return correlations.get("total_market", 0.5)
    
    def _calculate_sentiment_volatility(self, asset_symbol):
        """Calculate volatility in sentiment scores"""
        # In a production environment, this would use historical sentiment data
        # For this example, we'll use a simulated value
        return 0.2 + 0.1 * np.random.random()
    
    def _calculate_momentum_risk(self, asset_symbol):
        """Calculate risk based on price momentum patterns"""
        market_data = self._get_market_data(asset_symbol, "30d")
        prices = market_data.get("prices", [])
        
        if len(prices) < 30:
            return 50  # Default medium risk
        
        # Calculate momentum indicators
        short_momentum = prices[-1] / prices[-7] - 1 if len(prices) >= 7 else 0
        medium_momentum = prices[-1] / prices[-30] - 1 if len(prices) >= 30 else 0
        
        # Calculate momentum divergence (risk increases with divergence)
        momentum_divergence = abs(short_momentum - medium_momentum / 4)
        
        # Calculate overbought/oversold condition
        extreme_condition = 0
        if short_momentum > 0.15:  # Potentially overbought
            extreme_condition = min(1, short_momentum / 0.3)
        elif short_momentum < -0.15:  # Potentially oversold
            extreme_condition = min(1, -short_momentum / 0.3)
        
        # Calculate overall momentum risk
        momentum_risk = (
            0.4 * momentum_divergence * 100 +
            0.6 * extreme_condition * 100
        )
        
        return min(100, momentum_risk)
    
    def _calculate_onchain_risk(self, asset_symbol):
        """Calculate risk based on on-chain metrics"""
        onchain_data = self._analyze_onchain_metrics(asset_symbol)
        
        # Calculate risk components
        concentration_risk = onchain_data["concentration_risk"] * 100
        adoption_trend_risk = max(0, -onchain_data["adoption_trend"]) * 100
        network_health_risk = (1 - onchain_data["network_health"]) * 100
        
        # Overall on-chain risk
        onchain_risk = (
            0.4 * concentration_risk +
            0.3 * adoption_trend_risk +
            0.3 * network_health_risk
        )
        
        return min(100, onchain_risk)
    
    def _calculate_portfolio_risk(self, portfolio):
        """Calculate risk factors for a user's portfolio"""
        # Calculate portfolio diversification
        assets = list(portfolio.keys())
        concentration = sum(x**2 for x in portfolio.values())
        diversification = 1 - concentration
        
        # Calculate correlations between assets
        correlations = []
        for i in range(len(assets)):
            for j in range(i+1, len(assets)):
                # Simulate correlation between assets
                correlation = 0.3 + 0.4 * np.random.random()
                correlations.append(correlation)
        
        avg_correlation = np.mean(correlations) if correlations else 0.5
        
        # Calculate portfolio volatility (simulated)
        portfolio_volatility = 0.2 * (1 - diversification) + 0.1 * avg_correlation
        
        # Calculate overall portfolio risk
        overall_risk = (
            0.5 * (1 - diversification) * 100 +
            0.3 * avg_correlation * 100 +
            0.2 * portfolio_volatility * 100
        )
        
        return {
            "overall_risk": overall_risk,
            "diversification": diversification,
            "avg_correlation": avg_correlation,
            "portfolio_volatility": portfolio_volatility
        }
    
    def _get_overall_market_sentiment(self):
        """Get overall market sentiment score"""
        # Simulated overall market sentiment
        return 0.2 + 0.6 * np.random.random() - 0.3
    
    def _get_trending_sentiment_shifts(self):
        """Identify trending sentiment shifts in the market"""
        # Simulated trending shifts
        trending_assets = ["BTC", "ETH", "SOL", "IOTA", "AVAX"]
        shifts = {}
        
        for asset in trending_assets:
            shifts[asset] = {
                "direction": 1 if np.random.random() > 0.5 else -1,
                "magnitude": 0.1 + 0.3 * np.random.random(),
                "time_period": f"{np.random.randint(1, 24)}h"
            }
        
        return shifts
    
    def _calculate_fear_greed_index(self):
        """Calculate a fear & greed index for the crypto market"""
        # Simulated fear & greed index (0-100)
        index = np.random.randint(20, 80)
        
        # Determine category
        category = ""
        if index >= 75:
            category = "Extreme Greed"
        elif index >= 55:
            category = "Greed"
        elif index >= 45:
            category = "Neutral"
        elif index >= 25:
            category = "Fear"
        else:
            category = "Extreme Fear"
        
        return {
            "value": index,
            "category": category,
            "change_24h": np.random.randint(-10, 10)
        }
    
    def _get_sentiment_change(self, asset_symbol, time_range):
        """Get sentiment change over time"""
        # Simulated sentiment change
        return 0.1 * np.random.random() - 0.05
    
    def _get_price_change(self, asset_symbol, time_range):
        """Get price change over time"""
        market_data = self._get_market_data(asset_symbol, time_range)
        return market_data.get(f"price_change_{time_range}", 0)
    
    def _get_volume_change(self, asset_symbol, time_range):
        """Get volume change over time"""
        # Simulated volume change
        return 0.2 * np.random.random() - 0.1
    
    def _get_social_volume_change(self, asset_symbol, time_range):
        """Get change in social media volume"""
        # Simulated social volume change
        return 0.3 * np.random.random() - 0.15
    
    def _get_correlation_matrix(self, assets):
        """Get correlation matrix between assets"""
        matrix = {}
        
        for i, asset1 in enumerate(assets):
            matrix[asset1] = {}
            for j, asset2 in enumerate(assets):
                if i == j:
                    matrix[asset1][asset2] = 1.0
                else:
                    # Simulate correlation
                    correlation = 0.3 + 0.6 * np.random.random()
                    matrix[asset1][asset2] = correlation
        
        return matrix
    
    def _calculate_market_volatility_index(self):
        """Calculate overall market volatility index"""
        # Simulated market volatility index (0-100)
        return 30 + 40 * np.random.random()
    
    def _calculate_liquidity_stress(self):
        """Calculate liquidity stress indicator"""
        # Simulated liquidity stress (0-100)
        return 20 + 30 * np.random.random()
    
    def _calculate_sentiment_price_divergence(self):
        """Calculate divergence between sentiment and price"""
        # Simulated divergence (-1 to 1)
        return 0.6 * np.random.random() - 0.3
    
    def _calculate_global_momentum(self):
        """Calculate global market momentum"""
        # Simulated momentum (-1 to 1)
        return 0.6 * np.random.random() - 0.3
    
    def _analyze_smart_money_flow(self):
        """Analyze flow of funds from institutional investors"""
        # Simulated smart money flow (-1 to 1)
        return 0.4 * np.random.random() - 0.2
    
    def _predict_trend(self, timeframe="short"):
        """Predict market trend"""
        # Simulated trend prediction
        directions = ["bullish", "bearish", "sideways"]
        probabilities = np.random.random(3)
        probabilities = probabilities / probabilities.sum()
        
        return {
            "timeframe": timeframe,
            "directions": {
                "bullish": probabilities[0],
                "bearish": probabilities[1],
                "sideways": probabilities[2]
            },
            "confidence": 0.5 + 0.3 * np.random.random()
        }
    
    def _calculate_sentiment_reversal_probability(self):
        """Calculate probability of sentiment reversal"""
        # Simulated reversal probability (0-1)
        return 0.3 + 0.4 * np.random.random()


# Example usage
if __name__ == "__main__":
    # Initialize the sentiment analyzer
    analyzer = MarketSentimentAnalyzer()
    
    # Get sentiment for IOTA
    iota_sentiment = analyzer.get_sentiment_for_asset("IOTA")
    print(f"IOTA Sentiment: {iota_sentiment['sentiment_score']:.2f} ({iota_sentiment['sentiment_label']})")
    
    # Get market risk factors
    risk_factors = analyzer.get_market_risk_factors("IOTA")
    print(f"Overall Market Risk: {risk_factors['overall_market_risk']:.2f}/100")
    
    # Get real-time market pulse
    market_pulse = analyzer.get_realtime_market_pulse()
    print(f"Fear & Greed Index: {market_pulse['fear_greed_index']['value']} ({market_pulse['fear_greed_index']['category']})")
