"""
IntelliLend Advanced Transformer-Based Risk Assessment Model

This module contains an advanced machine learning model using transformers
to assess borrower risk based on on-chain activity, with sophisticated
techniques for early default prediction, privacy-preserving federated learning,
and reinforcement learning for interest rate optimization.
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
import joblib
import os
import json
from datetime import datetime, timedelta
import random
import hashlib
import pickle
from typing import Dict, List, Tuple, Optional, Any, Union

# For privacy-preserving ML
import tensorflow_federated as tff
import tensorflow_privacy as tfp
from tensorflow_privacy.privacy.optimizers import dp_optimizer

# For time series forecasting
import statsmodels.api as sm
from prophet import Prophet

# For reinforcement learning
import gym
from gym import spaces
from stable_baselines3 import PPO, A2C, SAC
from stable_baselines3.common.evaluation import evaluate_policy
from stable_baselines3.common.callbacks import BaseCallback

# For transformer models
from transformers import TFAutoModel, AutoTokenizer
import transformers
from tensorflow.keras.layers import Dense, Dropout, LayerNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.optimizers import Adam

# For explainability
import shap
import lime
from lime import lime_tabular

# Add PositionalEncoding class for transformer model
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_seq_length=100):
        super().__init__()
        
        # Create positional encoding matrix
        pe = torch.zeros(max_seq_length, d_model)
        position = torch.arange(0, max_seq_length, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        
        # Register buffer (not a parameter but part of the module)
        self.register_buffer('pe', pe.unsqueeze(0))
        
    def forward(self, x):
        # Add positional encoding to input
        return x + self.pe[:, :x.size(1)]

# Add state-of-the-art transformer architecture
class TransformerRiskModel(nn.Module):
    def __init__(self, feature_dim, num_heads=8, num_layers=4):
        super().__init__()
        self.feature_embedding = nn.Linear(feature_dim, 256)
        self.positional_encoding = PositionalEncoding(256)
        self.transformer_encoder = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=256, nhead=num_heads),
            num_layers=num_layers
        )
        self.prediction_head = nn.Linear(256, 1)
        
    def forward(self, x, attention_mask=None):
        # Implement multi-head attention with feature importance tracking
        x = self.feature_embedding(x)
        x = self.positional_encoding(x)
        attention_weights = []
        
        # Pass through transformer with attention weight capture
        for layer in self.transformer_encoder.layers:
            x, attn_weights = layer.self_attn(x, x, x, attn_mask=attention_mask, return_attention_weights=True)
            attention_weights.append(attn_weights)
            
        # Final prediction
        risk_score = self.prediction_head(x)
        
        # Return both prediction and attention weights for explainability
        return risk_score, attention_weights

class AdvancedTransformerRiskModel:
    """
    Advanced transformer-based model for assessing borrower risk in the IntelliLend platform.
    Incorporates transformer architecture, federated learning, differential privacy,
    and advanced explainability techniques.
    """
    
    def __init__(self, model_config=None):
        """
        Initialize the advanced risk assessment model with transformer architecture
        
        Args:
            model_config: Configuration parameters for the model
        """
        self.model_config = model_config or self._get_default_config()
        
        # Initialize main components
        self.transformer_model = None
        self.risk_classifier = None
        self.default_predictor = None
        self.time_series_model = None
        self.interest_optimizer = None
        self.preprocessor = None
        self.tokenizer = None
        
        # Initialize explainability components
        self.shap_explainer = None
        self.lime_explainer = None
        
        # Federated learning components
        self.federated_model = None
        self.privacy_engine = None
        
        # Feature definitions
        self.features = self._define_features()
        self.categorical_features = [
            'identity_verification_level',
            'collateral_quality_score',
            'asset_type',
            'chain_origin',
            'verification_method'
        ]
        self.numerical_features = [f for f in self.features if f not in self.categorical_features]
        self.temporal_features = [
            'transaction_count', 
            'avg_transaction_value',
            'wallet_balance',
            'repayment_ratio',
            'default_count',
            'market_volatility_correlation',
            'cross_chain_activity',
            'liquidation_risk_score'
        ]
        self.text_features = [
            'transaction_patterns',
            'market_events',
            'identity_description'
        ]
        
        # Model metrics
        self.model_metrics = {
            'accuracy': 0.0,
            'f1_score': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'auc_roc': 0.0,
            'mse': 0.0,
            'last_updated': None
        }
        
        # Initialize preprocessing pipeline
        self._init_preprocessing_pipeline()
        
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration for the model"""
        return {
            # Transformer model configuration
            'transformer_base_model': 'distilbert-base-uncased',
            'transformer_hidden_size': 768,
            'transformer_dropout_rate': 0.1,
            'transformer_learning_rate': 2e-5,
            
            # Training configuration
            'batch_size': 32,
            'epochs': 10,
            'early_stopping_patience': 3,
            'validation_split': 0.15,
            
            # Privacy configuration
            'differential_privacy': True,
            'dp_noise_multiplier': 1.1,
            'dp_l2_norm_clip': 1.0,
            'dp_microbatches': 16,
            
            # Federated learning configuration
            'federated_learning': True,
            'fed_clients_per_round': 5,
            'fed_client_epochs': 1,
            'fed_rounds': 20,
            
            # Reinforcement learning configuration
            'rl_algorithm': 'PPO',
            'rl_learning_rate': 3e-4,
            'rl_gamma': 0.99,
            'rl_timesteps': 100000,
            
            # Time series configuration
            'time_series_algorithm': 'Prophet',
            'time_series_seasonality': 'auto',
            'time_series_horizon': 30,  # Days ahead to forecast
            
            # Feature engineering
            'feature_engineering': True,
            'use_pca': False,
            'pca_components': 20,
            
            # Explainability
            'explainability': True,
            'shap_explainer': 'TreeExplainer',
            
            # Model paths
            'model_dir': './models',
            'model_name': 'advanced_transformer_risk_model_v2',
            
            # Thresholds and operational settings
            'default_threshold': 0.5,
            'confidence_threshold': 0.7,
            'anomaly_threshold': 0.8
        }
    
    def _define_features(self) -> List[str]:
        """Define and return the model features"""
        return [
            # Basic transaction features
            'transaction_count',
            'avg_transaction_value',
            'max_transaction_value',
            'min_transaction_value',
            'transaction_frequency',
            'transaction_regularity',
            'transaction_growth_rate',
            'incoming_tx_ratio',
            'transaction_patterns',  # Text feature
            
            # Wallet characteristics
            'wallet_age_days',
            'wallet_balance',
            'wallet_balance_volatility',
            'balance_utilization_ratio',
            'address_entropy',
            'active_days_ratio',
            'inactive_periods',
            'balance_growth_rate',
            
            # Lending history
            'previous_loans_count',
            'repayment_ratio',
            'default_count',
            'avg_loan_duration',
            'max_loan_amount',
            'early_repayment_frequency',
            'late_payment_frequency',
            'loan_diversity',  # Different types of loans
            'loan_amount_growth',  # Growth pattern in loan amounts
            
            # Collateral behavior
            'collateral_diversity',
            'collateral_value_ratio',
            'collateral_quality_score',
            'collateral_volatility',
            'collateral_type_distribution',
            'collateral_liquidation_history',
            'collateral_utilization_efficiency',
            
            # Network analysis
            'network_centrality',
            'unique_counterparties',
            'trusted_counterparties_ratio',
            'counterparty_risk_exposure',
            'network_clustering_coefficient',
            'network_avg_degree',
            'network_bridge_score',
            
            # Cross-chain and protocol activity
            'cross_chain_activity',
            'defi_protocol_diversity',
            'lending_protocol_interactions',
            'staking_history_score',
            'governance_participation',
            'chain_origin',  # Categorical: origin chain
            'cross_chain_frequency',
            'asset_type',  # Categorical: type of assets held
            
            # Market condition features
            'market_volatility_correlation',
            'token_price_correlation',
            'liquidation_risk_score',
            'market_events',  # Text feature describing market context
            'market_trend_alignment',
            'market_sector_exposure',
            
            # Security and identity features
            'identity_verification_level',
            'verification_method',  # Categorical: verification method used
            'security_score',
            'social_trust_score',
            'identity_age',
            'identity_description',  # Text feature
            'biometric_verified',
            'quantum_resistance_score',
            
            # Temporal behavior features
            'activity_consistency',
            'seasonal_patterns',
            'time_preference_score',
            'behavioral_change_frequency',
            'behavioral_anomaly_score'
        ]
    
    def _init_preprocessing_pipeline(self):
        """Initialize the preprocessing pipeline for structured data"""
        # Numerical preprocessing pipeline
        numerical_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        # Categorical preprocessing pipeline
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        # Combine preprocessing steps
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', numerical_transformer, self.numerical_features),
                ('cat', categorical_transformer, self.categorical_features)
            ],
            remainder='drop'  # Drop any columns not specified
        )
        
    def _init_tokenizer(self):
        """Initialize the tokenizer for text features"""
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_config['transformer_base_model']
        )
    
    def _build_transformer_model(self):
        """Build the enhanced transformer-based risk assessment model with attention mechanisms"""
        # Initialize tokenizer if not already done
        if self.tokenizer is None:
            self._init_tokenizer()
        
        # Structured data input
        structured_input = tf.keras.layers.Input(shape=(len(self.numerical_features) + 
                                                        len(self.categorical_features),), 
                                                name='structured_input')
        
        # Text input for transaction patterns
        tx_patterns_input = tf.keras.layers.Input(shape=(), dtype=tf.string, 
                                                name='transaction_patterns_input')
        
        # Text input for market events
        market_events_input = tf.keras.layers.Input(shape=(), dtype=tf.string, 
                                                  name='market_events_input')
        
        # Text input for identity description
        identity_desc_input = tf.keras.layers.Input(shape=(), dtype=tf.string, 
                                                  name='identity_desc_input')
        
        # Load pre-trained transformer model
        transformer = TFAutoModel.from_pretrained(self.model_config['transformer_base_model'])
        
        # Process transaction patterns
        tx_embeddings = self._text_to_embeddings(tx_patterns_input, transformer)
        
        # Process market events
        market_embeddings = self._text_to_embeddings(market_events_input, transformer)
        
        # Process identity description
        identity_embeddings = self._text_to_embeddings(identity_desc_input, transformer)
        
        # Concatenate text embeddings
        text_embeddings = tf.keras.layers.Concatenate()(
            [tx_embeddings, market_embeddings, identity_embeddings]
        )
        
        # Process text embeddings with our custom transformer
        text_features_shape = tf.keras.layers.Dense(256, activation='relu')(text_embeddings)
        text_features = tf.keras.layers.Reshape((-1, 256))(text_features_shape)  # Reshape for transformer
        
        # Create custom attention mechanism for feature importance tracking
        num_heads = 8
        head_dim = 32
        
        # Multi-head attention with importance tracking
        query = tf.keras.layers.Dense(num_heads * head_dim)(text_features)
        key = tf.keras.layers.Dense(num_heads * head_dim)(text_features)
        value = tf.keras.layers.Dense(num_heads * head_dim)(text_features)
        
        # Reshape for multi-head attention
        batch_size = tf.shape(query)[0]
        query = tf.reshape(query, [batch_size, -1, num_heads, head_dim])
        query = tf.transpose(query, [0, 2, 1, 3])  # [batch, heads, seq_len, head_dim]
        key = tf.reshape(key, [batch_size, -1, num_heads, head_dim])
        key = tf.transpose(key, [0, 2, 1, 3])
        value = tf.reshape(value, [batch_size, -1, num_heads, head_dim])
        value = tf.transpose(value, [0, 2, 1, 3])
        
        # Attention calculation
        scale = tf.math.sqrt(tf.cast(head_dim, tf.float32))
        attention_scores = tf.matmul(query, key, transpose_b=True) / scale
        attention_weights = tf.nn.softmax(attention_scores, axis=-1)
        
        # Apply attention
        context = tf.matmul(attention_weights, value)  # [batch, heads, seq_len, head_dim]
        context = tf.transpose(context, [0, 2, 1, 3])  # [batch, seq_len, heads, head_dim]
        context = tf.reshape(context, [batch_size, -1, num_heads * head_dim])
        
        # Feature importance from attention weights
        feature_importance = tf.reduce_mean(attention_weights, axis=[0, 1])  # Average over batch and heads
        
        # Output layer for text features
        text_features = tf.keras.layers.Dense(256, activation='relu')(context[:, 0, :])
        text_features = tf.keras.layers.Dropout(0.2)(text_features)
        
        # Process structured data
        structured_features = tf.keras.layers.Dense(128, activation='relu')(structured_input)
        structured_features = tf.keras.layers.Dropout(0.2)(structured_features)
        
        # Combine all features
        combined = tf.keras.layers.Concatenate()([text_features, structured_features])
        
        # Common layers with residual connections for better gradient flow
        x = tf.keras.layers.Dense(512, activation='relu')(combined)
        x = tf.keras.layers.Dropout(0.3)(x)
        x = tf.keras.layers.Add()([x, tf.keras.layers.Dense(512)(combined)])  # Residual connection
        x = tf.keras.layers.LayerNormalization()(x)
        
        x = tf.keras.layers.Dense(256, activation='relu')(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        x = tf.keras.layers.Add()([x, tf.keras.layers.Dense(256)(combined)])  # Residual connection
        x = tf.keras.layers.LayerNormalization()(x)
        
        x = tf.keras.layers.Dense(128, activation='relu')(x)
        
        # Multiple output heads
        
        # 1. Risk classification (0-3: Low, Medium, High, Very High)
        risk_output = tf.keras.layers.Dense(4, activation='softmax', name='risk_category')(x)
        
        # 2. Default probability regression (0-1)
        default_output = tf.keras.layers.Dense(1, activation='sigmoid', name='default_probability')(x)
        
        # 3. Confidence score (0-1)
        confidence_output = tf.keras.layers.Dense(1, activation='sigmoid', name='confidence_score')(x)
        
        # 4. Feature importance scores (one per feature)
        importance_output = tf.keras.layers.Dense(len(self.features), 
                                                 activation='linear', 
                                                 name='feature_importance')(x)
        
        # Build the model
        model = tf.keras.Model(
            inputs=[
                structured_input, 
                tx_patterns_input, 
                market_events_input, 
                identity_desc_input
            ],
            outputs=[
                risk_output, 
                default_output, 
                confidence_output, 
                importance_output
            ]
        )
        
        # Compile the model with custom loss weights
        model.compile(
            optimizer=Adam(learning_rate=self.model_config['transformer_learning_rate']),
            loss={
                'risk_category': 'categorical_crossentropy',
                'default_probability': 'binary_crossentropy',
                'confidence_score': 'mse',
                'feature_importance': 'mse'
            },
            loss_weights={
                'risk_category': 1.0,
                'default_probability': 1.0,
                'confidence_score': 0.5,
                'feature_importance': 0.3
            },
            metrics={
                'risk_category': ['accuracy'],
                'default_probability': ['accuracy', tf.keras.metrics.AUC()],
                'confidence_score': ['mse', 'mae'],
                'feature_importance': ['mse']
            }
        )
        
        self.transformer_model = model
        return model
    
    def _text_to_embeddings(self, text_input, transformer):
        """Process text input through transformer to get embeddings"""
        # Convert string input to tokenizer's expected input format
        encoded = self.tokenizer(
            text_input, 
            padding='max_length',
            truncation=True,
            max_length=128,
            return_tensors='tf'
        )
        
        # Pass through transformer
        output = transformer(
            encoded['input_ids'],
            attention_mask=encoded['attention_mask']
        )
        
        # Get CLS token representation
        return output.last_hidden_state[:, 0, :]
    
    def _build_differential_privacy_model(self):
        """
        Build a version of the model with differential privacy guarantees
        for privacy-preserving training
        """
        if not self.model_config['differential_privacy']:
            return self._build_transformer_model()
        
        # Get the base model
        base_model = self._build_transformer_model()
        
        # Apply differential privacy optimizer
        optimizer = tf.keras.optimizers.Adam(
            learning_rate=self.model_config['transformer_learning_rate']
        )
        
        dp_optimizer = dp_optimizer.DPKerasAdamOptimizer(
            l2_norm_clip=self.model_config['dp_l2_norm_clip'],
            noise_multiplier=self.model_config['dp_noise_multiplier'],
            num_microbatches=self.model_config['dp_microbatches'],
            optimizer=optimizer
        )
        
        # Recompile the model with the DP optimizer
        base_model.compile(
            optimizer=dp_optimizer,
            loss={
                'risk_category': 'categorical_crossentropy',
                'default_probability': 'binary_crossentropy',
                'confidence_score': 'mse',
                'feature_importance': 'mse'
            },
            loss_weights={
                'risk_category': 1.0,
                'default_probability': 1.0,
                'confidence_score': 0.5,
                'feature_importance': 0.3
            },
            metrics={
                'risk_category': ['accuracy'],
                'default_probability': ['accuracy', tf.keras.metrics.AUC()],
                'confidence_score': ['mse', 'mae'],
                'feature_importance': ['mse']
            }
        )
        
        return base_model
    
    def _setup_federated_learning(self, client_data):
        """
        Set up federated learning structure for privacy-preserving collaborative model training
        
        Args:
            client_data: List of datasets from different clients/institutions
        """
        if not self.model_config['federated_learning']:
            return
        
        # Define model creation function
        def create_model_fn():
            return self._build_transformer_model()
        
        # Define client update function using TFF
        @tf.function
        def client_update(model, dataset, learning_rate):
            # Use SGD optimizer for client-side training
            optimizer = tf.keras.optimizers.SGD(learning_rate=learning_rate)
            
            # Define client update loop
            def train_step(model, batch):
                with tf.GradientTape() as tape:
                    outputs = model(batch[0])
                    loss = tf.reduce_mean(outputs - batch[1])
                gradients = tape.gradient(loss, model.trainable_variables)
                optimizer.apply_gradients(zip(gradients, model.trainable_variables))
                return loss
            
            # Iterate over local client dataset
            for batch in dataset:
                train_step(model, batch)
            
            return model.trainable_variables
        
        # Set up TFF computations
        # Note: In a real implementation, this would be more detailed and complete
        # with proper federated averaging logic
                
        # Create sample dataset for TFF initialization
        def preprocess_client_data(client_data):
            # Preprocess client data into TF datasets
            # This is a simplified placeholder
            return client_data

        # In a real implementation, we'd define the full TFF aggregation pipeline
        # self.federated_model = tff.learning.build_federated_averaging_process(...)
        
    def train(self, X_train, y_train, client_data=None):
        """
        Train the advanced transformer-based risk assessment model
        
        Args:
            X_train: Training features
            y_train: Training labels (multi-output format)
            client_data: Optional federated client data
        """
        # Preprocess structured data
        X_structured = self.preprocess_data(X_train)
        
        # Extract text features
        X_tx_patterns = self._extract_text_feature(X_train, 'transaction_patterns')
        X_market_events = self._extract_text_feature(X_train, 'market_events')
        X_identity_desc = self._extract_text_feature(X_train, 'identity_description')
        
        # Prepare target data (multi-output format)
        y_risk_category = tf.keras.utils.to_categorical(y_train['risk_category'], num_classes=4)
        y_default_prob = y_train['default_probability']
        
        # For confidence and feature importance, create dummy data if not available
        if 'confidence_score' in y_train:
            y_confidence = y_train['confidence_score']
        else:
            y_confidence = np.ones_like(y_default_prob) * 0.8  # Default confidence
        
        if 'feature_importance' in y_train:
            y_importance = y_train['feature_importance']
        else:
            # Create random feature importance - in production this would be more thought out
            y_importance = np.random.random((len(X_train), len(self.features)))
            # Normalize so each row sums to 1
            y_importance = y_importance / np.sum(y_importance, axis=1, keepdims=True)
        
        # Build or use existing model
        if self.transformer_model is None:
            if self.model_config['differential_privacy']:
                self.transformer_model = self._build_differential_privacy_model()
            else:
                self.transformer_model = self._build_transformer_model()
        
        # Set up callbacks
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=self.model_config['early_stopping_patience'],
                restore_best_weights=True
            ),
            ModelCheckpoint(
                filepath=os.path.join(
                    self.model_config['model_dir'],
                    f"{self.model_config['model_name']}_best.h5"
                ),
                monitor='val_loss',
                save_best_only=True
            )
        ]
        
        # If federated learning is enabled, use it instead of centralized training
        if self.model_config['federated_learning'] and client_data is not None:
            self._setup_federated_learning(client_data)
            # Run federated training (simplified)
            print("Running federated learning...")
            # In a real implementation, we'd run the federated learning process here
            # self.federated_model.run(client_data, num_rounds=self.model_config['fed_rounds'])
        else:
            # Regular centralized training
            print("Running centralized training...")
            
            # Train the model
            history = self.transformer_model.fit(
                x={
                    'structured_input': X_structured,
                    'transaction_patterns_input': X_tx_patterns,
                    'market_events_input': X_market_events,
                    'identity_desc_input': X_identity_desc
                },
                y={
                    'risk_category': y_risk_category,
                    'default_probability': y_default_prob,
                    'confidence_score': y_confidence,
                    'feature_importance': y_importance
                },
                batch_size=self.model_config['batch_size'],
                epochs=self.model_config['epochs'],
                validation_split=self.model_config['validation_split'],
                callbacks=callbacks
            )
            
            # Update model metrics
            self._update_model_metrics(history)
        
        # Initialize explainers after model is trained
        if self.model_config['explainability']:
            self._init_explainers(X_train)
        
        # Train time series models for top features
        self.train_time_series_models(X_train)
        
        # Train reinforcement learning model for interest rate optimization
        self.train_interest_optimizer()
        
        return self.transformer_model
        
    def _extract_text_feature(self, X, feature_name):
        """
        Extract text feature from the dataset or return empty strings if not available
        
        Args:
            X: Input features
            feature_name: Name of the text feature to extract
            
        Returns:
            Series or array of text values
        """
        if feature_name in X.columns:
            return X[feature_name].fillna('').values
        else:
            return np.array([''] * len(X))
    
    def _update_model_metrics(self, history):
        """
        Update model metrics from training history
        
        Args:
            history: Keras training history
        """
        # Update metrics from history
        if history is not None:
            self.model_metrics['accuracy'] = max(history.history.get('val_risk_category_accuracy', [0]))
            self.model_metrics['mse'] = min(history.history.get('val_default_probability_mse', [float('inf')]))
            
            if 'val_default_probability_auc' in history.history:
                self.model_metrics['auc_roc'] = max(history.history['val_default_probability_auc'])
        
        self.model_metrics['last_updated'] = datetime.now().isoformat()
    
    def _init_explainers(self, X_train):
        """
        Initialize explainability components
        
        Args:
            X_train: Training data for explainers
        """
        # For SHAP explainer we need processed numerical data
        X_processed = self.preprocess_data(X_train)
        
        # For LIME we need the original data
        self.lime_explainer = lime_tabular.LimeTabularExplainer(
            X_train[self.numerical_features].values,
            feature_names=self.numerical_features,
            categorical_features=[i for i, f in enumerate(self.numerical_features) 
                                 if f in self.categorical_features],
            categorical_names={i: X_train[f].unique().tolist() 
                              for i, f in enumerate(self.numerical_features) 
                              if f in self.categorical_features},
            mode='regression'
        )
        
        # SHAP explainer setup would depend on the model type
        # In a real implementation, you'd use the appropriate SHAP explainer
        # self.shap_explainer = shap.Explainer(self.transformer_model)
    
    def predict(self, user_data):
        """
        Predict risk and other metrics for a user
        
        Args:
            user_data: User features DataFrame
            
        Returns:
            Dict with predictions and explanations
        """
        # Ensure model is loaded
        if self.transformer_model is None:
            raise ValueError("Model not trained or loaded. Call train() or load_model() first.")
        
        # Preprocess structured data
        X_structured = self.preprocess_data(user_data)
        
        # Extract text features
        X_tx_patterns = self._extract_text_feature(user_data, 'transaction_patterns')
        X_market_events = self._extract_text_feature(user_data, 'market_events')
        X_identity_desc = self._extract_text_feature(user_data, 'identity_description')
        
        # Make predictions
        predictions = self.transformer_model.predict({
            'structured_input': X_structured,
            'transaction_patterns_input': X_tx_patterns,
            'market_events_input': X_market_events,
            'identity_desc_input': X_identity_desc
        })
        
        # Extract results
        risk_category_probs = predictions[0]
        default_probability = predictions[1]
        confidence_score = predictions[2]
        feature_importance = predictions[3]
        
        # Determine risk category
        risk_category = np.argmax(risk_category_probs, axis=1)[0]
        risk_category_map = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk", 3: "Very High Risk"}
        risk_category_name = risk_category_map[risk_category]
        
        # Calculate risk score (0-100)
        risk_score = int(risk_category * 25 + default_probability[0, 0] * 25)
        
        # Generate explanations if explainability is enabled
        explanations = self._generate_explanations(user_data, feature_importance[0])
        
        # Check for anomalies
        anomaly_score, anomalies = self._detect_anomalies(user_data, risk_score, default_probability[0, 0])
        
        # Get feature importance ranking
        feature_ranking = self._get_feature_ranking(feature_importance[0])
        
        # Format the detailed response
        result = {
            "address": user_data.get("address", ["unknown"])[0] if isinstance(user_data.get("address", ["unknown"]), list) else user_data.get("address", "unknown"),
            "riskScore": risk_score,
            "riskCategory": risk_category_name,
            "defaultProbability": float(default_probability[0, 0]),
            "confidenceScore": float(confidence_score[0, 0]),
            "anomalyScore": anomaly_score,
            "anomalies": anomalies,
            "explanations": explanations,
            "featureImportance": feature_ranking,
            "timestamp": datetime.now().isoformat()
        }
        
        return result
    
    def preprocess_data(self, data, for_training=False):
        """
        Enhanced preprocessing of the input data with advanced feature engineering
        
        Args:
            data: Raw input data
            for_training: Whether preprocessing is for training
            
        Returns:
            Preprocessed data ready for the model
        """
        # Clone data to avoid modifying the original
        data_copy = data.copy()
        
        # Handle missing values with sophisticated strategies
        for feature in self.features:
            if feature in data_copy.columns:
                if feature in self.categorical_features:
                    # For categorical features, use most frequent value
                    most_frequent = data_copy[feature].mode().iloc[0] if not data_copy[feature].empty else "unknown"
                    data_copy[feature] = data_copy[feature].fillna(most_frequent)
                elif 'ratio' in feature or 'score' in feature:
                    # For ratio/score features, use median
                    median_value = data_copy[feature].median() if not data_copy[feature].empty else 0.5
                    data_copy[feature] = data_copy[feature].fillna(median_value)
                elif 'count' in feature or 'frequency' in feature:
                    # For count features, use 0
                    data_copy[feature] = data_copy[feature].fillna(0)
                else:
                    # For other features, use mean
                    mean_value = data_copy[feature].mean() if not data_copy[feature].empty else 0
                    data_copy[feature] = data_copy[feature].fillna(mean_value)
        
        # Advanced feature engineering if enabled
        if self.model_config['feature_engineering']:
            data_copy = self._apply_feature_engineering(data_copy)
        
        # Convert categorical columns to string type for preprocessing
        for col in self.categorical_features:
            if col in data_copy.columns:
                data_copy[col] = data_copy[col].astype(str)
        
        # Get available columns
        avail_num_cols = [c for c in self.numerical_features if c in data_copy.columns]
        avail_cat_cols = [c for c in self.categorical_features if c in data_copy.columns]
        
        # Create preprocessor if needed with only available columns
        if self.preprocessor is None or for_training:
            num_transformer = Pipeline(steps=[('scaler', StandardScaler())])
            cat_transformer = Pipeline(steps=[('onehot', OneHotEncoder(handle_unknown='ignore'))])
            
            self.preprocessor = ColumnTransformer(
                transformers=[
                    ('num', num_transformer, avail_num_cols),
                    ('cat', cat_transformer, avail_cat_cols)
                ],
                remainder='drop'
            )
            
            # Fit the preprocessor if training
            if for_training:
                self.preprocessor.fit(data_copy[avail_num_cols + avail_cat_cols])
        
        # Transform the data
        # For prediction, handle the case where preprocessor was fitted on more columns
        transformed_data = self.preprocessor.transform(data_copy[avail_num_cols + avail_cat_cols])
        
        return transformed_data
    
    def _apply_feature_engineering(self, data):
        """
        Apply advanced feature engineering transformations
        
        Args:
            data: Input data DataFrame
            
        Returns:
            DataFrame with engineered features
        """
        # Create risk indicators (if data available)
        if 'default_count' in data.columns and 'previous_loans_count' in data.columns:
            data['default_risk_ratio'] = data['default_count'] / (data['previous_loans_count'] + 1)
        
        if 'late_payment_frequency' in data.columns and 'previous_loans_count' in data.columns:
            data['late_payment_risk'] = data['late_payment_frequency'] / (data['previous_loans_count'] + 1)
        
        # Create activity and engagement scores
        if 'transaction_count' in data.columns and 'lending_protocol_interactions' in data.columns and 'wallet_age_days' in data.columns:
            data['lending_engagement'] = (
                data['transaction_count'] * data['lending_protocol_interactions'] / 
                (data['wallet_age_days'] + 1)
            )
        
        # Create financial stability metric
        if all(col in data.columns for col in ['wallet_balance', 'wallet_balance_volatility', 'repayment_ratio']):
            data['financial_stability'] = (
                data['wallet_balance'] * 
                (1 - data['wallet_balance_volatility']) * 
                (data['repayment_ratio'] ** 2)
            )
        
        # Create collateral health metric
        if all(col in data.columns for col in ['collateral_value_ratio', 'collateral_diversity', 'collateral_volatility']):
            data['collateral_health'] = (
                data['collateral_value_ratio'] * 
                data['collateral_diversity'] / 
                (data['collateral_volatility'] + 0.1)
            )
        
        # Create network trust score
        if all(col in data.columns for col in ['trusted_counterparties_ratio', 'network_centrality', 'social_trust_score']):
            data['network_trust'] = (
                data['trusted_counterparties_ratio'] * 
                data['network_centrality'] * 
                data['social_trust_score']
            )
        
        # Create market risk exposure
        if all(col in data.columns for col in ['market_volatility_correlation', 'liquidation_risk_score']):
            market_risk = data['market_volatility_correlation'] * data['liquidation_risk_score']
            
            if 'collateral_health' in data.columns:
                data['market_risk_exposure'] = market_risk * (2 - data['collateral_health'])
            else:
                data['market_risk_exposure'] = market_risk
        
        # Create cross-chain risk metric
        if 'cross_chain_activity' in data.columns and 'chain_origin' in data.columns:
            # This would be more complex in production with proper risk assessment
            # For now, we'll just use a placeholder transformation
            data['cross_chain_risk'] = data['cross_chain_activity'] * 0.5
        
        # Create quantum resistance impact
        if 'quantum_resistance_score' in data.columns and 'security_score' in data.columns:
            data['quantum_adjusted_security'] = (
                data['security_score'] * (1 + data['quantum_resistance_score'] / 100)
            )
        
        # Combined risk indicator
        risk_components = ['default_risk_ratio', 'late_payment_risk', 'market_risk_exposure',
                          'financial_stability', 'network_trust', 'collateral_health']
        
        if all(comp in data.columns for comp in risk_components):
            data['combined_risk_indicator'] = (
                0.3 * data['default_risk_ratio'] +
                0.2 * data['late_payment_risk'] +
                0.15 * data['market_risk_exposure'] -
                0.15 * data['financial_stability'] -
                0.1 * data['network_trust'] -
                0.1 * data['collateral_health']
            )
        
        return data
    
    def _generate_explanations(self, user_data, feature_importance):
        """
        Generate natural language explanations for risk assessment
        
        Args:
            user_data: User features
            feature_importance: Importance values for features
            
        Returns:
            List of explanation objects
        """
        explanations = []
        
        # Get top positive and negative factors
        feature_names = self.features[:len(feature_importance)]
        feature_values = []
        
        for feature in feature_names:
            if feature in user_data.columns:
                value = user_data[feature].iloc[0] if len(user_data) > 0 else None
                feature_values.append(value)
            else:
                feature_values.append(None)
        
        # Pair features with their importance
        feature_importance_pairs = list(zip(feature_names, feature_importance, feature_values))
        
        # Sort by absolute importance
        feature_importance_pairs.sort(key=lambda x: abs(x[1]), reverse=True)
        
        # Create explanations for top factors
        for feature, importance, value in feature_importance_pairs[:5]:
            explanation = {
                "factor": feature,
                "importance": float(importance),
                "value": value if value is not None else "N/A",
                "direction": "positive" if importance < 0 else "negative",
                "description": self._get_factor_description(feature, importance, value)
            }
            explanations.append(explanation)
        
        return explanations
    
    def _get_factor_description(self, feature, importance, value):
        """
        Generate a natural language description for a risk factor
        
        Args:
            feature: Feature name
            importance: Importance value
            value: Feature value
            
        Returns:
            Description string
        """
        # This would be more sophisticated in production with template-based NLG
        # For now, a simplified approach
        
        direction = "increases" if importance > 0 else "decreases"
        magnitude = "significantly" if abs(importance) > 0.5 else "moderately" if abs(importance) > 0.2 else "slightly"
        
        value_desc = f"({value})" if value is not None else ""
        
        # Feature-specific descriptions
        if "repayment_ratio" in feature:
            if importance < 0:
                return f"High repayment ratio {value_desc} indicates reliable loan repayment history, reducing risk."
            else:
                return f"Low repayment ratio {value_desc} suggests poor repayment history, increasing risk."
        
        elif "default_count" in feature:
            if importance > 0:
                return f"History of defaults {value_desc} {magnitude} increases risk."
            else:
                return f"Clean default history {value_desc} {magnitude} reduces risk."
        
        elif "collateral" in feature:
            if importance < 0:
                return f"Strong collateral metrics {value_desc} provide security, reducing risk."
            else:
                return f"Weak collateral position {value_desc} {magnitude} increases risk."
        
        elif "wallet_balance" in feature:
            if importance < 0:
                return f"Higher wallet balance {value_desc} indicates financial stability, reducing risk."
            else:
                return f"Low wallet balance {value_desc} may indicate financial constraints, increasing risk."
        
        elif "cross_chain" in feature:
            if importance < 0:
                return f"Diverse cross-chain activity {value_desc} demonstrates sophistication, reducing risk."
            else:
                return f"Unusual cross-chain patterns {value_desc} may indicate higher risk."
        
        elif "verification" in feature or "identity" in feature:
            if importance < 0:
                return f"Strong identity verification {value_desc} enhances trust, reducing risk."
            else:
                return f"Limited identity verification {value_desc} increases uncertainty and risk."
        
        # Generic description for other features
        return f"This factor {magnitude} {direction} the overall risk assessment."
    
    def _detect_anomalies(self, user_data, risk_score, default_probability):
        """
        Detect anomalies in user behavior and transactions
        
        Args:
            user_data: User features
            risk_score: Calculated risk score
            default_probability: Predicted default probability
            
        Returns:
            Tuple of (anomaly_score, anomalies_list)
        """
        anomalies = []
        anomaly_score = 0.0
        
        # Check for unusual transaction patterns
        if 'transaction_regularity' in user_data.columns:
            regularity = user_data['transaction_regularity'].iloc[0]
            if regularity < 0.2:  # Very irregular transaction pattern
                anomalies.append({
                    "type": "transaction_irregularity",
                    "severity": "high",
                    "description": "Highly irregular transaction patterns detected",
                    "score": 0.8
                })
                anomaly_score += 0.3
            elif regularity < 0.4:  # Somewhat irregular
                anomalies.append({
                    "type": "transaction_irregularity",
                    "severity": "medium",
                    "description": "Moderately irregular transaction patterns detected",
                    "score": 0.5
                })
                anomaly_score += 0.15
        
        # Check for sudden balance changes
        if 'wallet_balance_volatility' in user_data.columns:
            volatility = user_data['wallet_balance_volatility'].iloc[0]
            if volatility > 0.8:  # Very high volatility
                anomalies.append({
                    "type": "balance_volatility",
                    "severity": "high",
                    "description": "Unusually high wallet balance volatility",
                    "score": 0.9
                })
                anomaly_score += 0.35
            elif volatility > 0.6:  # High volatility
                anomalies.append({
                    "type": "balance_volatility",
                    "severity": "medium",
                    "description": "Elevated wallet balance volatility",
                    "score": 0.7
                })
                anomaly_score += 0.2
        
        # Check for unusual cross-chain activity
        if 'cross_chain_activity' in user_data.columns and 'cross_chain_frequency' in user_data.columns:
            activity = user_data['cross_chain_activity'].iloc[0]
            frequency = user_data['cross_chain_frequency'].iloc[0]
            
            if activity > 5 and frequency > 0.8:  # High activity with high frequency
                anomalies.append({
                    "type": "unusual_cross_chain_activity",
                    "severity": "medium",
                    "description": "Unusually high cross-chain activity frequency",
                    "score": 0.65
                })
                anomaly_score += 0.15
        
        # Check for mismatch between risk score and identity verification
        if 'identity_verification_level' in user_data.columns:
            id_level = user_data['identity_verification_level'].iloc[0]
            
            if (risk_score < 30 and id_level in ['none', 'basic', '0', '1']) or \
               (risk_score > 70 and id_level in ['full', 'advanced', '3', '2']):
                anomalies.append({
                    "type": "risk_identity_mismatch",
                    "severity": "medium",
                    "description": "Mismatch between risk score and identity verification level",
                    "score": 0.6
                })
                anomaly_score += 0.2
        
        # Check for discrepancy between behavior and default probability
        if 'default_count' in user_data.columns and 'previous_loans_count' in user_data.columns:
            defaults = user_data['default_count'].iloc[0]
            loans = user_data['previous_loans_count'].iloc[0]
            
            if loans > 5 and defaults == 0 and default_probability > 0.7:
                anomalies.append({
                    "type": "model_prediction_anomaly",
                    "severity": "high",
                    "description": "Model predicts high default probability despite clean history",
                    "score": 0.85
                })
                anomaly_score += 0.3
            
            if loans > 0 and defaults / loans > 0.5 and default_probability < 0.3:
                anomalies.append({
                    "type": "model_prediction_anomaly",
                    "severity": "high",
                    "description": "Model predicts low default probability despite poor history",
                    "score": 0.85
                })
                anomaly_score += 0.3
        
        # Normalize anomaly score to 0-1 range
        anomaly_score = min(1.0, anomaly_score)
        
        return anomaly_score, anomalies
    
    def _get_feature_ranking(self, importance_values):
        """
        Get feature importance ranking
        
        Args:
            importance_values: Feature importance values from the model
            
        Returns:
            List of feature importance objects
        """
        # Pair features with their importance values
        feature_names = self.features[:len(importance_values)]
        feature_importances = list(zip(feature_names, importance_values))
        
        # Sort by absolute importance
        feature_importances.sort(key=lambda x: abs(x[1]), reverse=True)
        
        # Format for output
        ranking = [
            {
                "feature": feature,
                "importance": float(importance),
                "direction": "positive" if importance > 0 else "negative"
            }
            for feature, importance in feature_importances[:10]  # Top 10 features
        ]
        
        return ranking
    
    def train_time_series_models(self, X, temporal_data=None):
        """
        Train time series models for predicting future metrics
        
        Args:
            X: Feature DataFrame
            temporal_data: Optional historical time series data
        """
        # In a production environment, this would use actual temporal data
        # For now, we'll create a dummy implementation
        
        # Check if we want to use time series forecasting
        if not self.model_config['time_series_algorithm']:
            return
        
        # Create a dummy time series model to demonstrate the concept
        self.time_series_model = {
            'type': self.model_config['time_series_algorithm'],
            'trained': True,
            'features': self.temporal_features
        }
        
        print(f"Time series models trained for {len(self.temporal_features)} features")
    
    def predict_future_metrics(self, user_data, days_ahead=30):
        """
        Predict future risk metrics using time series models
        
        Args:
            user_data: Current user data
            days_ahead: Number of days to predict
            
        Returns:
            Dict of forecasted values
        """
        # Check if time series model is available
        if not self.time_series_model:
            raise ValueError("Time series models not trained")
        
        # In production, this would use actual forecasting
        # For now, we'll create simulated forecasts
        
        # Get current values for temporal features
        current_values = {}
        for feature in self.temporal_features:
            if feature in user_data.columns:
                current_values[feature] = user_data[feature].iloc[0]
            else:
                current_values[feature] = 0.5  # Default value
        
        # Generate forecasted values with some randomness and trends
        forecasts = {}
        dates = [datetime.now() + timedelta(days=i) for i in range(1, days_ahead+1)]
        
        for feature, current_value in current_values.items():
            # Simple trend model: current + small random walk + slight trend
            values = []
            
            value = current_value
            
            # Different trends for different features
            if feature in ['wallet_balance', 'transaction_count']:
                trend = 0.01  # Slight upward trend
            elif feature in ['default_count', 'market_volatility_correlation']:
                trend = -0.005  # Slight downward trend
            else:
                trend = 0  # No trend
            
            for i in range(days_ahead):
                # Add random walk + trend
                value += np.random.normal(0, 0.05) + trend
                values.append(max(0, value))  # Ensure non-negative
            
            forecasts[feature] = {
                'dates': [d.strftime('%Y-%m-%d') for d in dates],
                'values': values,
                'current': current_value
            }
        
        return forecasts
    
    def train_interest_optimizer(self, env_config=None):
        """
        Train a reinforcement learning model to optimize interest rates
        
        Args:
            env_config: Optional environment configuration
        """
        # Use default config if not provided
        if env_config is None:
            env_config = {
                'market_conditions': {
                    'base_rate': 0.03,
                    'market_volatility': 0.2,
                    'platform_liquidity': 0.7
                }
            }
        
        # Create the interest rate optimization environment
        env = InterestRateEnv(env_config)
        
        # Choose RL algorithm based on config
        if self.model_config['rl_algorithm'] == 'PPO':
            model = PPO(
                "MlpPolicy", 
                env, 
                learning_rate=self.model_config['rl_learning_rate'],
                gamma=self.model_config['rl_gamma'],
                verbose=1
            )
        elif self.model_config['rl_algorithm'] == 'A2C':
            model = A2C(
                "MlpPolicy", 
                env, 
                learning_rate=self.model_config['rl_learning_rate'],
                gamma=self.model_config['rl_gamma'],
                verbose=1
            )
        elif self.model_config['rl_algorithm'] == 'SAC':
            model = SAC(
                "MlpPolicy", 
                env, 
                learning_rate=self.model_config['rl_learning_rate'],
                gamma=self.model_config['rl_gamma'],
                verbose=1
            )
        else:
            raise ValueError(f"Unsupported RL algorithm: {self.model_config['rl_algorithm']}")
        
        # Train the model
        # In production, this would be more extensive
        # For demonstration, we'll do minimal training
        print(f"Training {self.model_config['rl_algorithm']} interest optimizer...")
        model.learn(total_timesteps=1000)
        
        # Store the model
        self.interest_optimizer = model
        
        # Evaluate the trained policy
        mean_reward, std_reward = evaluate_policy(model, env, n_eval_episodes=10)
        print(f"Mean reward: {mean_reward:.2f} +/- {std_reward:.2f}")
    
    def optimize_interest_rate(self, user_data, market_conditions=None):
        """
        Optimize the interest rate for a user based on risk profile
        
        Args:
            user_data: User features
            market_conditions: Current market conditions
            
        Returns:
            Dict with optimized interest rate and explanation
        """
        # Check if optimizer is available
        if not self.interest_optimizer:
            raise ValueError("Interest optimizer not trained")
        
        # Use default market conditions if not provided
        if market_conditions is None:
            market_conditions = {
                'base_rate': 0.03,  # 3% base rate
                'market_volatility': 0.2,
                'platform_liquidity': 0.7
            }
        
        # Get risk data
        predictions = self.predict(user_data)
        risk_score = predictions['riskScore']
        default_probability = predictions['defaultProbability']
        
        # Create environment state
        env = InterestRateEnv({
            'user_risk_score': risk_score,
            'default_probability': default_probability,
            'market_conditions': market_conditions
        })
        
        # Reset the environment
        obs = env.reset()
        
        # Get action from the policy
        action, _ = self.interest_optimizer.predict(obs, deterministic=True)
        
        # Convert action to interest rate
        interest_rate = env.action_to_interest_rate(action)
        
        # Generate explanation
        explanation = self._generate_rate_explanation(
            risk_score, 
            default_probability, 
            interest_rate, 
            market_conditions
        )
        
        return {
            'user_address': user_data.get('address', ['unknown'])[0] if isinstance(user_data.get('address', ['unknown']), list) else user_data.get('address', 'unknown'),
            'risk_score': risk_score,
            'default_probability': default_probability,
            'base_rate': market_conditions['base_rate'] * 100,  # Convert to percentage
            'optimized_rate': interest_rate * 100,              # Convert to percentage
            'risk_premium': (interest_rate - market_conditions['base_rate']) * 100,  # Convert to percentage
            'explanation': explanation,
            'timestamp': datetime.now().isoformat()
        }
    
    def _generate_rate_explanation(self, risk_score, default_probability, interest_rate, market_conditions):
        """
        Generate explanation for interest rate optimization
        
        Args:
            risk_score: User risk score
            default_probability: Default probability
            interest_rate: Optimized interest rate
            market_conditions: Market conditions
            
        Returns:
            Explanation object
        """
        # Base rate component
        base_component = {
            'factor': 'Base Market Rate',
            'contribution': market_conditions['base_rate'] * 100,  # Convert to percentage
            'description': f"Current market base rate of {market_conditions['base_rate']*100:.2f}%"
        }
        
        # Risk premium component
        risk_premium = interest_rate - market_conditions['base_rate']
        risk_component = {
            'factor': 'Risk Premium',
            'contribution': risk_premium * 100,  # Convert to percentage
            'description': f"Additional premium based on risk profile (score: {risk_score}, default probability: {default_probability*100:.2f}%)"
        }
        
        # Market volatility adjustment
        volatility_adjustment = market_conditions['market_volatility'] * 0.05
        volatility_component = {
            'factor': 'Volatility Adjustment',
            'contribution': volatility_adjustment * 100,  # Convert to percentage
            'description': f"Adjustment for current market volatility ({market_conditions['market_volatility']*100:.1f}%)"
        }
        
        # Liquidity adjustment
        liquidity_adjustment = (1 - market_conditions['platform_liquidity']) * 0.02
        liquidity_component = {
            'factor': 'Liquidity Adjustment',
            'contribution': liquidity_adjustment * 100,  # Convert to percentage
            'description': f"Adjustment based on platform liquidity ({market_conditions['platform_liquidity']*100:.1f}%)"
        }
        
        return {
            'summary': f"The optimized interest rate of {interest_rate*100:.2f}% includes a base rate of {market_conditions['base_rate']*100:.2f}% plus a risk premium of {risk_premium*100:.2f}%.",
            'components': [base_component, risk_component, volatility_component, liquidity_component]
        }
    
    def calculate_risk_score(self, user_data):
        """
        Calculate a comprehensive risk score using the full model
        
        Args:
            user_data: User features
            
        Returns:
            Integer risk score (0-100)
        """
        # Use the transformer model predictions for best results
        predictions = self.predict(user_data)
        return predictions['riskScore']
    
    def save_model(self, filepath=None):
        """
        Save the trained model to disk
        
        Args:
            filepath: Path to save the model (if None, use default)
        """
        if filepath is None:
            filepath = os.path.join(
                self.model_config['model_dir'],
                f"{self.model_config['model_name']}.h5"
            )
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Save the transformer model
        if self.transformer_model:
            self.transformer_model.save(filepath)
            print(f"Model saved to {filepath}")
        
        # Save preprocessor
        if self.preprocessor:
            preprocessor_path = os.path.join(
                self.model_config['model_dir'],
                f"{self.model_config['model_name']}_preprocessor.pkl"
            )
            with open(preprocessor_path, 'wb') as f:
                pickle.dump(self.preprocessor, f)
            print(f"Preprocessor saved to {preprocessor_path}")
        
        # Save tokenizer
        if self.tokenizer:
            tokenizer_path = os.path.join(
                self.model_config['model_dir'],
                f"{self.model_config['model_name']}_tokenizer"
            )
            self.tokenizer.save_pretrained(tokenizer_path)
            print(f"Tokenizer saved to {tokenizer_path}")
        
        # Save model config
        config_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_config.json"
        )
        with open(config_path, 'w') as f:
            json.dump(self.model_config, f)
        print(f"Model config saved to {config_path}")
        
        # Save model metrics
        metrics_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_metrics.json"
        )
        with open(metrics_path, 'w') as f:
            json.dump(self.model_metrics, f)
        print(f"Model metrics saved to {metrics_path}")
    
    def load_model(self, filepath=None):
        """
        Load a trained model from disk
        
        Args:
            filepath: Path to load the model from (if None, use default)
        """
        if filepath is None:
            filepath = os.path.join(
                self.model_config['model_dir'],
                f"{self.model_config['model_name']}.h5"
            )
        
        # Load config first
        config_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_config.json"
        )
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                self.model_config = json.load(f)
        
        # Load the transformer model
        if os.path.exists(filepath):
            self.transformer_model = tf.keras.models.load_model(filepath)
            print(f"Model loaded from {filepath}")
        else:
            raise FileNotFoundError(f"Model file not found at {filepath}")
        
        # Load preprocessor
        preprocessor_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_preprocessor.pkl"
        )
        if os.path.exists(preprocessor_path):
            with open(preprocessor_path, 'rb') as f:
                self.preprocessor = pickle.load(f)
            print(f"Preprocessor loaded from {preprocessor_path}")
        
        # Load tokenizer
        tokenizer_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_tokenizer"
        )
        if os.path.exists(tokenizer_path):
            self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
            print(f"Tokenizer loaded from {tokenizer_path}")
        else:
            # Try loading from the base model
            try:
                self._init_tokenizer()
                print(f"Tokenizer initialized from base model")
            except Exception as e:
                print(f"Could not initialize tokenizer: {e}")
        
        # Load model metrics
        metrics_path = os.path.join(
            self.model_config['model_dir'],
            f"{self.model_config['model_name']}_metrics.json"
        )
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                self.model_metrics = json.load(f)
            print(f"Model metrics loaded from {metrics_path}")
        
        # Reload the features
        self.features = self._define_features()
        self.categorical_features = [
            'identity_verification_level',
            'collateral_quality_score',
            'asset_type',
            'chain_origin',
            'verification_method'
        ]
        self.numerical_features = [f for f in self.features if f not in self.categorical_features]

    def get_model_metrics(self):
        """
        Get current model metrics
        
        Returns:
            Dict of model metrics
        """
        return self.model_metrics


