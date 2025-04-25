"""
IntelliLend Risk Assessment Model

This module contains the advanced machine learning model for assessing borrower risk
based on on-chain activity and other relevant data, with early default prediction
and interest rate optimization.
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, mean_squared_error
import joblib
import os
import json
from datetime import datetime, timedelta

# For time series prediction
from statsmodels.tsa.arima.model import ARIMA
from prophet import Prophet

# For reinforcement learning
import gym
from gym import spaces
from stable_baselines3 import PPO
from stable_baselines3.common.evaluation import evaluate_policy

class RiskAssessmentModel:
    """
    Advanced AI model for assessing borrower risk in the IntelliLend platform.
    Incorporates multiple prediction models and reinforcement learning.
    """
    
    def __init__(self):
        """Initialize the risk assessment model with multiple components."""
        self.risk_classifier = None  # Classification model for risk categories
        self.default_predictor = None  # Regression model for default probability
        self.time_series_model = None  # Time series model for trend prediction
        self.interest_optimizer = None  # RL model for interest rate optimization
        self.pipeline = None  # Main pipeline for data processing and prediction
        
        # Enhanced feature list
        self.features = [
            # Transaction history features
            'transaction_count',
            'avg_transaction_value',
            'max_transaction_value',
            'min_transaction_value',
            'transaction_frequency',
            'transaction_regularity',
            'transaction_growth_rate',
            'incoming_tx_ratio',
            
            # Wallet characteristics
            'wallet_age_days',
            'wallet_balance',
            'wallet_balance_volatility',
            'balance_utilization_ratio',
            'address_entropy',
            
            # Lending history
            'previous_loans_count',
            'repayment_ratio',
            'default_count',
            'avg_loan_duration',
            'max_loan_amount',
            'early_repayment_frequency',
            'late_payment_frequency',
            
            # Collateral behavior
            'collateral_diversity',
            'collateral_value_ratio',
            'collateral_quality_score',
            'collateral_volatility',
            
            # Network analysis
            'network_centrality',
            'unique_counterparties',
            'trusted_counterparties_ratio',
            'counterparty_risk_exposure',
            
            # Cross-chain and protocol activity
            'cross_chain_activity',
            'defi_protocol_diversity',
            'lending_protocol_interactions',
            'staking_history_score',
            'governance_participation',
            
            # Market condition features
            'market_volatility_correlation',
            'token_price_correlation',
            'liquidation_risk_score',
            
            # Security and identity features
            'identity_verification_level',
            'security_score',
            'social_trust_score'
        ]
        
        # Categorical features that need one-hot encoding
        self.categorical_features = [
            'identity_verification_level',
            'collateral_quality_score'
        ]
        
        # Numerical features that need scaling
        self.numerical_features = [f for f in self.features if f not in self.categorical_features]
        
        # Temporal features for time series analysis
        self.temporal_features = [
            'transaction_count',
            'avg_transaction_value',
            'wallet_balance',
            'repayment_ratio',
            'default_count',
            'market_volatility_correlation'
        ]
    
    def preprocess_data(self, data, for_training=False):
        """
        Enhanced preprocessing of the input data with feature engineering.
        
        Args:
            data (pd.DataFrame): Raw data containing user features
            for_training (bool): Whether preprocessing is for training
            
        Returns:
            pd.DataFrame: Preprocessed data with engineered features
        """
        # Handle missing values with more sophisticated strategies
        for feature in self.features:
            if feature in data.columns:
                if feature in ['repayment_ratio', 'trusted_counterparties_ratio']:
                    # For ratio features, use median
                    data[feature] = data[feature].fillna(data[feature].median() if not data[feature].empty else 0.5)
                elif 'count' in feature or 'frequency' in feature:
                    # For count features, use 0
                    data[feature] = data[feature].fillna(0)
                elif 'score' in feature:
                    # For score features, use median
                    data[feature] = data[feature].fillna(data[feature].median() if not data[feature].empty else 50)
                else:
                    # For other features, use mean
                    data[feature] = data[feature].fillna(data[feature].mean() if not data[feature].empty else 0)
        
        # Advanced feature engineering
        
        # Risk indicators
        data['default_risk_ratio'] = (data['default_count'] / (data['previous_loans_count'] + 1))
        data['late_payment_risk'] = (data['late_payment_frequency'] / (data['previous_loans_count'] + 1))
        
        # Activity and engagement scores
        data['lending_engagement'] = (
            data['transaction_count'] * data['lending_protocol_interactions'] / 
            (data['wallet_age_days'] + 1)
        )
        
        data['financial_stability'] = (
            data['wallet_balance'] * (1 - data['wallet_balance_volatility']) *
            (data['repayment_ratio'] ** 2)
        )
        
        # Collateral assessment
        data['collateral_health'] = (
            data['collateral_value_ratio'] * 
            data['collateral_diversity'] / 
            (data['collateral_volatility'] + 0.1)
        )
        
        # Network trust score
        data['network_trust'] = (
            data['trusted_counterparties_ratio'] * 
            data['network_centrality'] *
            data['social_trust_score']
        )
        
        # Market and systemic risk
        data['market_risk_exposure'] = (
            data['market_volatility_correlation'] * 
            data['liquidation_risk_score'] * 
            (2 - data['collateral_health'])
        )
        
        # Combined risk score (for debugging and validation)
        data['combined_risk_indicator'] = (
            0.3 * data['default_risk_ratio'] +
            0.2 * data['late_payment_risk'] +
            0.15 * data['market_risk_exposure'] -
            0.15 * data['financial_stability'] -
            0.1 * data['network_trust'] -
            0.1 * data['collateral_health']
        )
        
        # Normalize the engineered features
        if for_training:
            self.feature_ranges = {}
            for col in data.columns:
                if col not in self.categorical_features and col != 'user_id':
                    self.feature_ranges[col] = {
                        'min': data[col].min(),
                        'max': data[col].max()
                    }
                    # Avoid division by zero
                    if self.feature_ranges[col]['max'] > self.feature_ranges[col]['min']:
                        data[col] = (data[col] - self.feature_ranges[col]['min']) / (self.feature_ranges[col]['max'] - self.feature_ranges[col]['min'])
        else:
            # Use stored ranges for normalization in prediction
            if hasattr(self, 'feature_ranges'):
                for col in data.columns:
                    if col in self.feature_ranges:
                        range_min = self.feature_ranges[col]['min']
                        range_max = self.feature_ranges[col]['max']
                        if range_max > range_min:
                            data[col] = (data[col] - range_min) / (range_max - range_min)
        
        return data
    
    def build_preprocessing_pipeline(self):
        """
        Build a preprocessing pipeline for the data.
        
        Returns:
            ColumnTransformer: Preprocessing pipeline
        """
        # Preprocessing for numerical features
        numerical_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        # Preprocessing for categorical features
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        # Combine preprocessing steps
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numerical_transformer, self.numerical_features),
                ('cat', categorical_transformer, self.categorical_features)
            ],
            remainder='drop'  # Drop any columns not specified
        )
        
        return preprocessor
    
    def train_risk_classifier(self, X_train, y_train):
        """
        Train a classification model to categorize borrowers into risk classes.
        
        Args:
            X_train (pd.DataFrame): Training features
            y_train (pd.Series): Training labels (risk categories)
        """
        # Create preprocessing pipeline
        preprocessor = self.build_preprocessing_pipeline()
        
        # Create full pipeline with model
        self.risk_classifier = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('classifier', RandomForestClassifier(random_state=42))
        ])
        
        # Define hyperparameters for grid search
        param_grid = {
            'classifier__n_estimators': [100, 200, 300],
            'classifier__max_depth': [None, 20, 30, 40],
            'classifier__min_samples_split': [2, 5, 10],
            'classifier__class_weight': ['balanced', 'balanced_subsample', None]
        }
        
        # Perform grid search
        grid_search = GridSearchCV(
            self.risk_classifier, param_grid, cv=5, scoring='f1_weighted'
        )
        grid_search.fit(X_train, y_train)
        
        # Set the best model
        self.risk_classifier = grid_search.best_estimator_
        print(f"Risk Classifier - Best parameters: {grid_search.best_params_}")
        print(f"Risk Classifier - Best score: {grid_search.best_score_:.4f}")
    
    def train_default_predictor(self, X_train, y_train):
        """
        Train a regression model to predict the probability of default.
        
        Args:
            X_train (pd.DataFrame): Training features
            y_train (pd.Series): Training values (default probabilities)
        """
        # Create preprocessing pipeline
        preprocessor = self.build_preprocessing_pipeline()
        
        # Create full pipeline with model
        self.default_predictor = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('regressor', GradientBoostingRegressor(random_state=42))
        ])
        
        # Define hyperparameters for grid search
        param_grid = {
            'regressor__n_estimators': [100, 200],
            'regressor__learning_rate': [0.01, 0.05, 0.1],
            'regressor__max_depth': [3, 5, 7],
            'regressor__subsample': [0.8, 0.9, 1.0]
        }
        
        # Perform grid search
        grid_search = GridSearchCV(
            self.default_predictor, param_grid, cv=5, scoring='neg_mean_squared_error'
        )
        grid_search.fit(X_train, y_train)
        
        # Set the best model
        self.default_predictor = grid_search.best_estimator_
        print(f"Default Predictor - Best parameters: {grid_search.best_params_}")
        print(f"Default Predictor - Best score: {-grid_search.best_score_:.4f} MSE")
    
    def train_time_series_models(self, temporal_data):
        """
        Train time series models for predicting future behavior.
        
        Args:
            temporal_data (dict): Dictionary of pd.DataFrame with temporal data for each user
        """
        self.time_series_models = {}
        
        for user_id, user_data in temporal_data.items():
            # Train a model for each temporal feature
            user_models = {}
            
            for feature in self.temporal_features:
                if feature in user_data.columns:
                    # Get the time series data
                    ts_data = user_data[['timestamp', feature]].sort_values('timestamp')
                    ts_data = ts_data.rename(columns={'timestamp': 'ds', feature: 'y'})
                    
                    # Train Prophet model
                    try:
                        model = Prophet(
                            yearly_seasonality=False,
                            weekly_seasonality=True,
                            daily_seasonality=True,
                            changepoint_prior_scale=0.05
                        )
                        model.fit(ts_data)
                        user_models[feature] = model
                        print(f"Trained time series model for user {user_id}, feature {feature}")
                    except Exception as e:
                        print(f"Error training time series model for user {user_id}, feature {feature}: {e}")
                        # Fall back to a simpler ARIMA model if Prophet fails
                        try:
                            if len(ts_data) > 10:  # Need sufficient data for ARIMA
                                model = ARIMA(ts_data['y'].values, order=(1, 1, 1))
                                model_fit = model.fit()
                                user_models[feature] = {
                                    'type': 'ARIMA',
                                    'model': model_fit
                                }
                                print(f"Trained ARIMA model for user {user_id}, feature {feature}")
                        except Exception as e2:
                            print(f"Error training ARIMA model: {e2}")
            
            # Store the models for this user
            if user_models:
                self.time_series_models[user_id] = user_models
        
        print(f"Trained time series models for {len(self.time_series_models)} users")
    
    def train_interest_optimizer(self, env_config):
        """
        Train a reinforcement learning model to optimize interest rates.
        
        Args:
            env_config (dict): Configuration for the RL environment
        """
        # Create the interest rate optimization environment
        env = InterestRateEnv(env_config)
        
        # Define the RL model
        model = PPO("MlpPolicy", env, verbose=1)
        
        # Train the model
        model.learn(total_timesteps=10000)
        
        # Evaluate the trained policy
        mean_reward, std_reward = evaluate_policy(model, env, n_eval_episodes=10)
        print(f"Mean reward: {mean_reward:.2f} +/- {std_reward:.2f}")
        
        # Save the model
        self.interest_optimizer = model
        
    def predict_risk_category(self, user_data):
        """
        Predict risk category for a user.
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            int: Risk category (0: Low, 1: Medium, 2: High, 3: Very High)
        """
        if not self.risk_classifier:
            raise ValueError("Risk classifier not trained. Call train_risk_classifier() first.")
        
        # Preprocess the data
        processed_data = self.preprocess_data(user_data)
        
        # Make prediction
        prediction = self.risk_classifier.predict(processed_data[self.features])
        
        return prediction[0]
    
    def predict_default_probability(self, user_data):
        """
        Predict the probability of default for a user.
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Default probability (0-1)
        """
        if not self.default_predictor:
            raise ValueError("Default predictor not trained. Call train_default_predictor() first.")
        
        # Preprocess the data
        processed_data = self.preprocess_data(user_data)
        
        # Make prediction
        default_prob = self.default_predictor.predict(processed_data[self.features])
        
        # Ensure it's within [0, 1]
        default_prob = np.clip(default_prob, 0, 1)
        
        return default_prob[0]
    
    def predict_future_behavior(self, user_id, days_ahead=30):
        """
        Predict future behavior using time series models.
        
        Args:
            user_id (str): User identifier
            days_ahead (int): Number of days to forecast
            
        Returns:
            dict: Predictions for each temporal feature
        """
        if not hasattr(self, 'time_series_models') or user_id not in self.time_series_models:
            raise ValueError(f"Time series models not trained for user {user_id}")
        
        predictions = {}
        user_models = self.time_series_models[user_id]
        
        for feature, model in user_models.items():
            if isinstance(model, Prophet):
                # Prophet forecasting
                future = model.make_future_dataframe(periods=days_ahead)
                forecast = model.predict(future)
                predictions[feature] = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(days_ahead)
            elif isinstance(model, dict) and model['type'] == 'ARIMA':
                # ARIMA forecasting
                forecast = model['model'].forecast(steps=days_ahead)
                dates = [datetime.now() + timedelta(days=i) for i in range(1, days_ahead+1)]
                predictions[feature] = pd.DataFrame({
                    'ds': dates,
                    'yhat': forecast
                })
        
        return predictions
    
    def optimize_interest_rate(self, user_data, current_market_conditions):
        """
        Optimize interest rate for a user using reinforcement learning.
        
        Args:
            user_data (pd.DataFrame): User features
            current_market_conditions (dict): Current market conditions
            
        Returns:
            float: Optimized interest rate
        """
        if not self.interest_optimizer:
            raise ValueError("Interest optimizer not trained. Call train_interest_optimizer() first.")
        
        # Preprocess the input for the RL model
        risk_category = self.predict_risk_category(user_data)
        default_probability = self.predict_default_probability(user_data)
        
        # Create the environment with current state
        env = InterestRateEnv({
            'user_risk_category': risk_category,
            'default_probability': default_probability,
            'market_conditions': current_market_conditions
        })
        
        # Reset the environment to initialize the state
        obs = env.reset()
        
        # Get the action (interest rate) from the policy
        action, _ = self.interest_optimizer.predict(obs)
        
        # Convert action to interest rate
        interest_rate = env.action_to_interest_rate(action)
        
        return interest_rate
    
    def get_early_warning_signals(self, user_id, user_data, threshold=0.7):
        """
        Get early warning signals for potential defaults.
        
        Args:
            user_id (str): User identifier
            user_data (pd.DataFrame): Current user data
            threshold (float): Warning threshold
            
        Returns:
            dict: Warning signals and their severity
        """
        warnings = {}
        
        # Check default probability
        default_prob = self.predict_default_probability(user_data)
        if default_prob > threshold:
            warnings['high_default_probability'] = {
                'severity': 'high',
                'value': default_prob,
                'threshold': threshold,
                'description': 'User has a high probability of default based on current behavior'
            }
        
        # Check time series predictions if available
        if hasattr(self, 'time_series_models') and user_id in self.time_series_models:
            future_predictions = self.predict_future_behavior(user_id, days_ahead=30)
            
            # Check for negative trends in key metrics
            if 'repayment_ratio' in future_predictions:
                future_repayment = future_predictions['repayment_ratio']
                current_repayment = user_data['repayment_ratio'].values[0] if 'repayment_ratio' in user_data else 0.5
                predicted_repayment = future_repayment['yhat'].mean()
                
                if predicted_repayment < current_repayment * 0.8:  # 20% decrease
                    warnings['declining_repayment_ratio'] = {
                        'severity': 'medium',
                        'current': current_repayment,
                        'predicted': predicted_repayment,
                        'description': 'Predicted decline in repayment ratio over the next 30 days'
                    }
            
            # Check for increasing wallet balance volatility
            if 'wallet_balance_volatility' in future_predictions:
                future_volatility = future_predictions['wallet_balance_volatility']
                current_volatility = user_data['wallet_balance_volatility'].values[0] if 'wallet_balance_volatility' in user_data else 0.2
                predicted_volatility = future_volatility['yhat'].mean()
                
                if predicted_volatility > current_volatility * 1.5:  # 50% increase
                    warnings['increasing_balance_volatility'] = {
                        'severity': 'medium',
                        'current': current_volatility,
                        'predicted': predicted_volatility,
                        'description': 'Predicted increase in wallet balance volatility'
                    }
        
        # Add market correlation warning if relevant
        if 'market_volatility_correlation' in user_data and 'liquidation_risk_score' in user_data:
            market_correlation = user_data['market_volatility_correlation'].values[0]
            liquidation_risk = user_data['liquidation_risk_score'].values[0]
            
            combined_risk = market_correlation * liquidation_risk / 100.0
            if combined_risk > 0.6:
                warnings['market_vulnerability'] = {
                    'severity': 'high' if combined_risk > 0.8 else 'medium',
                    'value': combined_risk,
                    'description': 'High vulnerability to market fluctuations'
                }
        
        return warnings
    
    def calculate_risk_score(self, user_data):
        """
        Calculate a comprehensive risk score for a user (0-100) using ensemble methods.
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Risk score (0-100, higher means higher risk)
        """
        # Use multiple models in an ensemble approach for robust scoring
        
        # 1. Use the classifier for risk category
        risk_category = self.predict_risk_category(user_data)
        
        # 2. Use the default predictor for default probability
        default_prob = self.predict_default_probability(user_data)
        
        # 3. Process data for feature-based scoring
        processed_data = self.preprocess_data(user_data)
        
        # 4. Use time series predictions if available
        time_series_risk = self._evaluate_time_series_risk(user_data)
        
        # 5. Network analysis risk (would use graph analysis in production)
        network_risk = self._evaluate_network_risk(user_data)
        
        # 6. Market correlation risk
        market_risk = self._evaluate_market_risk(user_data)
        
        # Base score from risk category (0-25 for each category)
        base_score = risk_category * 25
        
        # Adjust with default probability (0-25)
        probability_adjustment = default_prob * 25
        
        # Use engineered features for adjustment (0-15)
        if 'combined_risk_indicator' in processed_data:
            feature_adjustment = processed_data['combined_risk_indicator'].values[0] * 15
            feature_adjustment = np.clip(feature_adjustment, 0, 15)
        else:
            feature_adjustment = 0
        
        # Time series prediction adjustment (0-15)
        time_series_adjustment = time_series_risk * 15
        
        # Network risk adjustment (0-10)
        network_adjustment = network_risk * 10
        
        # Market risk adjustment (0-10)
        market_adjustment = market_risk * 10
        
        # Apply weighted ensemble scoring
        weights = [0.25, 0.25, 0.15, 0.15, 0.1, 0.1]  # Weights for each component
        components = [
            base_score, 
            probability_adjustment, 
            feature_adjustment, 
            time_series_adjustment,
            network_adjustment,
            market_adjustment
        ]
        
        # Calculate weighted score
        risk_score = sum(w * c for w, c in zip(weights, components))
        
        # Apply non-linear transformation for more accurate representation
        # Use sigmoid-like function to handle extreme values better
        risk_score = 100 / (1 + np.exp(-0.05 * (risk_score - 50)))
        
        # Apply additional adjustment for identity verification status
        if 'identity_verified' in user_data.columns and user_data['identity_verified'].values[0]:
            verification_level = user_data['identity_verification_level'].values[0] 
            if isinstance(verification_level, str):
                if verification_level == 'full':
                    risk_score *= 0.8  # 20% reduction for full verification
                elif verification_level == 'advanced':
                    risk_score *= 0.85  # 15% reduction for advanced verification
                elif verification_level == 'basic':
                    risk_score *= 0.95  # 5% reduction for basic verification
        
        # Ensure it's within [0, 100]
        risk_score = np.clip(risk_score, 0, 100)
        
        return risk_score
        
    def _evaluate_time_series_risk(self, user_data):
        """
        Evaluate risk from time series predictions
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Risk factor (0-1)
        """
        # In production, this would use actual time series forecasts
        # For now, just extract a risk factor based on volatility features
        
        if 'wallet_balance_volatility' in user_data.columns:
            volatility = user_data['wallet_balance_volatility'].values[0]
        else:
            volatility = 0.3  # Default medium volatility
            
        if 'transaction_growth_rate' in user_data.columns:
            growth_rate = user_data['transaction_growth_rate'].values[0]
            # Negative growth is higher risk, positive growth is lower risk
            growth_factor = 0.5 - min(max(growth_rate, -0.5), 0.5)
        else:
            growth_factor = 0.25  # Default moderate risk
            
        # Combine factors
        return 0.6 * volatility + 0.4 * growth_factor
    
    def _evaluate_network_risk(self, user_data):
        """
        Evaluate risk from network analysis
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Risk factor (0-1)
        """
        # In production, this would use graph analysis of transaction networks
        # For demo purposes, use available network-related features
        
        risk_factor = 0.5  # Default medium risk
        
        # Adjust based on counterparty metrics if available
        if 'trusted_counterparties_ratio' in user_data.columns:
            trust_ratio = user_data['trusted_counterparties_ratio'].values[0]
            risk_factor -= trust_ratio * 0.3  # Lower risk with more trusted counterparties
            
        if 'network_centrality' in user_data.columns:
            centrality = user_data['network_centrality'].values[0]
            risk_factor -= centrality * 0.2  # Lower risk with higher centrality (more established)
            
        # Ensure it's within [0, 1]
        return np.clip(risk_factor, 0, 1)
    
    def _evaluate_market_risk(self, user_data):
        """
        Evaluate risk from market correlation
        
        Args:
            user_data (pd.DataFrame): User features
            
        Returns:
            float: Risk factor (0-1)
        """
        # In production, this would incorporate market volatility and correlation data
        # For demo purposes, use available market-related features
        
        risk_factor = 0.5  # Default medium risk
        
        # Adjust based on market correlation if available
        if 'market_volatility_correlation' in user_data.columns:
            correlation = user_data['market_volatility_correlation'].values[0]
            # Higher correlation means higher risk (more affected by market movements)
            risk_factor += correlation * 0.4
            
        if 'token_price_correlation' in user_data.columns:
            price_correlation = user_data['token_price_correlation'].values[0]
            # High absolute correlation (positive or negative) increases risk
            risk_factor += abs(price_correlation) * 0.3
            
        # Ensure it's within [0, 1]
        return np.clip(risk_factor, 0, 1)
    
    def save_models(self, directory='./models'):
        """
        Save all trained models to files.
        
        Args:
            directory (str): Directory to save models
        """
        os.makedirs(directory, exist_ok=True)
        
        # Save risk classifier
        if self.risk_classifier:
            joblib.dump(self.risk_classifier, f'{directory}/risk_classifier.joblib')
        
        # Save default predictor
        if self.default_predictor:
            joblib.dump(self.default_predictor, f'{directory}/default_predictor.joblib')
        
        # Save time series models
        if hasattr(self, 'time_series_models') and self.time_series_models:
            # Save a list of user IDs with time series models
            with open(f'{directory}/time_series_users.json', 'w') as f:
                json.dump(list(self.time_series_models.keys()), f)
            
            # Create directory for time series models
            os.makedirs(f'{directory}/time_series', exist_ok=True)
            
            # Save each user's models
            for user_id, models in self.time_series_models.items():
                user_dir = f'{directory}/time_series/{user_id}'
                os.makedirs(user_dir, exist_ok=True)
                
                for feature, model in models.items():
                    if isinstance(model, Prophet):
                        model.save(f'{user_dir}/{feature}.json')
                    elif isinstance(model, dict) and model['type'] == 'ARIMA':
                        joblib.dump(model, f'{user_dir}/{feature}_arima.joblib')
        
        # Save interest optimizer if trained
        if self.interest_optimizer:
            self.interest_optimizer.save(f'{directory}/interest_optimizer')
        
        # Save feature ranges for normalization
        if hasattr(self, 'feature_ranges'):
            with open(f'{directory}/feature_ranges.json', 'w') as f:
                json.dump(self.feature_ranges, f)
        
        print(f"Models saved to {directory}")
    
    def load_models(self, directory='./models'):
        """
        Load all trained models from files.
        
        Args:
            directory (str): Directory containing saved models
        """
        # Load risk classifier
        if os.path.exists(f'{directory}/risk_classifier.joblib'):
            self.risk_classifier = joblib.load(f'{directory}/risk_classifier.joblib')
        
        # Load default predictor
        if os.path.exists(f'{directory}/default_predictor.joblib'):
            self.default_predictor = joblib.load(f'{directory}/default_predictor.joblib')
        
        # Load time series models
        if os.path.exists(f'{directory}/time_series_users.json'):
            with open(f'{directory}/time_series_users.json', 'r') as f:
                user_ids = json.load(f)
            
            self.time_series_models = {}
            
            for user_id in user_ids:
                user_dir = f'{directory}/time_series/{user_id}'
                if os.path.isdir(user_dir):
                    self.time_series_models[user_id] = {}
                    
                    # Load each model
                    for filename in os.listdir(user_dir):
                        feature = filename.split('.')[0]
                        file_path = f'{user_dir}/{filename}'
                        
                        if filename.endswith('.json'):
                            # Load Prophet model
                            model = Prophet()
                            model = model.load(file_path)
                            self.time_series_models[user_id][feature] = model
                        elif filename.endswith('_arima.joblib'):
                            # Load ARIMA model
                            self.time_series_models[user_id][feature.replace('_arima', '')] = joblib.load(file_path)
        
        # Load interest optimizer if it exists
        if os.path.exists(f'{directory}/interest_optimizer.zip'):
            self.interest_optimizer = PPO.load(f'{directory}/interest_optimizer')
        
        # Load feature ranges for normalization
        if os.path.exists(f'{directory}/feature_ranges.json'):
            with open(f'{directory}/feature_ranges.json', 'r') as f:
                self.feature_ranges = json.load(f)
        
        print(f"Models loaded from {directory}")
    
    def get_feature_importance(self):
        """
        Get the importance of each feature in the risk classifier.
        
        Returns:
            pd.DataFrame: Feature importance
        """
        if not self.risk_classifier:
            raise ValueError("Risk classifier not trained. Call train_risk_classifier() first.")
        
        # Get the model from the pipeline
        model = self.risk_classifier.named_steps['classifier']
        
        # Get feature names after preprocessing
        preprocessor = self.risk_classifier.named_steps['preprocessor']
        feature_names = self.features.copy()
        
        # For models that support feature_importances_
        if hasattr(model, 'feature_importances_'):
            importance = model.feature_importances_
            
            # Create a DataFrame
            feature_importance = pd.DataFrame({
                'Feature': feature_names,
                'Importance': importance
            })
            
            return feature_importance.sort_values('Importance', ascending=False)
        else:
            return pd.DataFrame({'Feature': feature_names, 'Importance': np.ones(len(feature_names))})


class InterestRateEnv(gym.Env):
    """
    Reinforcement learning environment for optimizing interest rates.
    """
    
    def __init__(self, config):
        """
        Initialize the environment.
        
        Args:
            config (dict): Configuration parameters
        """
        super(InterestRateEnv, self).__init__()
        
        # Environment parameters
        self.config = config
        self.user_risk_category = config.get('user_risk_category', 1)  # Default to medium risk
        self.default_probability = config.get('default_probability', 0.1)
        self.market_conditions = config.get('market_conditions', {
            'base_rate': 0.03,
            'market_volatility': 0.2,
            'platform_liquidity': 0.7
        })
        
        # Action space: continuous interest rate adjustment
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(1,), dtype=np.float32
        )
        
        # Observation space: user risk, default prob, market conditions
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0]),
            high=np.array([3, 1, 0.2, 1, 1]),
            dtype=np.float32
        )
        
        # Current state
        self.state = None
        self.current_interest_rate = None
        self.steps_done = 0
        self.max_steps = 10
        
        # Reset the environment
        self.reset()
    
    def reset(self):
        """
        Reset the environment to initial state.
        
        Returns:
            np.array: Initial observation
        """
        # Initial interest rate based on risk category
        initial_rates = [0.03, 0.06, 0.09, 0.12]  # For risk categories 0-3
        self.current_interest_rate = initial_rates[self.user_risk_category]
        
        # Set initial state
        self.state = np.array([
            self.user_risk_category,
            self.default_probability,
            self.market_conditions['base_rate'],
            self.market_conditions['market_volatility'],
            self.market_conditions['platform_liquidity']
        ], dtype=np.float32)
        
        self.steps_done = 0
        
        return self.state
    
    def step(self, action):
        """
        Take an action in the environment.
        
        Args:
            action (np.array): Interest rate adjustment
            
        Returns:
            tuple: (observation, reward, done, info)
        """
        # Convert action to interest rate change
        rate_change = action[0] * 0.05  # Scale action to max ±5% change
        
        # Update interest rate
        new_interest_rate = self.current_interest_rate + rate_change
        new_interest_rate = np.clip(new_interest_rate, 0.01, 0.25)  # Limit to 1-25%
        
        # Calculate reward
        reward = self._calculate_reward(new_interest_rate)
        
        # Update state
        self.current_interest_rate = new_interest_rate
        self.steps_done += 1
        done = self.steps_done >= self.max_steps
        
        # Update default probability based on interest rate change
        # Higher rates increase default probability slightly
        elasticity = 0.2  # Sensitivity of default to rate changes
        default_change = rate_change * elasticity if rate_change > 0 else 0
        new_default_prob = self.default_probability + default_change
        new_default_prob = np.clip(new_default_prob, 0.01, 0.99)
        
        # Update state
        self.state = np.array([
            self.user_risk_category,
            new_default_prob,
            self.market_conditions['base_rate'],
            self.market_conditions['market_volatility'],
            self.market_conditions['platform_liquidity']
        ], dtype=np.float32)
        
        info = {
            'interest_rate': self.current_interest_rate,
            'default_probability': new_default_prob
        }
        
        return self.state, reward, done, info
    
    def _calculate_reward(self, interest_rate):
        """
        Calculate reward for the current state and action.
        
        Args:
            interest_rate (float): New interest rate
            
        Returns:
            float: Reward
        """
        # Factors affecting reward:
        # 1. Expected profit: interest_rate * (1 - default_probability)
        # 2. Competitiveness: how close to optimal rate for risk category
        # 3. Market alignment: comparison to base rate
        
        # Expected profit component
        expected_profit = interest_rate * (1 - self.default_probability)
        
        # Competitiveness component
        optimal_rate_for_risk = [0.04, 0.08, 0.12, 0.18][self.user_risk_category]
        rate_optimality = 1 - min(abs(interest_rate - optimal_rate_for_risk) / 0.1, 1)
        
        # Market alignment component
        market_premium = max(0, interest_rate - self.market_conditions['base_rate'])
        market_alignment = np.exp(-2 * abs(market_premium - 0.05 * self.user_risk_category))
        
        # Combined reward
        reward = 5 * expected_profit + 3 * rate_optimality + 2 * market_alignment
        
        return reward
    
    def action_to_interest_rate(self, action):
        """
        Convert an action to an actual interest rate.
        
        Args:
            action (np.array): Action from policy
            
        Returns:
            float: Interest rate
        """
        rate_change = action[0] * 0.05
        interest_rate = self.current_interest_rate + rate_change
        interest_rate = np.clip(interest_rate, 0.01, 0.25)
        
        return interest_rate


def simulate_training_data(n_samples=1000):
    """
    Generate simulated data for testing the model.
    
    Args:
        n_samples (int): Number of samples to generate
        
    Returns:
        tuple: (X_train, y_train) - features and labels
    """
    np.random.seed(42)
    
    # Generate random data for basic features
    data = pd.DataFrame({
        'user_id': [f'user_{i}' for i in range(n_samples)],
        'transaction_count': np.random.poisson(20, n_samples),
        'avg_transaction_value': np.random.exponential(100, n_samples),
        'max_transaction_value': np.random.exponential(300, n_samples),
        'min_transaction_value': np.random.exponential(10, n_samples),
        'transaction_frequency': np.random.exponential(0.5, n_samples),
        'transaction_regularity': np.random.beta(5, 2, n_samples),
        'transaction_growth_rate': np.random.normal(0.05, 0.1, n_samples),
        'incoming_tx_ratio': np.random.beta(2, 2, n_samples),
        'wallet_age_days': np.random.randint(1, 1000, n_samples),
        'wallet_balance': np.random.exponential(1000, n_samples),
        'wallet_balance_volatility': np.random.beta(2, 5, n_samples),
        'balance_utilization_ratio': np.random.beta(2, 3, n_samples),
        'address_entropy': np.random.uniform(0, 1, n_samples),
        'previous_loans_count': np.random.poisson(3, n_samples),
        'repayment_ratio': np.random.beta(8, 2, n_samples),
        'default_count': np.random.poisson(0.5, n_samples),
        'avg_loan_duration': np.random.exponential(30, n_samples),
        'max_loan_amount': np.random.exponential(500, n_samples),
        'early_repayment_frequency': np.random.beta(2, 5, n_samples),
        'late_payment_frequency': np.random.beta(1, 5, n_samples),
        'collateral_diversity': np.random.randint(1, 5, n_samples),
        'collateral_value_ratio': np.random.beta(8, 2, n_samples),
        'collateral_quality_score': np.random.choice(['A', 'B', 'C', 'D'], n_samples),
        'collateral_volatility': np.random.beta(2, 5, n_samples),
        'network_centrality': np.random.beta(2, 5, n_samples),
        'unique_counterparties': np.random.poisson(10, n_samples),
        'trusted_counterparties_ratio': np.random.beta(5, 2, n_samples),
        'counterparty_risk_exposure': np.random.beta(2, 5, n_samples),
        'cross_chain_activity': np.random.poisson(2, n_samples),
        'defi_protocol_diversity': np.random.poisson(3, n_samples),
        'lending_protocol_interactions': np.random.poisson(5, n_samples),
        'staking_history_score': np.random.beta(3, 3, n_samples) * 100,
        'governance_participation': np.random.beta(1, 10, n_samples),
        'market_volatility_correlation': np.random.beta(3, 3, n_samples),
        'token_price_correlation': np.random.normal(0, 0.3, n_samples),
        'liquidation_risk_score': np.random.beta(2, 5, n_samples) * 100,
        'identity_verification_level': np.random.choice(['none', 'basic', 'advanced', 'full'], n_samples),
        'security_score': np.random.beta(5, 2, n_samples) * 100,
        'social_trust_score': np.random.beta(5, 2, n_samples) * 100
    })
    
    # Create more complex relationships between features
    # High default count should correlate with low repayment ratio
    correlation_factor = 0.7
    data['repayment_ratio'] = data['repayment_ratio'] * (1 - correlation_factor * data['default_count'] / (data['previous_loans_count'].clip(lower=1)))
    
    # Higher loan amounts should correlate with higher wallet balances
    data['max_loan_amount'] = data['max_loan_amount'] * (0.3 + 0.7 * data['wallet_balance'] / data['wallet_balance'].mean())
    
    # Social trust should correlate with trusted counterparties
    data['social_trust_score'] = data['social_trust_score'] * 0.6 + data['trusted_counterparties_ratio'] * 40 * 0.4
    
    # Wallet volatility should correlate with collateral volatility
    data['wallet_balance_volatility'] = data['wallet_balance_volatility'] * 0.7 + data['collateral_volatility'] * 0.3
    
    # Create risk labels (0: Low, 1: Medium, 2: High, 3: Very High)
    risk_factors = (
        data['default_count'] * 3 -
        data['repayment_ratio'] * 10 + 
        data['late_payment_frequency'] * 5 + 
        data['wallet_balance_volatility'] * 3 -
        data['collateral_value_ratio'] * 5 +
        data['market_volatility_correlation'] * 2
    )
    
    # Normalize risk factors and add some randomness
    risk_factors = (risk_factors - risk_factors.min()) / (risk_factors.max() - risk_factors.min())
    risk_factors = risk_factors + np.random.normal(0, 0.1, n_samples)
    risk_factors = np.clip(risk_factors, 0, 1)
    
    # Convert to 4 classes
    bins = [-np.inf, 0.25, 0.5, 0.75, np.inf]
    labels = [0, 1, 2, 3]
    y_risk = pd.cut(risk_factors, bins=bins, labels=labels).astype(int)
    
    # Create default probability (continuous target for regression)
    default_prob = (
        0.05 +
        data['default_count'] * 0.1 -
        data['repayment_ratio'] * 0.3 +
        data['late_payment_frequency'] * 0.2 +
        data['wallet_balance_volatility'] * 0.1 -
        data['collateral_value_ratio'] * 0.2 +
        data['market_volatility_correlation'] * 0.1
    )
    default_prob = np.clip(default_prob, 0.01, 0.99)
    
    # Generate temporal data for time series modeling
    temporal_data = {}
    for i in range(min(100, n_samples)):  # Create temporal data for first 100 users
        user_id = f'user_{i}'
        
        # Generate 90 days of history
        dates = [datetime.now() - timedelta(days=j) for j in range(90, 0, -1)]
        
        # Base values from the main dataset
        base_tx_count = data.loc[i, 'transaction_count']
        base_tx_value = data.loc[i, 'avg_transaction_value']
        base_wallet_balance = data.loc[i, 'wallet_balance']
        base_repayment = data.loc[i, 'repayment_ratio']
        
        # Generate time series with trends and noise
        ts_data = pd.DataFrame({
            'timestamp': dates,
            'transaction_count': [
                max(0, base_tx_count * (1 + 0.001 * j + np.random.normal(0, 0.1)))
                for j in range(90)
            ],
            'avg_transaction_value': [
                max(1, base_tx_value * (1 + 0.002 * j + np.random.normal(0, 0.05)))
                for j in range(90)
            ],
            'wallet_balance': [
                max(1, base_wallet_balance * (1 + 0.003 * j + np.random.normal(0, 0.1)))
                for j in range(90)
            ],
            'repayment_ratio': [
                min(1, max(0, base_repayment * (1 + 0.0005 * j + np.random.normal(0, 0.02))))
                for j in range(90)
            ]
        })
        
        # Add market conditions
        ts_data['market_volatility_correlation'] = [
            min(1, max(0, 0.5 + 0.1 * np.sin(j/10) + np.random.normal(0, 0.05)))
            for j in range(90)
        ]
        
        # Create defaults
        ts_data['default_count'] = 0
        # Add a default event for some users
        if data.loc[i, 'default_count'] > 0:
            default_days = np.random.choice(range(90), size=int(data.loc[i, 'default_count']), replace=False)
            for day in default_days:
                ts_data.loc[day, 'default_count'] = 1
        
        temporal_data[user_id] = ts_data
    
    return data, y_risk, default_prob, temporal_data


if __name__ == "__main__":
    # Simulate data
    data, y_risk, default_prob, temporal_data = simulate_training_data(1000)
    
    # Split into train and test sets
    X_train, X_test, y_risk_train, y_risk_test, y_default_train, y_default_test = train_test_split(
        data, y_risk, default_prob, test_size=0.2, random_state=42
    )
    
    # Create and train the model
    model = RiskAssessmentModel()
    
    # Train risk classifier
    print("Training risk classifier...")
    model.train_risk_classifier(X_train, y_risk_train)
    
    # Train default predictor
    print("Training default predictor...")
    model.train_default_predictor(X_train, y_default_train)
    
    # Train time series models for a subset of users
    print("Training time series models...")
    model.train_time_series_models(temporal_data)
    
    # Train interest rate optimizer
    print("Training interest rate optimizer...")
    env_config = {
        'market_conditions': {
            'base_rate': 0.03,
            'market_volatility': 0.2,
            'platform_liquidity': 0.7
        }
    }
    model.train_interest_optimizer(env_config)
    
    # Evaluate the risk classifier
    y_risk_pred = model.risk_classifier.predict(X_test)
    print("\nRisk Classifier Evaluation:")
    print(classification_report(y_risk_test, y_risk_pred))
    
    # Evaluate the default predictor
    y_default_pred = model.default_predictor.predict(X_test)
    mse = mean_squared_error(y_default_test, y_default_pred)
    print(f"\nDefault Predictor MSE: {mse:.4f}")
    
    # Save the model
    model.save_models('./models')
    
    # Get feature importance
    importance = model.get_feature_importance()
    print("\nFeature Importance:")
    print(importance.head(10))
    
    # Test early warning signals
    test_user_id = 'user_0'
    test_user_data = data[data['user_id'] == test_user_id]
    if not test_user_data.empty:
        warnings = model.get_early_warning_signals(test_user_id, test_user_data)
        print("\nEarly Warning Signals:")
        for warning_type, details in warnings.items():
            print(f"{warning_type}: {details['severity']} - {details['description']}")
    
    # Test interest rate optimization
    if test_user_data.empty:
        test_user_data = pd.DataFrame([data.iloc[0]])
    
    optimized_rate = model.optimize_interest_rate(
        test_user_data,
        current_market_conditions={
            'base_rate': 0.03,
            'market_volatility': 0.2,
            'platform_liquidity': 0.7
        }
    )
    print(f"\nOptimized Interest Rate: {optimized_rate:.2%}")
    
    # Calculate risk score
    risk_score = model.calculate_risk_score(test_user_data)
    print(f"\nFinal Risk Score (0-100): {risk_score:.1f}")
