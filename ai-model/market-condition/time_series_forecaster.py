"""
Time Series Forecaster Module

This module provides time-series forecasting capabilities for IOTA token price
and other asset metrics, using various forecasting models including LSTM, ARIMA,
and Prophet.
"""

import os
import logging
import joblib
import numpy as np
import pandas as pd
import datetime
from typing import Dict, List, Optional, Union, Any
from sklearn.preprocessing import MinMaxScaler

# For LSTM model
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# For ARIMA model
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TimeSeriesForecaster:
    """
    Time series forecasting for asset prices and other metrics.
    """
    
    def __init__(
        self, 
        config: Dict[str, Any] = None,
        cache_dir: str = "./cache/forecaster"
    ):
        """
        Initialize the time series forecaster
        
        Args:
            config: Configuration dictionary
            cache_dir: Directory to cache data and models
        """
        self.config = config or {}
        self.cache_dir = cache_dir
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Set model parameters
        self.model_type = self.config.get("model_type", "lstm")
        self.forecast_days = self.config.get("forecast_days", 7)
        self.confidence_interval = self.config.get("confidence_interval", 0.95)
        self.retrain_interval_days = self.config.get("retrain_interval_days", 7)
        
        # Initialize model
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
        logger.info(f"Initialized TimeSeriesForecaster with model type: {self.model_type}")
    
    async def forecast_price(
        self,
        price_data: pd.DataFrame,
        asset: str,
        days: Optional[int] = None,
        confidence_interval: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Forecast price for an asset
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with forecast data
        """
        if days is None:
            days = self.forecast_days
        
        if confidence_interval is None:
            confidence_interval = self.confidence_interval
        
        logger.info(f"Forecasting {asset} price for {days} days with {self.model_type} model")
        
        # Check if we need to train/load a model
        model_path = os.path.join(self.cache_dir, f"{asset.lower()}_{self.model_type}_model")
        
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
        
        # Make predictions
        if self.model_type == "lstm":
            forecast_result = await self._forecast_lstm(price_data, days, confidence_interval)
        elif self.model_type == "arima":
            forecast_result = await self._forecast_arima(price_data, days, confidence_interval)
        elif self.model_type == "prophet":
            forecast_result = await self._forecast_prophet(price_data, days, confidence_interval)
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
        
        # Add metadata
        forecast_result["asset"] = asset
        forecast_result["model_type"] = self.model_type
        forecast_result["forecast_days"] = days
        forecast_result["confidence_interval"] = confidence_interval
        forecast_result["generated_at"] = datetime.datetime.now().isoformat()
        
        return forecast_result
    
    async def _train_model(self, price_data: pd.DataFrame, asset: str):
        """
        Train a new forecasting model
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
        """
        logger.info(f"Training new {self.model_type} model for {asset}")
        
        if self.model_type == "lstm":
            await self._train_lstm(price_data, asset)
        elif self.model_type == "arima":
            await self._train_arima(price_data, asset)
        elif self.model_type == "prophet":
            await self._train_prophet(price_data, asset)
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
    
    async def _load_model(self, asset: str):
        """
        Load an existing forecasting model
        
        Args:
            asset: Asset symbol
        """
        logger.info(f"Loading existing {self.model_type} model for {asset}")
        
        model_path = os.path.join(self.cache_dir, f"{asset.lower()}_{self.model_type}_model")
        scaler_path = os.path.join(self.cache_dir, f"{asset.lower()}_scaler")
        
        if self.model_type == "lstm":
            try:
                self.model = load_model(model_path)
                self.scaler = joblib.load(scaler_path)
                logger.info(f"Loaded LSTM model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading LSTM model: {e}")
                raise
        elif self.model_type == "arima":
            try:
                self.model = joblib.load(model_path)
                logger.info(f"Loaded ARIMA model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading ARIMA model: {e}")
                raise
        elif self.model_type == "prophet":
            try:
                self.model = joblib.load(model_path)
                logger.info(f"Loaded Prophet model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading Prophet model: {e}")
                raise
    
    async def _train_lstm(self, price_data: pd.DataFrame, asset: str):
        """
        Train LSTM model for forecasting
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
        """
        try:
            # Prepare data for LSTM
            data = price_data.reset_index()[["price"]].values
            
            # Scale data
            scaled_data = self.scaler.fit_transform(data)
            
            # Create sequences for LSTM
            sequence_length = 30  # Use 30 days of history to predict next day
            x, y = self._create_sequences(scaled_data, sequence_length)
            
            # Split data into train and test sets
            train_size = int(len(x) * 0.8)
            x_train, x_test = x[:train_size], x[train_size:]
            y_train, y_test = y[:train_size], y[train_size:]
            
            # Build LSTM model
            model = Sequential()
            model.add(LSTM(units=50, return_sequences=True, input_shape=(x_train.shape[1], 1)))
            model.add(Dropout(0.2))
            model.add(LSTM(units=50, return_sequences=False))
            model.add(Dropout(0.2))
            model.add(Dense(units=1))
            
            # Compile model
            model.compile(optimizer='adam', loss='mean_squared_error')
            
            # Train model
            early_stopping = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
            model.fit(
                x_train, y_train,
                epochs=100,
                batch_size=32,
                validation_data=(x_test, y_test),
                callbacks=[early_stopping],
                verbose=0
            )
            
            # Save model and scaler
            model_path = os.path.join(self.cache_dir, f"{asset.lower()}_{self.model_type}_model")
            scaler_path = os.path.join(self.cache_dir, f"{asset.lower()}_scaler")
            
            model.save(model_path)
            joblib.dump(self.scaler, scaler_path)
            
            # Set as current model
            self.model = model
            
            logger.info(f"Trained and saved LSTM model for {asset}")
            
        except Exception as e:
            logger.error(f"Error training LSTM model: {e}")
            raise
    
    async def _train_arima(self, price_data: pd.DataFrame, asset: str):
        """
        Train ARIMA model for forecasting
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
        """
        try:
            # Prepare data for ARIMA
            data = price_data["price"]
            
            # Find optimal ARIMA parameters
            p, d, q = 5, 1, 0  # Default parameters
            
            # Train ARIMA model
            model = ARIMA(data, order=(p, d, q))
            model_fit = model.fit()
            
            # Save model
            model_path = os.path.join(self.cache_dir, f"{asset.lower()}_{self.model_type}_model")
            joblib.dump(model_fit, model_path)
            
            # Set as current model
            self.model = model_fit
            
            logger.info(f"Trained and saved ARIMA model for {asset}")
            
        except Exception as e:
            logger.error(f"Error training ARIMA model: {e}")
            raise
    
    async def _train_prophet(self, price_data: pd.DataFrame, asset: str):
        """
        Train Prophet model for forecasting
        
        Args:
            price_data: DataFrame with price history
            asset: Asset symbol
        """
        try:
            # For Prophet, we would implement training here
            # Since we're just outlining the approach, this is a placeholder
            logger.info(f"Prophet model training not implemented yet")
            
        except Exception as e:
            logger.error(f"Error training Prophet model: {e}")
            raise
    
    async def _forecast_lstm(
        self,
        price_data: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Forecast using LSTM model
        
        Args:
            price_data: DataFrame with price history
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with forecast data
        """
        try:
            # Prepare data for prediction
            data = price_data.reset_index()[["price"]].values
            scaled_data = self.scaler.transform(data)
            
            # Create input sequence for prediction
            sequence_length = 30
            if len(scaled_data) < sequence_length:
                raise ValueError(f"Not enough data for forecasting. Need at least {sequence_length} data points.")
            
            input_sequence = scaled_data[-sequence_length:].reshape(1, sequence_length, 1)
            
            # Make predictions
            predictions = []
            prediction_dates = []
            
            current_sequence = input_sequence.copy()
            last_date = price_data.index[-1]
            
            for i in range(days):
                # Predict next day
                next_day_scaled = self.model.predict(current_sequence, verbose=0)
                
                # Convert to original scale
                next_day = self.scaler.inverse_transform(next_day_scaled)[0, 0]
                
                # Save prediction
                predictions.append(next_day)
                
                # Calculate next date
                next_date = last_date + datetime.timedelta(days=i+1)
                prediction_dates.append(next_date)
                
                # Update sequence for next prediction
                current_sequence = np.append(current_sequence[:, 1:, :], next_day_scaled.reshape(1, 1, 1), axis=1)
            
            # Calculate confidence intervals
            z_value = 1.96  # 95% confidence interval
            if confidence_interval != 0.95:
                # Adjust z-value for different confidence intervals
                z_value = np.abs(np.percentile(np.random.normal(0, 1, 10000), 100 * (1 - (1 - confidence_interval) / 2)))
            
            # Use model error as basis for confidence interval
            prediction_stdev = np.std(price_data["price"].pct_change().dropna()) * np.sqrt(np.arange(1, days + 1))
            
            lower_bounds = []
            upper_bounds = []
            
            for i in range(days):
                stdev = prediction_stdev[i] * predictions[i]
                lower_bounds.append(predictions[i] - z_value * stdev)
                upper_bounds.append(predictions[i] + z_value * stdev)
            
            # Format result
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": predictions,
                "lower_bounds": lower_bounds,
                "upper_bounds": upper_bounds,
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_price": price_data["price"].iloc[-1]
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error forecasting with LSTM: {e}")
            raise
    
    async def _forecast_arima(
        self,
        price_data: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Forecast using ARIMA model
        
        Args:
            price_data: DataFrame with price history
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with forecast data
        """
        try:
            # Make predictions
            forecast = self.model.forecast(steps=days, alpha=1 - confidence_interval)
            
            # Calculate confidence intervals
            forecast_ci = self.model.get_forecast(steps=days).conf_int(alpha=1 - confidence_interval)
            
            # Generate dates
            last_date = price_data.index[-1]
            prediction_dates = [last_date + datetime.timedelta(days=i+1) for i in range(days)]
            
            # Format result
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": forecast.values.tolist(),
                "lower_bounds": forecast_ci.iloc[:, 0].values.tolist(),
                "upper_bounds": forecast_ci.iloc[:, 1].values.tolist(),
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_price": price_data["price"].iloc[-1]
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error forecasting with ARIMA: {e}")
            raise
    
    async def _forecast_prophet(
        self,
        price_data: pd.DataFrame,
        days: int,
        confidence_interval: float
    ) -> Dict[str, Any]:
        """
        Forecast using Prophet model
        
        Args:
            price_data: DataFrame with price history
            days: Number of days to forecast
            confidence_interval: Confidence interval for prediction bounds
            
        Returns:
            Dictionary with forecast data
        """
        try:
            # For Prophet forecasting, we would implement predictions here
            # Since we're just outlining the approach, this is a placeholder
            logger.info(f"Prophet forecasting not implemented yet")
            
            # Return dummy data
            last_date = price_data.index[-1]
            prediction_dates = [last_date + datetime.timedelta(days=i+1) for i in range(days)]
            last_price = price_data["price"].iloc[-1]
            
            predictions = [last_price * (1 + 0.01 * i) for i in range(days)]
            lower_bounds = [p * 0.9 for p in predictions]
            upper_bounds = [p * 1.1 for p in predictions]
            
            result = {
                "dates": [d.strftime("%Y-%m-%d") for d in prediction_dates],
                "predictions": predictions,
                "lower_bounds": lower_bounds,
                "upper_bounds": upper_bounds,
                "last_actual_date": last_date.strftime("%Y-%m-%d"),
                "last_actual_price": last_price
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error forecasting with Prophet: {e}")
            raise
    
    def _create_sequences(self, data, sequence_length):
        """
        Create sequences for LSTM training
        
        Args:
            data: Scaled data
            sequence_length: Length of input sequences
            
        Returns:
            Tuple of (X, y)
        """
        x, y = [], []
        
        for i in range(len(data) - sequence_length):
            x.append(data[i:i+sequence_length])
            y.append(data[i+sequence_length, 0])
        
        return np.array(x), np.array(y)