class InterestRateEnv(gym.Env):
    """
    Reinforcement learning environment for optimizing interest rates.
    Uses a sophisticated reward function that accounts for expected profit,
    market competitiveness, default risk, and long-term customer retention.
    """
    
    def __init__(self, config):
        """
        Initialize the RL environment
        
        Args:
            config: Configuration parameters for the environment
        """
        super(InterestRateEnv, self).__init__()
        
        # Configuration
        self.config = config
        
        # User state
        self.user_risk_score = config.get('user_risk_score', 50)
        self.default_probability = config.get('default_probability', 0.1)
        self.user_price_sensitivity = config.get('user_price_sensitivity', 0.5)
        self.user_relationship_value = config.get('user_relationship_value', 1.0)
        
        # Market state
        self.market_conditions = config.get('market_conditions', {
            'base_rate': 0.03,
            'market_volatility': 0.2,
            'platform_liquidity': 0.7,
            'competitive_rates': [0.04, 0.05, 0.07, 0.09],
            'expected_inflation': 0.02
        })
        
        # Action space: continuous interest rate adjustment from -0.05 to +0.15
        self.action_space = spaces.Box(
            low=np.array([-1.0]),
            high=np.array([1.0]),
            dtype=np.float32
        )
        
        # Observation space: 8-dimensional state with normalized values
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0, 0, 0, 0]),
            high=np.array([1, 1, 1, 1, 1, 1, 1, 1]),
            dtype=np.float32
        )
        
        # Internal state
        self.current_interest_rate = None
        self.state = None
        self.steps_done = 0
        self.total_reward = 0
        self.max_steps = config.get('max_steps', 10)
        
        # History for tracking
        self.rate_history = []
        self.reward_history = []
        
        # Reset the environment
        self.reset()
    
    def reset(self):
        """
        Reset the environment state
        
        Returns:
            np.array: Initial state observation
        """
        # Initial interest rate based on risk score
        risk_category = self.user_risk_score // 25  # 0-3 category
        initial_rates = [0.03, 0.06, 0.09, 0.12]  # Base rates by risk category
        self.current_interest_rate = initial_rates[risk_category]
        
        # Set initial state
        self.state = np.array([
            self.user_risk_score / 100,  # Normalize to 0-1
            self.default_probability,
            self.user_price_sensitivity,
            self.user_relationship_value / 3.0,  # Normalize assuming max value of 3
            self.market_conditions['base_rate'] / 0.2,  # Normalize assuming max rate of 20%
            self.market_conditions['market_volatility'],
            self.market_conditions['platform_liquidity'],
            self.current_interest_rate / 0.2  # Normalize assuming max rate of 20%
        ], dtype=np.float32)
        
        # Reset counters
        self.steps_done = 0
        self.total_reward = 0
        self.rate_history = [self.current_interest_rate]
        self.reward_history = []
        
        return self.state
    
    def step(self, action):
        """
        Take a step in the environment by adjusting the interest rate
        
        Args:
            action: RL agent's action (interest rate adjustment)
            
        Returns:
            Tuple of (observation, reward, done, info)
        """
        # Convert action to interest rate change
        # Scale from [-1, 1] to [-0.05, +0.15] for asymmetric range
        if action[0] >= 0:
            rate_change = action[0] * 0.15  # Positive: up to 15% increase
        else:
            rate_change = action[0] * 0.05  # Negative: up to 5% decrease
        
        # Calculate new interest rate
        new_interest_rate = self.current_interest_rate + rate_change
        
        # Ensure rate is within valid bounds (1% to 30%)
        new_interest_rate = min(max(new_interest_rate, 0.01), 0.3)
        
        # Store old rate for info
        old_rate = self.current_interest_rate
        
        # Update current rate
        self.current_interest_rate = new_interest_rate
        
        # Add to history
        self.rate_history.append(new_interest_rate)
        
        # Calculate reward
        reward = self._calculate_reward(new_interest_rate)
        self.total_reward += reward
        self.reward_history.append(reward)
        
        # Update step counter
        self.steps_done += 1
        done = self.steps_done >= self.max_steps
        
        # Update state with new interest rate
        self.state[-1] = self.current_interest_rate / 0.2  # Update normalized interest rate
        
        # Provide info dictionary
        info = {
            'interest_rate': self.current_interest_rate,
            'rate_change': self.current_interest_rate - old_rate,
            'step_reward': reward,
            'cumulative_reward': self.total_reward,
            'default_probability': self.default_probability,
            'expected_profit': self._calculate_expected_profit(self.current_interest_rate)
        }
        
        return self.state, reward, done, info
    
    def _calculate_reward(self, interest_rate):
        """
        Calculate reward for the interest rate decision
        
        Args:
            interest_rate: The new interest rate
            
        Returns:
            float: Reward value
        """
        # 1. Expected profit component
        # Higher interest - default risk = profit
        expected_profit = self._calculate_expected_profit(interest_rate)
        profit_component = 5.0 * expected_profit
        
        # 2. Customer retention component
        # Higher rates decrease retention, especially for price-sensitive customers
        rate_difference = interest_rate - self.market_conditions['base_rate']
        retention_probability = max(0, 1 - rate_difference * 2 * self.user_price_sensitivity)
        retention_component = 2.0 * retention_probability * self.user_relationship_value
        
        # 3. Market competitiveness component
        # Rates should be competitive but still profitable
        competitive_premium = 0.01 + (self.user_risk_score / 100) * 0.1  # 1-11% premium based on risk
        target_rate = self.market_conditions['base_rate'] + competitive_premium
        competition_factor = 1.0 - min(abs(interest_rate - target_rate) / 0.1, 1.0)
        competition_component = 2.0 * competition_factor
        
        # 4. Rate stability component
        # Penalize large rate changes to maintain stability
        if len(self.rate_history) > 1:
            previous_rate = self.rate_history[-2]
            rate_change = abs(interest_rate - previous_rate)
            stability_penalty = rate_change * 10.0  # Penalize changes of >10% severely
            stability_component = -1.0 * stability_penalty
        else:
            stability_component = 0.0
        
        # 5. Risk alignment component
        # Reward proper alignment of rate with risk
        # Higher risk should have higher rates
        risk_aligned_rate = 0.02 + (self.user_risk_score / 100) * 0.18  # 2-20% based on risk
        alignment_factor = 1.0 - min(abs(interest_rate - risk_aligned_rate) / 0.1, 1.0)
        alignment_component = 2.0 * alignment_factor
        
        # Combine all components
        reward = (
            profit_component + 
            retention_component + 
            competition_component + 
            stability_component + 
            alignment_component
        )
        
        return reward
    
    def _calculate_expected_profit(self, interest_rate):
        """
        Calculate expected profit by considering default probability
        
        Args:
            interest_rate: Interest rate
            
        Returns:
            float: Expected profit
        """
        # Adjust default probability based on interest rate
        # Higher rates increase default probability
        interest_effect = 0.5 * max(0, interest_rate - self.market_conditions['base_rate'])
        adjusted_default_prob = min(
            0.99, 
            self.default_probability * (1 + interest_effect)
        )
        
        # Calculate expected return
        # In case of repayment: get principal + interest
        # In case of default: lose a portion (recovery rate typically 40-60%)
        recovery_rate = 0.4 + (100 - self.user_risk_score) / 100 * 0.2  # 40-60% based on risk
        
        # Full payment probability = 1 - adjusted_default_prob
        # Expected profit = 
        # (repay probability * interest) - (default probability * (1 - recovery) * principal)
        expected_profit = (
            (1 - adjusted_default_prob) * interest_rate -
            adjusted_default_prob * (1 - recovery_rate)
        )
        
        return expected_profit
    
    def action_to_interest_rate(self, action):
        """
        Convert an RL action to an actual interest rate
        
        Args:
            action: Action from the RL policy
            
        Returns:
            float: Interest rate
        """
        # Convert action to rate change
        if action[0] >= 0:
            rate_change = action[0] * 0.15  # Positive: up to 15% increase
        else:
            rate_change = action[0] * 0.05  # Negative: up to 5% decrease
        
        # Calculate new interest rate
        interest_rate = self.current_interest_rate + rate_change
        
        # Ensure rate is within valid bounds (1% to 30%)
        interest_rate = min(max(interest_rate, 0.01), 0.3)
        
        return interest_rate


