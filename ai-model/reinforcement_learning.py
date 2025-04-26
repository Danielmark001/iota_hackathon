"""
Reinforcement Learning for Risk Model Fine-Tuning

This module implements reinforcement learning techniques to fine-tune 
risk assessment models based on actual lending outcomes and repayment data.
"""

import os
import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
import joblib
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("reinforcement_learning.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RLFineTuner:
    """
    Reinforcement Learning model for fine-tuning risk assessment models 
    based on actual lending outcomes.
    """
    
    def __init__(self, config_path="config/reinforcement_learning_config.json"):
        """
        Initialize the RL fine-tuner.
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize data preprocessing
        self.scaler = StandardScaler()
        
        # Initialize RL model
        self.model = None
        
        # Load model if available
        self._load_model()
        
        # Initialize replay buffer
        self.replay_buffer = []
        self.max_buffer_size = self.config.get("max_buffer_size", 10000)
        
        # Track training history
        self.training_history = []
        
        logger.info("Reinforcement Learning Fine-Tuner initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Configuration loaded from {config_path}")
            return config
        except FileNotFoundError:
            logger.warning(f"Configuration file {config_path} not found. Using default configuration.")
            # Default configuration
            return {
                "model_dir": "./models",
                "model_filename": "rl_fine_tuner.h5",
                "features": [
                    "transaction_count",
                    "message_count",
                    "balance",
                    "activity_regularity",
                    "first_activity_days",
                    "native_tokens_count",
                    "cross_layer_transfers",
                    "identity_verification",
                    "wallet_balance",
                    "collateral_ratio",
                    "repayment_ratio",
                    "predicted_risk_score",
                    "actual_outcome"
                ],
                "state_features": [
                    "transaction_count",
                    "balance",
                    "cross_layer_transfers",
                    "identity_verification",
                    "collateral_ratio",
                    "predicted_risk_score"
                ],
                "reward_weights": {
                    "true_positive": 10.0,   # Correctly predicted high risk (default)
                    "true_negative": 5.0,    # Correctly predicted low risk (repaid)
                    "false_positive": -5.0,  # Incorrectly predicted high risk (false alarm)
                    "false_negative": -10.0  # Incorrectly predicted low risk (missed default)
                },
                "learning_rate": 0.001,
                "discount_factor": 0.95,
                "batch_size": 32,
                "epochs": 10,
                "epsilon_start": 1.0,
                "epsilon_end": 0.01,
                "epsilon_decay_steps": 10000,
                "target_update_frequency": 100,
                "max_buffer_size": 10000,
                "min_buffer_size": 1000,
                "random_state": 42
            }
    
    def _load_model(self) -> bool:
        """Load trained model if available."""
        try:
            model_dir = self.config.get("model_dir", "./models")
            model_filename = self.config.get("model_filename", "rl_fine_tuner.h5")
            model_path = os.path.join(model_dir, model_filename)
            
            if os.path.exists(model_path):
                self.model = keras.models.load_model(model_path)
                logger.info(f"Model loaded from {model_path}")
                
                # Also load replay buffer if available
                buffer_path = os.path.join(model_dir, "replay_buffer.joblib")
                if os.path.exists(buffer_path):
                    self.replay_buffer = joblib.load(buffer_path)
                    logger.info(f"Replay buffer loaded with {len(self.replay_buffer)} experiences")
                
                return True
            else:
                logger.warning(f"Model file {model_path} not found.")
                return False
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self) -> bool:
        """Save trained model."""
        try:
            if self.model is None:
                logger.error("No model to save")
                return False
                
            model_dir = self.config.get("model_dir", "./models")
            os.makedirs(model_dir, exist_ok=True)
            
            model_filename = self.config.get("model_filename", "rl_fine_tuner.h5")
            model_path = os.path.join(model_dir, model_filename)
            
            self.model.save(model_path)
            logger.info(f"Model saved to {model_path}")
            
            # Also save replay buffer
            buffer_path = os.path.join(model_dir, "replay_buffer.joblib")
            joblib.dump(self.replay_buffer, buffer_path)
            logger.info(f"Replay buffer saved with {len(self.replay_buffer)} experiences")
            
            return True
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False
    
    def _build_model(self, state_dim: int = 6, action_dim: int = 1):
        """
        Build the DQN model for RL fine-tuning.
        
        Args:
            state_dim: Dimension of state space
            action_dim: Dimension of action space
        """
        # We'll use a simple neural network to learn Q-values
        model = keras.Sequential([
            keras.layers.Dense(64, activation='relu', input_shape=(state_dim,)),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(action_dim, activation='linear')
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.config.get("learning_rate", 0.001)),
            loss='mse'
        )
        
        return model
    
    def preprocess_features(self, data: pd.DataFrame, fit: bool = False) -> np.ndarray:
        """
        Preprocess features for model training or prediction.
        
        Args:
            data: DataFrame with features
            fit: Whether to fit the scaler (for training) or just transform (for prediction)
            
        Returns:
            Preprocessed features as numpy array
        """
        # Select state features
        state_features = self.config.get("state_features", [])
        if len(state_features) == 0:
            raise ValueError("No state features defined in configuration")
            
        # Check which features are actually in the data
        available_features = [f for f in state_features if f in data.columns]
        if len(available_features) == 0:
            raise ValueError("None of the configured state features are in the data")
            
        # Extract features
        X = data[available_features].copy()
        
        # Handle missing values
        X.fillna(0, inplace=True)
        
        # Scale features
        if fit:
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)
            
        return X_scaled
    
    def _get_state(self, data: pd.DataFrame, index: int) -> np.ndarray:
        """
        Get the state representation for a specific data point.
        
        Args:
            data: DataFrame with features
            index: Index of the sample
            
        Returns:
            State vector
        """
        # Extract single sample
        sample = data.iloc[[index]]
        
        # Preprocess
        state = self.preprocess_features(sample, fit=False)
        
        return state.flatten()
    
    def _calculate_reward(self, predicted_score: float, actual_outcome: int) -> float:
        """
        Calculate reward based on prediction and actual outcome.
        
        Args:
            predicted_score: Predicted risk score (0-100)
            actual_outcome: Actual outcome (1=default, 0=repaid)
            
        Returns:
            Reward value
        """
        # Convert risk score to binary prediction using threshold
        threshold = 50  # Adjustable threshold
        predicted_default = predicted_score >= threshold
        
        # Get reward weights from config
        weights = self.config.get("reward_weights", {
            "true_positive": 10.0,   # Correctly predicted default
            "true_negative": 5.0,    # Correctly predicted repayment
            "false_positive": -5.0,  # False alarm
            "false_negative": -10.0  # Missed default
        })
        
        # Determine scenario and return appropriate reward
        if predicted_default and actual_outcome == 1:
            # True positive: correctly predicted default
            return weights.get("true_positive", 10.0)
        elif not predicted_default and actual_outcome == 0:
            # True negative: correctly predicted repayment
            return weights.get("true_negative", 5.0)
        elif predicted_default and actual_outcome == 0:
            # False positive: false alarm
            return weights.get("false_positive", -5.0)
        else:
            # False negative: missed default
            return weights.get("false_negative", -10.0)
    
    def _get_action(self, state: np.ndarray, epsilon: float) -> Tuple[int, float]:
        """
        Get action using epsilon-greedy policy.
        
        Args:
            state: Current state
            epsilon: Exploration rate
            
        Returns:
            Tuple of (action, q_value)
        """
        if self.model is None:
            # Initialize model if not already done
            state_dim = len(state)
            self.model = self._build_model(state_dim=state_dim)
            
        # Epsilon-greedy action selection
        if np.random.random() < epsilon:
            # Explore: random adjustment to risk score
            adjustment = np.random.uniform(-20, 20)
            q_value = 0  # No Q-value for random action
        else:
            # Exploit: use model to predict best adjustment
            q_values = self.model.predict(state.reshape(1, -1), verbose=0)[0]
            adjustment = q_values[0]  # Here we're using a continuous action space
            q_value = q_values[0]
            
        return adjustment, q_value
    
    def add_experience(self, state: np.ndarray, action: float, reward: float, 
                       next_state: np.ndarray, done: bool):
        """
        Add experience to replay buffer.
        
        Args:
            state: Current state
            action: Action taken
            reward: Reward received
            next_state: Next state
            done: Whether episode is done
        """
        # Add experience to replay buffer
        self.replay_buffer.append((state, action, reward, next_state, done))
        
        # Limit buffer size
        if len(self.replay_buffer) > self.max_buffer_size:
            self.replay_buffer.pop(0)
    
    def train_from_buffer(self, batch_size: Optional[int] = None, epochs: Optional[int] = None) -> Dict[str, Any]:
        """
        Train model using experiences from replay buffer.
        
        Args:
            batch_size: Size of training batch
            epochs: Number of training epochs
            
        Returns:
            Training metrics
        """
        if self.model is None:
            # Get state dimension from first experience
            if len(self.replay_buffer) == 0:
                raise ValueError("Replay buffer is empty, cannot initialize model")
                
            state_dim = len(self.replay_buffer[0][0])
            self.model = self._build_model(state_dim=state_dim)
        
        # Use config values if not specified
        batch_size = batch_size or self.config.get("batch_size", 32)
        epochs = epochs or self.config.get("epochs", 10)
        discount_factor = self.config.get("discount_factor", 0.95)
        
        # Check if buffer has enough experiences
        min_buffer_size = self.config.get("min_buffer_size", 1000)
        if len(self.replay_buffer) < min_buffer_size:
            logger.warning(f"Replay buffer size ({len(self.replay_buffer)}) is less than minimum ({min_buffer_size})")
            return {"error": "Insufficient data in replay buffer"}
        
        # Training metrics
        metrics = {
            "epochs": epochs,
            "batch_size": batch_size,
            "buffer_size": len(self.replay_buffer),
            "losses": []
        }
        
        # Train for specified number of epochs
        for epoch in range(epochs):
            # Sample batch from replay buffer
            indices = np.random.randint(0, len(self.replay_buffer), size=batch_size)
            batch = [self.replay_buffer[i] for i in indices]
            
            # Extract states, actions, rewards, next_states, and dones
            states = np.array([b[0] for b in batch])
            actions = np.array([b[1] for b in batch])
            rewards = np.array([b[2] for b in batch])
            next_states = np.array([b[3] for b in batch])
            dones = np.array([b[4] for b in batch])
            
            # Compute target Q values
            next_q_values = self.model.predict(next_states, verbose=0)
            target_q_values = rewards + discount_factor * np.max(next_q_values, axis=1) * (1 - dones)
            
            # Compute current Q values
            current_q_values = self.model.predict(states, verbose=0)
            
            # Update target Q values for the actions that were taken
            target_qs = current_q_values.copy()
            for i in range(batch_size):
                # Here we're using a continuous action space, so we update all outputs
                target_qs[i] = target_q_values[i]
            
            # Train the model
            history = self.model.fit(
                states, 
                target_qs, 
                epochs=1, 
                batch_size=batch_size,
                verbose=0
            )
            
            # Record loss
            metrics["losses"].append(history.history["loss"][0])
            
            logger.debug(f"Epoch {epoch+1}/{epochs}, Loss: {history.history['loss'][0]:.6f}")
        
        # Calculate average loss
        metrics["avg_loss"] = np.mean(metrics["losses"])
        metrics["final_loss"] = metrics["losses"][-1]
        metrics["trained_at"] = datetime.now().isoformat()
        
        logger.info(f"Model training complete: avg_loss={metrics['avg_loss']:.6f}")
        
        # Save model
        self.save_model()
        
        return metrics
    
    def fine_tune_model(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Fine-tune risk model using reinforcement learning on historical data.
        
        Args:
            data: DataFrame with historical lending data including predictions and outcomes
            
        Returns:
            Dictionary with fine-tuning metrics
        """
        required_columns = ["predicted_risk_score", "actual_outcome"]
        for col in required_columns:
            if col not in data.columns:
                raise ValueError(f"Required column '{col}' not found in data")
        
        logger.info(f"Fine-tuning model with {len(data)} samples")
        
        # Initialize model if needed
        if self.model is None:
            # Preprocess features to get state dimension
            sample_state = self._get_state(data, 0)
            state_dim = len(sample_state)
            self.model = self._build_model(state_dim=state_dim)
        
        # Initialize epsilon for exploration
        epsilon_start = self.config.get("epsilon_start", 1.0)
        epsilon_end = self.config.get("epsilon_end", 0.01)
        epsilon_decay_steps = self.config.get("epsilon_decay_steps", 10000)
        epsilon_decay = (epsilon_start - epsilon_end) / epsilon_decay_steps
        
        # Metrics to track
        metrics = {
            "samples": len(data),
            "avg_reward": 0,
            "total_reward": 0,
            "rewards": [],
            "epsilons": [],
            "adjustments": []
        }
        
        # Process each sample as an experience
        for i in range(len(data)):
            # Current state
            state = self._get_state(data, i)
            
            # Current prediction and actual outcome
            predicted_score = data.iloc[i]["predicted_risk_score"]
            actual_outcome = data.iloc[i]["actual_outcome"]
            
            # Get action using epsilon-greedy policy
            epsilon = max(epsilon_end, epsilon_start - (i * epsilon_decay))
            adjustment, q_value = self._get_action(state, epsilon)
            
            # Apply adjustment to get adjusted prediction
            adjusted_score = np.clip(predicted_score + adjustment, 0, 100)
            
            # Calculate reward
            reward = self._calculate_reward(adjusted_score, actual_outcome)
            
            # Get next state (use the next sample or same state if last sample)
            next_state = self._get_state(data, i+1) if i < len(data) - 1 else state
            
            # Add experience to replay buffer
            self.add_experience(state, adjustment, reward, next_state, i == len(data) - 1)
            
            # Track metrics
            metrics["rewards"].append(reward)
            metrics["epsilons"].append(epsilon)
            metrics["adjustments"].append(adjustment)
            
            logger.debug(f"Sample {i+1}/{len(data)}, Adjustment: {adjustment:.2f}, Reward: {reward:.2f}")
        
        # Calculate aggregate metrics
        metrics["total_reward"] = sum(metrics["rewards"])
        metrics["avg_reward"] = metrics["total_reward"] / len(data)
        metrics["avg_adjustment"] = np.mean(np.abs(metrics["adjustments"]))
        metrics["final_epsilon"] = epsilon
        
        logger.info(f"Experience collection complete: avg_reward={metrics['avg_reward']:.2f}, samples={len(data)}")
        
        # Train model using replay buffer
        if len(self.replay_buffer) >= self.config.get("min_buffer_size", 1000):
            training_metrics = self.train_from_buffer()
            metrics["training"] = training_metrics
        else:
            logger.warning(f"Not enough experiences in buffer ({len(self.replay_buffer)}) for training")
            metrics["training"] = {"error": "Insufficient data in replay buffer"}
        
        # Save model
        self.save_model()
        
        return metrics
    
    def adjust_risk_score(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Adjust risk score using the fine-tuned model.
        
        Args:
            data: DataFrame with features and predicted risk score
            
        Returns:
            Dictionary with original and adjusted risk scores
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        if "predicted_risk_score" not in data.columns:
            raise ValueError("Required column 'predicted_risk_score' not found in data")
        
        logger.info(f"Adjusting risk scores for {len(data)} samples")
        
        results = []
        
        for i in range(len(data)):
            # Get state
            state = self._get_state(data, i)
            
            # Get original prediction
            original_score = data.iloc[i]["predicted_risk_score"]
            
            # Get adjustment from model (using epsilon=0 for exploitation)
            adjustment, q_value = self._get_action(state, epsilon=0)
            
            # Apply adjustment
            adjusted_score = np.clip(original_score + adjustment, 0, 100)
            
            results.append({
                "originalScore": float(original_score),
                "adjustment": float(adjustment),
                "adjustedScore": float(adjusted_score),
                "confidence": abs(float(q_value)) / 10.0,  # Scaled confidence
                "timestamp": datetime.now().isoformat()
            })
        
        logger.info(f"Risk score adjustment complete for {len(data)} samples")
        
        return {
            "adjustments": results,
            "averageAdjustment": np.mean([r["adjustment"] for r in results]),
            "averageConfidence": np.mean([r["confidence"] for r in results])
        }

# Test function
if __name__ == "__main__":
    # Create test data
    np.random.seed(42)
    n_samples = 1000
    
    # Generate synthetic data
    data = {
        "transaction_count": np.random.poisson(10, n_samples),
        "message_count": np.random.poisson(5, n_samples),
        "balance": np.random.exponential(100, n_samples),
        "activity_regularity": np.random.beta(5, 2, n_samples),
        "first_activity_days": np.random.randint(1, 365, n_samples),
        "native_tokens_count": np.random.poisson(2, n_samples),
        "cross_layer_transfers": np.random.poisson(3, n_samples),
        "identity_verification": np.random.choice([0, 0.3, 0.7, 1.0], n_samples),
        "wallet_balance": np.random.exponential(200, n_samples),
        "collateral_ratio": np.random.beta(5, 2, n_samples) * 5,
        "repayment_ratio": np.random.beta(8, 2, n_samples),
        "previous_loans_count": np.random.poisson(3, n_samples),
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate synthetic predictions and outcomes
    df["predicted_risk_score"] = np.random.uniform(0, 100, n_samples)
    df["actual_outcome"] = ((df["collateral_ratio"] < 1.5) & 
                            (df["repayment_ratio"] < 0.7) & 
                            (df["transaction_count"] < 5)).astype(int)
    
    # Initialize model
    model = RLFineTuner()
    
    # Fine-tune model
    metrics = model.fine_tune_model(df)
    
    print("Fine-tuning metrics:", metrics)
    
    # Test adjustment
    test_sample = df.iloc[:5].copy()
    adjustments = model.adjust_risk_score(test_sample)
    
    print("\nRisk score adjustments:")
    for i, adj in enumerate(adjustments["adjustments"]):
        print(f"Sample {i}: Original = {adj['originalScore']:.2f}, Adjusted = {adj['adjustedScore']:.2f} (Δ{adj['adjustment']:+.2f})")
