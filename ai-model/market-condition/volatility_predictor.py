"""
Volatility Predictor Module

This module implements volatility prediction models for cryptocurrency assets,
with a focus on IOTA tokens, to support risk assessment and liquidation protection.
"""

import os
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Optional, Union, Any
import datetime
import json
import pickle
from scipy.stats import norm

# For GARCH modeling
import arch
from arch import arch_model

# For ML models
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VolatilityPredictor:
    """
    Predicts future volatility of cryptocurrency assets using various models
    including GARCH, EWMA, and machine learning approaches.
    """
    
    def __init__(
        self,
        config: Dict[str, Any] = None,
        cache_dir: str = "./cache/volatility"
    ):
        """
        Initialize the volatility predictor
        
        Args:
            config: Configuration dictionary
            cache_dir: Directory to cache models and results
        """
        self.config = config or {}
        self.cache_dir = cache_dir
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        os.makedirs(os.path.join(cache_dir, 'models'), exist_ok=True)
        os.makedirs(os.path.join(cache_dir, 'plots'), exist_ok=True)
        
        # Set model parameters
        self.model_type = self.config.get("model_type", "garch")
        self.forecast_days = self.config.get("forecast_days", 7)
        self.confidence_interval = self.config.get("confidence_interval", 0.95)
        self.retrain_interval_days = self.config.get("retrain_interval_days", 7)
        self.rolling_window = self.config.get("rolling_window", 30)
        self.garch_p = self.config.get("garch_p", 1)
        self.garch_q = self.config.get("garch_q", 1)
        
        # Initialize model
        self.model = None
        self.scaler = StandardScaler()
        
        logger.info(f"Initialized VolatilityPredictor with model type: {self.model_type}")
    
    async def predict_volatility(
        self,
        price_data: pd.DataFrame,
        asset: str,
        days: Optional[int] = None,
        confidence_interval: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Predict volatility for an asset
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with volatility prediction
        """
        if days is None:
            days = self.forecast_days
        
        if confidence_interval is None:
            confidence_interval = self.confidence_interval
        
        logger.info(f"Predicting volatility for {asset} for {days} days with {self.model_type} model")
        
        # Check if we need to train/load a model
        model_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_{self.model_type}_model.pkl")
        
        # Check if model exists and is recent enough
        model_exists = os.path.exists(model_path)
        
        if model_exists:
            model_mtime = os.path.getmtime(model_path)
            model_age_days = (datetime.datetime.now().timestamp() - model_mtime) / (24 * 3600)
            
            if model_age_days > self.retrain_interval_days:
                logger.info(f"Model is {model_age_days:.1f} days old, retraining")
                model_exists = False
        
        if not model_exists:
            # Train a new model
            await self._train_model(price_data, asset)
        else:
            # Load existing model
            await self._load_model(asset)
        
        # Preprocess data
        returns_df = self._preprocess_data(price_data)
        
        # Make predictions
        if self.model_type == "garch":
            prediction_result = await self._predict_garch(returns_df, days, confidence_interval)
        elif self.model_type == "ewma":
            prediction_result = await self._predict_ewma(returns_df, days, confidence_interval)
        elif self.model_type == "ml":
            prediction_result = await self._predict_ml(returns_df, days, confidence_interval)
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
        
        # Add metadata
        prediction_result["asset"] = asset
        prediction_result["model_type"] = self.model_type
        prediction_result["forecast_days"] = days
        prediction_result["confidence_interval"] = confidence_interval
        prediction_result["generated_at"] = datetime.datetime.now().isoformat()
        prediction_result["current_volatility"] = self._calculate_current_volatility(returns_df)
        
        # Generate visualizations
        visualization_paths = await self._generate_visualizations(
            price_data, returns_df, prediction_result, asset
        )
        prediction_result["visualization_paths"] = visualization_paths
        
        return prediction_result
    
    def _preprocess_data(self, price_data: pd.DataFrame) -> pd.DataFrame:
        """
        Preprocess price data for volatility modeling
        
        Args:
            price_data: DataFrame with price history
            
        Returns:
            DataFrame with returns and volatility features
        """
        # Make a copy to avoid modifying the original
        df = price_data.copy()
        
        # Calculate returns
        df['return'] = df['price'].pct_change()
        
        # Calculate log returns
        df['log_return'] = np.log(df['price'] / df['price'].shift(1))
        
        # Calculate squared returns (proxy for volatility)
        df['return_squared'] = df['return'] ** 2
        
        # Calculate rolling volatility
        df['rolling_vol_7d'] = df['return'].rolling(window=7).std() * np.sqrt(252)
        df['rolling_vol_30d'] = df['return'].rolling(window=30).std() * np.sqrt(252)
        
        # Calculate rolling volatility of volatility (higher order moments)
        df['vol_of_vol_7d'] = df['rolling_vol_7d'].rolling(window=7).std()
        
        # Calculate volatility realized over different time periods
        for period in [5, 10, 22]:  # 1 week, 2 weeks, 1 month
            df[f'realized_vol_{period}d'] = df['return'].rolling(window=period).std() * np.sqrt(252)
        
        # Drop NaN values
        df.dropna(inplace=True)
        
        return df
    
    async def _train_model(self, price_data: pd.DataFrame, asset: str):
        """
        Train a new volatility prediction model
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
        """
        logger.info(f"Training new {self.model_type} model for {asset}")
        
        # Preprocess data
        returns_df = self._preprocess_data(price_data)
        
        if self.model_type == "garch":
            await self._train_garch(returns_df, asset)
        elif self.model_type == "ewma":
            await self._train_ewma(returns_df, asset)
        elif self.model_type == "ml":
            await self._train_ml(returns_df, asset)
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
    
    async def _load_model(self, asset: str):
        """
        Load an existing volatility prediction model
        
        Args:
            asset: Asset symbol
        """
        logger.info(f"Loading {self.model_type} model for {asset}")
        
        model_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_{self.model_type}_model.pkl")
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            
            # Load scaler if using ML model
            if self.model_type == "ml":
                scaler_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_scaler.pkl")
                
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
            
            logger.info(f"Loaded {self.model_type} model from {model_path}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    async def _train_garch(self, returns_df: pd.DataFrame, asset: str):
        """
        Train GARCH model for volatility prediction
        
        Args:
            returns_df: DataFrame with return data
            asset: Asset symbol
        """
        try:
            # Use last 252 days (trading year) for GARCH modeling
            returns = returns_df['return'].iloc[-252:]
            
            # Train GARCH model
            model = arch_model(
                returns,
                p=self.garch_p,
                q=self.garch_q,
                mean='Constant',
                vol='GARCH',
                dist='normal'
            )
            
            # Fit model
            model_fit = model.fit(disp='off')
            
            # Save model
            model_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_{self.model_type}_model.pkl")
            
            with open(model_path, 'wb') as f:
                pickle.dump(model_fit, f)
            
            # Set as current model
            self.model = model_fit
            
            logger.info(f"Trained and saved GARCH model for {asset}")
            
        except Exception as e:
            logger.error(f"Error training GARCH model: {e}")
            raise
    
    async def _train_ewma(self, returns_df: pd.DataFrame, asset: str):
        """
        Train EWMA model for volatility prediction
        
        Args:
            returns_df: DataFrame with return data
            asset: Asset symbol
        """
        try:
            # EWMA model parameters
            lambda_param = 0.94  # RiskMetrics standard
            
            # Save parameters (no actual training needed for EWMA)
            model = {
                'lambda': lambda_param,
                'last_returns': returns_df['return'].iloc[-30:].values,
                'last_variance': returns_df['return'].iloc[-30:].var()
            }
            
            # Save model
            model_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_{self.model_type}_model.pkl")
            
            with open(model_path, 'wb') as f:
                pickle.dump(model, f)
            
            # Set as current model
            self.model = model
            
            logger.info(f"Saved EWMA model for {asset}")
            
        except Exception as e:
            logger.error(f"Error training EWMA model: {e}")
            raise
    
    async def _train_ml(self, returns_df: pd.DataFrame, asset: str):
        """
        Train ML model for volatility prediction
        
        Args:
            returns_df: DataFrame with return data
            asset: Asset symbol
        """
        try:
            # Prepare features and target
            features = [
                'rolling_vol_7d', 'rolling_vol_30d', 'vol_of_vol_7d',
                'realized_vol_5d', 'realized_vol_10d', 'realized_vol_22d',
                'return_squared'
            ]
            
            X = returns_df[features].values
            
            # Target: next week's volatility
            target_volatility = returns_df['return'].rolling(window=5).std().shift(-5) * np.sqrt(252)
            y = target_volatility.dropna().values
            
            # Adjust X to match y length
            X = X[:len(y)]
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Scale features
            X_train = self.scaler.fit_transform(X_train)
            X_test = self.scaler.transform(X_test)
            
            # Train Random Forest regressor
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
            
            model.fit(X_train, y_train)
            
            # Evaluate model
            y_pred = model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            logger.info(f"ML model evaluation - MSE: {mse:.6f}, MAE: {mae:.6f}, R²: {r2:.6f}")
            
            # Save model and scaler
            model_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_{self.model_type}_model.pkl")
            scaler_path = os.path.join(self.cache_dir, 'models', f"{asset.lower()}_scaler.pkl")
            
            with open(model_path, 'wb') as f:
                pickle.dump(model, f)
            
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            # Set as current model
            self.model = model
            
            logger.info(f"Trained and saved ML model for {asset}")
            
        except Exception as e:
            logger.error(f"Error training ML model: {e}")
            raise
    
    async def _predict_garch(
        self,
        returns_df: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Predict volatility using GARCH model
        
        Args:
            returns_df: DataFrame with return data
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with volatility predictions
        """
        try:
            # Generate forecast
            forecast = self.model.forecast(horizon=days)
            
            # Extract variance forecast
            variance_forecast = forecast.variance.iloc[-1].values
            
            # Convert to volatility (annualized)
            volatility_forecast = np.sqrt(variance_forecast) * np.sqrt(252)
            
            # Calculate confidence intervals
            z_value = norm.ppf((1 + confidence_interval) / 2)
            
            lower_bounds = []
            upper_bounds = []
            
            for var in variance_forecast:
                std_err = np.sqrt(var * 2)  # Approx. standard error of variance
                
                # Convert to volatility
                vol = np.sqrt(var) * np.sqrt(252)
                vol_std_err = std_err / (2 * np.sqrt(var)) * np.sqrt(252)
                
                lower_bounds.append(max(0, vol - z_value * vol_std_err))
                upper_bounds.append(vol + z_value * vol_std_err)
            
            # Generate dates
            last_date = returns_df.index[-1]
            prediction_dates = [last_date + datetime.timedelta(days=i+1) for i in range(days)]
            
            # Format result
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": volatility_forecast.tolist(),
                "lower_bounds": lower_bounds,
                "upper_bounds": upper_bounds,
                "forecast_variance": variance_forecast.tolist(),
                "model_summary": str(self.model.summary()),
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_volatility": returns_df['rolling_vol_30d'].iloc[-1]
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting with GARCH: {e}")
            raise
    
    async def _predict_ewma(
        self,
        returns_df: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Predict volatility using EWMA model
        
        Args:
            returns_df: DataFrame with return data
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with volatility predictions
        """
        try:
            # Get EWMA parameters
            lambda_param = self.model['lambda']
            last_returns = self.model['last_returns']
            last_variance = self.model['last_variance']
            
            # Initialize predictions
            variance_forecast = np.zeros(days)
            
            # For EWMA, the forecast for all future days is the same
            # as it assumes volatility persistence
            for i in range(days):
                if i == 0:
                    # First day forecast is based on historical data
                    variance_forecast[i] = (1 - lambda_param) * np.mean(last_returns**2) + lambda_param * last_variance
                else:
                    # Future forecasts are the same
                    variance_forecast[i] = variance_forecast[0]
            
            # Convert to volatility (annualized)
            volatility_forecast = np.sqrt(variance_forecast) * np.sqrt(252)
            
            # Calculate confidence intervals
            z_value = norm.ppf((1 + confidence_interval) / 2)
            
            lower_bounds = []
            upper_bounds = []
            
            for var in variance_forecast:
                std_err = np.sqrt(var * 2)  # Approx. standard error of variance
                
                # Convert to volatility
                vol = np.sqrt(var) * np.sqrt(252)
                vol_std_err = std_err / (2 * np.sqrt(var)) * np.sqrt(252)
                
                lower_bounds.append(max(0, vol - z_value * vol_std_err))
                upper_bounds.append(vol + z_value * vol_std_err)
            
            # Generate dates
            last_date = returns_df.index[-1]
            prediction_dates = [last_date + datetime.timedelta(days=i+1) for i in range(days)]
            
            # Format result
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": volatility_forecast.tolist(),
                "lower_bounds": lower_bounds,
                "upper_bounds": upper_bounds,
                "forecast_variance": variance_forecast.tolist(),
                "lambda": lambda_param,
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_volatility": returns_df['rolling_vol_30d'].iloc[-1]
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting with EWMA: {e}")
            raise
    
    async def _predict_ml(
        self,
        returns_df: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Predict volatility using ML model
        
        Args:
            returns_df: DataFrame with return data
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with volatility predictions
        """
        try:
            # Prepare features
            features = [
                'rolling_vol_7d', 'rolling_vol_30d', 'vol_of_vol_7d',
                'realized_vol_5d', 'realized_vol_10d', 'realized_vol_22d',
                'return_squared'
            ]
            
            X = returns_df[features].iloc[-1:].values
            
            # Scale features
            X_scaled = self.scaler.transform(X)
            
            # Make prediction for next day
            next_day_pred = self.model.predict(X_scaled)[0]
            
            # For ML model, predicting multiple days ahead is challenging
            # Here we use a simple approach of using the same prediction
            # for all future days
            volatility_forecast = [next_day_pred] * days
            
            # Calculate prediction intervals
            # For Random Forest, we can use the standard deviation of 
            # individual tree predictions as a proxy for uncertainty
            pred_std = np.std([
                tree.predict(X_scaled)[0]
                for tree in self.model.estimators_
            ])
            
            # Calculate z-value for confidence interval
            z_value = norm.ppf((1 + confidence_interval) / 2)
            
            lower_bounds = [max(0, vol - z_value * pred_std) for vol in volatility_forecast]
            upper_bounds = [vol + z_value * pred_std for vol in volatility_forecast]
            
            # Generate dates
            last_date = returns_df.index[-1]
            prediction_dates = [last_date + datetime.timedelta(days=i+1) for i in range(days)]
            
            # Feature importance
            feature_importance = dict(zip(features, self.model.feature_importances_))
            
            # Format result
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": volatility_forecast,
                "lower_bounds": lower_bounds,
                "upper_bounds": upper_bounds,
                "feature_importance": feature_importance,
                "prediction_std": pred_std,
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_volatility": returns_df['rolling_vol_30d'].iloc[-1]
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting with ML model: {e}")
            raise
    
    def _calculate_current_volatility(self, returns_df: pd.DataFrame) -> float:
        """
        Calculate current volatility from returns data
        
        Args:
            returns_df: DataFrame with return data
            
        Returns:
            Current volatility (annualized)
        """
        # Use 30-day rolling volatility as current volatility
        return returns_df['rolling_vol_30d'].iloc[-1]
    
    async def _generate_visualizations(
        self,
        price_data: pd.DataFrame,
        returns_df: pd.DataFrame,
        prediction_result: Dict[str, Any],
        asset: str
    ) -> Dict[str, str]:
        """
        Generate visualizations for volatility predictions
        
        Args:
            price_data: DataFrame with price history
            returns_df: DataFrame with return data
            prediction_result: Dictionary with prediction results
            asset: Asset symbol
            
        Returns:
            Dictionary with paths to visualization files
        """
        visualization_paths = {}
        
        # 1. Historical volatility plot
        try:
            plt.figure(figsize=(12, 6))
            
            # Plot historical volatility
            plt.plot(returns_df.index, returns_df['rolling_vol_30d'], label='30-Day Volatility')
            plt.plot(returns_df.index, returns_df['rolling_vol_7d'], label='7-Day Volatility', alpha=0.7)
            
            plt.title(f'Historical Volatility for {asset}')
            plt.xlabel('Date')
            plt.ylabel('Volatility (Annualized)')
            plt.legend()
            plt.grid(True, alpha=0.3)
            
            # Save figure
            hist_vol_path = os.path.join(self.cache_dir, 'plots', f'{asset.lower()}_historical_volatility.png')
            plt.savefig(hist_vol_path)
            plt.close()
            
            visualization_paths['historical_volatility'] = hist_vol_path
        except Exception as e:
            logger.error(f"Error generating historical volatility plot: {e}")
        
        # 2. Volatility forecast plot
        try:
            plt.figure(figsize=(12, 6))
            
            # Convert dates from strings to datetime
            dates = [datetime.datetime.strptime(d, "%Y-%m-%d") for d in prediction_result["dates"]]
            
            # Add last actual date and volatility
            last_date = datetime.datetime.strptime(prediction_result["last_actual_date"], "%Y-%m-%d")
            last_vol = prediction_result["last_actual_volatility"]
            
            all_dates = [last_date] + dates
            all_vols = [last_vol] + prediction_result["predictions"]
            
            # Plot forecast
            plt.plot(all_dates, all_vols, 'b-', label='Volatility Forecast')
            
            # Plot confidence interval
            lower_bounds = [last_vol] + prediction_result["lower_bounds"]
            upper_bounds = [last_vol] + prediction_result["upper_bounds"]
            
            plt.fill_between(
                all_dates,
                lower_bounds,
                upper_bounds,
                color='b',
                alpha=0.2,
                label=f'{int(prediction_result["confidence_interval"] * 100)}% Confidence Interval'
            )
            
            plt.title(f'Volatility Forecast for {asset} using {prediction_result["model_type"].upper()} Model')
            plt.xlabel('Date')
            plt.ylabel('Volatility (Annualized)')
            plt.legend()
            plt.grid(True, alpha=0.3)
            
            # Format x-axis dates
            plt.gcf().autofmt_xdate()
            
            # Save figure
            forecast_path = os.path.join(
                self.cache_dir, 'plots', 
                f'{asset.lower()}_{prediction_result["model_type"]}_forecast.png'
            )
            plt.savefig(forecast_path)
            plt.close()
            
            visualization_paths['forecast'] = forecast_path
        except Exception as e:
            logger.error(f"Error generating forecast plot: {e}")
        
        # 3. Price vs. Volatility plot
        try:
            fig, ax1 = plt.subplots(figsize=(12, 6))
            
            # Plot price
            ax1.set_xlabel('Date')
            ax1.set_ylabel('Price', color='g')
            ax1.plot(price_data.index, price_data['price'], 'g-', label='Price')
            ax1.tick_params(axis='y', labelcolor='g')
            
            # Create second y-axis
            ax2 = ax1.twinx()
            ax2.set_ylabel('Volatility', color='b')
            ax2.plot(returns_df.index, returns_df['rolling_vol_30d'], 'b-', label='Volatility (30d)')
            ax2.tick_params(axis='y', labelcolor='b')
            
            # Add title and legend
            plt.title(f'Price vs. Volatility for {asset}')
            
            # Create combined legend
            lines1, labels1 = ax1.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            ax2.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
            
            plt.grid(True, alpha=0.3)
            
            # Save figure
            price_vol_path = os.path.join(self.cache_dir, 'plots', f'{asset.lower()}_price_vs_volatility.png')
            plt.savefig(price_vol_path)
            plt.close()
            
            visualization_paths['price_vs_volatility'] = price_vol_path
        except Exception as e:
            logger.error(f"Error generating price vs. volatility plot: {e}")
        
        # 4. Return distribution plot
        try:
            plt.figure(figsize=(12, 6))
            
            # Plot histogram of returns
            sns.histplot(returns_df['return'], kde=True, stat='density', bins=50)
            
            # Plot normal distribution for comparison
            x = np.linspace(returns_df['return'].min(), returns_df['return'].max(), 100)
            mean = returns_df['return'].mean()
            std = returns_df['return'].std()
            y = norm.pdf(x, mean, std)
            plt.plot(x, y, 'r-', label='Normal Distribution')
            
            plt.title(f'Return Distribution for {asset}')
            plt.xlabel('Daily Return')
            plt.ylabel('Density')
            plt.legend()
            plt.grid(True, alpha=0.3)
            
            # Add annotations for key statistics
            plt.annotate(
                f"Mean: {mean:.4f}\nStd Dev: {std:.4f}\nSkew: {returns_df['return'].skew():.4f}\nKurtosis: {returns_df['return'].kurtosis():.4f}",
                xy=(0.05, 0.95),
                xycoords='axes fraction',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8)
            )
            
            # Save figure
            dist_path = os.path.join(self.cache_dir, 'plots', f'{asset.lower()}_return_distribution.png')
            plt.savefig(dist_path)
            plt.close()
            
            visualization_paths['return_distribution'] = dist_path
        except Exception as e:
            logger.error(f"Error generating return distribution plot: {e}")
        
        # If using ML model, add feature importance plot
        if self.model_type == "ml" and "feature_importance" in prediction_result:
            try:
                plt.figure(figsize=(10, 6))
                
                # Sort feature importance
                feature_importance = prediction_result["feature_importance"]
                sorted_importance = sorted(
                    feature_importance.items(),
                    key=lambda x: x[1],
                    reverse=True
                )
                
                # Plot feature importance
                features, importance = zip(*sorted_importance)
                plt.barh(features, importance)
                
                plt.title(f'Feature Importance for {asset} Volatility Prediction')
                plt.xlabel('Importance')
                plt.tight_layout()
                
                # Save figure
                importance_path = os.path.join(
                    self.cache_dir, 'plots', 
                    f'{asset.lower()}_feature_importance.png'
                )
                plt.savefig(importance_path)
                plt.close()
                
                visualization_paths['feature_importance'] = importance_path
            except Exception as e:
                logger.error(f"Error generating feature importance plot: {e}")
        
        return visualization_paths