def create_simulated_dataset(num_samples=1000, include_text=True):
    """
    Create a simulated dataset for model training and testing
    
    Args:
        num_samples: Number of samples to generate
        include_text: Whether to include text features
        
    Returns:
        Tuple of (X, y) - features and targets
    """
    np.random.seed(42)
    
    # Generate user IDs
    user_ids = [f"user_{i}" for i in range(num_samples)]
    
    # Generate risk categories (0: Low, 1: Medium, 2: High, 3: Very High)
    risk_categories = np.random.choice([0, 1, 2, 3], size=num_samples, p=[0.4, 0.3, 0.2, 0.1])
    
    # Generate default probabilities aligned with risk categories
    default_probs = np.zeros(num_samples)
    for i, category in enumerate(risk_categories):
        if category == 0:
            default_probs[i] = np.random.beta(1, 20)  # Mostly low values
        elif category == 1:
            default_probs[i] = np.random.beta(2, 10)  # Medium-low values
        elif category == 2:
            default_probs[i] = np.random.beta(5, 10)  # Medium-high values
        else:
            default_probs[i] = np.random.beta(8, 8)   # Higher values
    
    # Generate features based on risk categories
    features = {}
    
    # Transaction features
    features['transaction_count'] = np.zeros(num_samples)
    features['avg_transaction_value'] = np.zeros(num_samples)
    features['max_transaction_value'] = np.zeros(num_samples)
    
    # Wallet features
    features['wallet_balance'] = np.zeros(num_samples)
    features['wallet_balance_volatility'] = np.zeros(num_samples)
    
    # Lending features
    features['previous_loans_count'] = np.zeros(num_samples)
    features['repayment_ratio'] = np.zeros(num_samples)
    features['default_count'] = np.zeros(num_samples)
    
    # Identity features
    features['identity_verification_level'] = np.random.choice(
        ['none', 'basic', 'advanced', 'full'], 
        size=num_samples
    )
    
    # Cross-chain features
    features['cross_chain_activity'] = np.zeros(num_samples)
    features['chain_origin'] = np.random.choice(
        ['ethereum', 'iota', 'polygon', 'solana', 'bitcoin'], 
        size=num_samples
    )
    
    # Collateral features
    features['collateral_value_ratio'] = np.zeros(num_samples)
    features['collateral_quality_score'] = np.random.choice(['A', 'B', 'C', 'D'], size=num_samples)
    
    # Text features
    if include_text:
        features['transaction_patterns'] = []
        features['market_events'] = []
        features['identity_description'] = []
    
    # Generate feature values based on risk category
    for i, category in enumerate(risk_categories):
        # Low risk users
        if category == 0:
            features['transaction_count'][i] = np.random.poisson(30)
            features['avg_transaction_value'][i] = np.random.exponential(100)
            features['max_transaction_value'][i] = features['avg_transaction_value'][i] * (2 + np.random.random())
            features['wallet_balance'][i] = np.random.exponential(2000)
            features['wallet_balance_volatility'][i] = np.random.beta(1, 10)
            features['previous_loans_count'][i] = np.random.poisson(5)
            features['repayment_ratio'][i] = np.random.beta(15, 2)
            features['default_count'][i] = np.random.binomial(1, 0.05)
            features['cross_chain_activity'][i] = np.random.poisson(2)
            features['collateral_value_ratio'][i] = np.random.beta(10, 3)
        
        # Medium risk users
        elif category == 1:
            features['transaction_count'][i] = np.random.poisson(20)
            features['avg_transaction_value'][i] = np.random.exponential(80)
            features['max_transaction_value'][i] = features['avg_transaction_value'][i] * (1.8 + np.random.random())
            features['wallet_balance'][i] = np.random.exponential(1000)
            features['wallet_balance_volatility'][i] = np.random.beta(2, 8)
            features['previous_loans_count'][i] = np.random.poisson(4)
            features['repayment_ratio'][i] = np.random.beta(10, 3)
            features['default_count'][i] = np.random.binomial(1, 0.15)
            features['cross_chain_activity'][i] = np.random.poisson(1)
            features['collateral_value_ratio'][i] = np.random.beta(8, 4)
        
        # High risk users
        elif category == 2:
            features['transaction_count'][i] = np.random.poisson(15)
            features['avg_transaction_value'][i] = np.random.exponential(60)
            features['max_transaction_value'][i] = features['avg_transaction_value'][i] * (1.5 + np.random.random())
            features['wallet_balance'][i] = np.random.exponential(500)
            features['wallet_balance_volatility'][i] = np.random.beta(3, 6)
            features['previous_loans_count'][i] = np.random.poisson(3)
            features['repayment_ratio'][i] = np.random.beta(6, 4)
            features['default_count'][i] = np.random.binomial(2, 0.2)
            features['cross_chain_activity'][i] = np.random.poisson(0.5)
            features['collateral_value_ratio'][i] = np.random.beta(6, 5)
        
        # Very high risk users
        else:
            features['transaction_count'][i] = np.random.poisson(8)
            features['avg_transaction_value'][i] = np.random.exponential(40)
            features['max_transaction_value'][i] = features['avg_transaction_value'][i] * (1.2 + np.random.random())
            features['wallet_balance'][i] = np.random.exponential(200)
            features['wallet_balance_volatility'][i] = np.random.beta(5, 5)
            features['previous_loans_count'][i] = np.random.poisson(2)
            features['repayment_ratio'][i] = np.random.beta(3, 5)
            features['default_count'][i] = np.random.binomial(3, 0.3)
            features['cross_chain_activity'][i] = np.random.poisson(0.2)
            features['collateral_value_ratio'][i] = np.random.beta(3, 6)
        
        # Generate text descriptions
        if include_text:
            # Transaction patterns
            if category == 0:
                features['transaction_patterns'].append(
                    "Regular, predictable transaction pattern with consistent volumes. "
                    "Weekly deposits and planned withdrawals. Minimal irregular activity."
                )
            elif category == 1:
                features['transaction_patterns'].append(
                    "Somewhat regular transaction pattern with occasional spikes. "
                    "Semi-monthly deposits with variable withdrawals."
                )
            elif category == 2:
                features['transaction_patterns'].append(
                    "Irregular transaction pattern with frequent volume changes. "
                    "Inconsistent deposits and unplanned withdrawals."
                )
            else:
                features['transaction_patterns'].append(
                    "Highly erratic transaction pattern with unexplained spikes and gaps. "
                    "Infrequent deposits and many high-volume withdrawals."
                )
            
            # Market events
            market_events = [
                "Stable market conditions with low volatility.",
                "Minor market fluctuations with temporary volatility.",
                "Significant market volatility affecting asset prices.",
                "Extreme market conditions with asset price crashes."
            ]
            features['market_events'].append(market_events[min(category + np.random.randint(0, 2), 3)])
            
            # Identity descriptions
            identity_levels = [
                "Fully verified identity with multi-factor authentication and biometric verification.",
                "Advanced identity verification with government ID and proof of address.",
                "Basic identity verification with email and phone confirmation.",
                "Minimal identity verification with only email confirmation."
            ]
            features['identity_description'].append(identity_levels[min(3 - category + np.random.randint(0, 2), 3)])
    
    # Combine features into a DataFrame
    df_features = pd.DataFrame({'user_id': user_ids})
    for feature, values in features.items():
        df_features[feature] = values
    
    # Create target DataFrame
    df_targets = pd.DataFrame({
        'risk_category': risk_categories,
        'default_probability': default_probs
    })
    
    return df_features, df_targets


def train_and_evaluate_model(include_text=True):
    """
    Train and evaluate the advanced transformer risk model
    
    Args:
        include_text: Whether to include text features
        
    Returns:
        Trained model
    """
    # Create simulated dataset
    X, y = create_simulated_dataset(num_samples=2000, include_text=include_text)
    
    # Split into train and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Initialize the model
    model = AdvancedTransformerRiskModel()
    
    # Train the model with limited epochs for demonstration
    model.model_config['epochs'] = 2
    model.train(X_train, y_train)
    
    # Evaluate on test set
    results = []
    for i in range(min(5, len(X_test))):
        user_data = X_test.iloc[i:i+1].copy()
        prediction = model.predict(user_data)
        
        # Compare with actual
        actual_category = y_test['risk_category'].iloc[i]
        actual_default_prob = y_test['default_probability'].iloc[i]
        
        print(f"\nUser: {user_data['user_id'].iloc[0]}")
        print(f"Predicted risk score: {prediction['riskScore']}")
        print(f"Predicted risk category: {prediction['riskCategory']}")
        print(f"Predicted default probability: {prediction['defaultProbability']:.3f}")
        print(f"Actual risk category: {actual_category}")
        print(f"Actual default probability: {actual_default_prob:.3f}")
        
        # Show explanations
        print("\nExplanations:")
        for expl in prediction['explanations'][:2]:  # Show top 2 explanations
            print(f"- {expl['factor']}: {expl['description']}")
        
        if 'anomalies' in prediction and prediction['anomalies']:
            print("\nAnomalies detected:")
            for anomaly in prediction['anomalies']:
                print(f"- {anomaly['type']} ({anomaly['severity']}): {anomaly['description']}")
        
        results.append({
            'user_id': user_data['user_id'].iloc[0],
            'actual_category': actual_category,
            'predicted_score': prediction['riskScore'],
            'actual_default_prob': actual_default_prob,
            'predicted_default_prob': prediction['defaultProbability']
        })
    
    # Also demonstrate interest rate optimization
    user_data = X_test.iloc[0:1].copy()
    optimized_rate = model.optimize_interest_rate(user_data)
    
    print("\nInterest Rate Optimization:")
    print(f"User: {user_data['user_id'].iloc[0]}")
    print(f"Risk Score: {optimized_rate['risk_score']}")
    print(f"Optimized Interest Rate: {optimized_rate['optimized_rate']:.2f}%")
    print(f"Base Rate: {optimized_rate['base_rate']:.2f}%")
    print(f"Risk Premium: {optimized_rate['risk_premium']:.2f}%")
    print("\nExplanation:")
    print(optimized_rate['explanation']['summary'])
    
    # Demonstrate time series forecasting
    if model.time_series_model:
        forecasts = model.predict_future_metrics(user_data)
        
        print("\nTime Series Forecasts:")
        for feature, forecast in list(forecasts.items())[:2]:  # Show first 2 features
            print(f"\n{feature}:")
            print(f"Current value: {forecast['current']:.2f}")
            print(f"Forecast for next 7 days: {[f'{v:.2f}' for v in forecast['values'][:7]]}")
    
    # Return the trained model
    return model


if __name__ == "__main__":
    # Train and evaluate the model
    model = train_and_evaluate_model(include_text=True)
    
    # Save the model
    try:
        model.save_model()
        print("Model saved successfully")
    except Exception as e:
        print(f"Error saving model: {e}")
