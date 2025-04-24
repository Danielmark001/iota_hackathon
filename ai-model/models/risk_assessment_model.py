"""
Risk Assessment Model

This module implements the AI model architecture for credit risk assessment
in the IntelliLend platform.
"""

import os
import logging
import json
import pickle
import datetime
from typing import Dict, List, Optional, Union, Any, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, precision_recall_curve
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model, load_model
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, Input
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.optimizers import Adam
import matplotlib.pyplot as plt
import seaborn as sns

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RiskAssessmentModel:
    """
    Risk assessment model for predicting credit risk in DeFi lending
    """
    
    def __init__(
        self,
        model_type: str = "ensemble",  # "rf", "xgb", "lightgbm", "nn", "ensemble"
        model_config_path: str = "../config/model_config.json",
        model_dir: str = "../models",
        model_version: str = None,
        random_state: int = 42
    ):
        """
        Initialize the risk assessment model
        
        Args:
            model_type: Type of model to use
            model_config_path: Path to model configuration file
            model_dir: Directory to store models
            model_version: Version of the model (defaults to timestamp)
            random_state: Random seed for reproducibility
        """
        self.model_type = model_type
        self.model_config_path = model_config_path
        self.model_dir = model_dir
        self.random_state = random_state
        
        if model_version is None:
            self.model_version = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        else:
            self.model_version = model_version
        
        # Create model directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)
        
        # Load model configuration
        self._load_model_config()
        
        # Initialize model
        self.model = None
        self._initialize_model()
    
    def _load_model_config(self):
        """Load model configuration from JSON file"""
        try:
            with open(self.model_config_path, 'r') as f:
                self.model_config = json.load(f)
                logger.info(f"Loaded model configuration from {self.model_config_path}")
        except FileNotFoundError:
            logger.warning(f"Model configuration file not found at {self.model_config_path}. Using default configuration.")
            # Default configuration
            self.model_config = {
                "random_forest": {
                    "n_estimators": 100,
                    "max_depth": 10,
                    "min_samples_split": 2,
                    "min_samples_leaf": 1,
                    "max_features": "auto",
                    "class_weight": "balanced"
                },
                "xgboost": {
                    "n_estimators": 100,
                    "max_depth": 5,
                    "learning_rate": 0.1,
                    "subsample": 0.8,
                    "colsample_bytree": 0.8,
                    "scale_pos_weight": 3
                },
                "lightgbm": {
                    "n_estimators": 100,
                    "max_depth": 5,
                    "learning_rate": 0.1,
                    "num_leaves": 31,
                    "subsample": 0.8,
                    "colsample_bytree": 0.8,
                    "class_weight": "balanced"
                },
                "neural_network": {
                    "hidden_layers": [64, 32, 16],
                    "dropout_rate": 0.3,
                    "activation": "relu",
                    "output_activation": "sigmoid",
                    "learning_rate": 0.001,
                    "batch_size": 32,
                    "epochs": 100,
                    "early_stopping_patience": 10,
                    "validation_split": 0.2
                },
                "ensemble": {
                    "models": ["rf", "xgb", "lightgbm"],
                    "weights": [1, 1, 1],
                    "voting": "soft"
                },
                "grid_search": {
                    "random_forest": {
                        "n_estimators": [50, 100, 200],
                        "max_depth": [None, 10, 20, 30],
                        "min_samples_split": [2, 5, 10]
                    },
                    "xgboost": {
                        "n_estimators": [50, 100, 200],
                        "max_depth": [3, 5, 7],
                        "learning_rate": [0.01, 0.1, 0.3]
                    },
                    "lightgbm": {
                        "n_estimators": [50, 100, 200],
                        "max_depth": [3, 5, 7],
                        "learning_rate": [0.01, 0.1, 0.3]
                    }
                },
                "cv_folds": 5,
                "metrics": ["accuracy", "precision", "recall", "f1", "roc_auc"],
                "threshold": 0.5
            }
    
    def _initialize_model(self):
        """Initialize the model based on the specified type"""
        logger.info(f"Initializing {self.model_type} model")
        
        if self.model_type == "rf":
            # Random Forest
            config = self.model_config.get("random_forest", {})
            self.model = RandomForestClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", 10),
                min_samples_split=config.get("min_samples_split", 2),
                min_samples_leaf=config.get("min_samples_leaf", 1),
                max_features=config.get("max_features", "auto"),
                class_weight=config.get("class_weight", "balanced"),
                random_state=self.random_state
            )
        
        elif self.model_type == "xgb":
            # XGBoost
            config = self.model_config.get("xgboost", {})
            self.model = XGBClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", 5),
                learning_rate=config.get("learning_rate", 0.1),
                subsample=config.get("subsample", 0.8),
                colsample_bytree=config.get("colsample_bytree", 0.8),
                scale_pos_weight=config.get("scale_pos_weight", 3),
                random_state=self.random_state
            )
        
        elif self.model_type == "lightgbm":
            # LightGBM
            config = self.model_config.get("lightgbm", {})
            self.model = LGBMClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", 5),
                learning_rate=config.get("learning_rate", 0.1),
                num_leaves=config.get("num_leaves", 31),
                subsample=config.get("subsample", 0.8),
                colsample_bytree=config.get("colsample_bytree", 0.8),
                class_weight=config.get("class_weight", "balanced"),
                random_state=self.random_state
            )
        
        elif self.model_type == "nn":
            # Neural Network (will be built during fit)
            self.model = "neural_network"  # Placeholder
        
        elif self.model_type == "ensemble":
            # Ensemble of multiple models
            config = self.model_config.get("ensemble", {})
            models = config.get("models", ["rf", "xgb", "lightgbm"])
            weights = config.get("weights", [1] * len(models))
            voting = config.get("voting", "soft")
            
            estimators = []
            
            for model_name in models:
                if model_name == "rf":
                    rf_config = self.model_config.get("random_forest", {})
                    rf_model = RandomForestClassifier(
                        n_estimators=rf_config.get("n_estimators", 100),
                        max_depth=rf_config.get("max_depth", 10),
                        min_samples_split=rf_config.get("min_samples_split", 2),
                        min_samples_leaf=rf_config.get("min_samples_leaf", 1),
                        max_features=rf_config.get("max_features", "auto"),
                        class_weight=rf_config.get("class_weight", "balanced"),
                        random_state=self.random_state
                    )
                    estimators.append(('rf', rf_model))
                
                elif model_name == "xgb":
                    xgb_config = self.model_config.get("xgboost", {})
                    xgb_model = XGBClassifier(
                        n_estimators=xgb_config.get("n_estimators", 100),
                        max_depth=xgb_config.get("max_depth", 5),
                        learning_rate=xgb_config.get("learning_rate", 0.1),
                        subsample=xgb_config.get("subsample", 0.8),
                        colsample_bytree=xgb_config.get("colsample_bytree", 0.8),
                        scale_pos_weight=xgb_config.get("scale_pos_weight", 3),
                        random_state=self.random_state
                    )
                    estimators.append(('xgb', xgb_model))
                
                elif model_name == "lightgbm":
                    lgbm_config = self.model_config.get("lightgbm", {})
                    lgbm_model = LGBMClassifier(
                        n_estimators=lgbm_config.get("n_estimators", 100),
                        max_depth=lgbm_config.get("max_depth", 5),
                        learning_rate=lgbm_config.get("learning_rate", 0.1),
                        num_leaves=lgbm_config.get("num_leaves", 31),
                        subsample=lgbm_config.get("subsample", 0.8),
                        colsample_bytree=lgbm_config.get("colsample_bytree", 0.8),
                        class_weight=lgbm_config.get("class_weight", "balanced"),
                        random_state=self.random_state
                    )
                    estimators.append(('lgbm', lgbm_model))
                
                elif model_name == "logistic":
                    log_model = LogisticRegression(
                        C=1.0,
                        class_weight="balanced",
                        random_state=self.random_state,
                        max_iter=1000
                    )
                    estimators.append(('logistic', log_model))
                
                elif model_name == "svm":
                    svm_model = SVC(
                        probability=True,
                        class_weight="balanced",
                        random_state=self.random_state
                    )
                    estimators.append(('svm', svm_model))
            
            self.model = VotingClassifier(
                estimators=estimators,
                voting=voting,
                weights=weights
            )
        
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
    
    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
        use_grid_search: bool = False,
        class_weights: Optional[Dict] = None
    ) -> "RiskAssessmentModel":
        """
        Train the risk assessment model
        
        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features (optional)
            y_val: Validation labels (optional)
            use_grid_search: Whether to use grid search for hyperparameter tuning
            class_weights: Class weights for imbalanced data
            
        Returns:
            Self for method chaining
        """
        logger.info(f"Training {self.model_type} model")
        
        # If no validation set provided, create one
        if X_val is None or y_val is None:
            X_train, X_val, y_train, y_val = train_test_split(
                X_train, y_train, test_size=0.2, random_state=self.random_state, stratify=y_train
            )
        
        if use_grid_search and self.model_type != "nn" and self.model_type != "ensemble":
            logger.info("Performing grid search for hyperparameter tuning")
            
            # Get grid search parameters
            param_grid = self.model_config.get("grid_search", {}).get(self.model_type, {})
            
            if param_grid:
                cv = StratifiedKFold(
                    n_splits=self.model_config.get("cv_folds", 5),
                    shuffle=True,
                    random_state=self.random_state
                )
                
                grid_search = GridSearchCV(
                    self.model,
                    param_grid,
                    cv=cv,
                    scoring="f1_weighted",
                    n_jobs=-1,
                    verbose=1
                )
                
                grid_search.fit(X_train, y_train)
                
                logger.info(f"Best parameters: {grid_search.best_params_}")
                logger.info(f"Best score: {grid_search.best_score_:.4f}")
                
                self.model = grid_search.best_estimator_
            else:
                logger.warning(f"No grid search parameters found for model type: {self.model_type}")
                self.model.fit(X_train, y_train)
        
        elif self.model_type == "nn":
            logger.info("Training neural network model")
            
            # Get neural network configuration
            nn_config = self.model_config.get("neural_network", {})
            hidden_layers = nn_config.get("hidden_layers", [64, 32, 16])
            dropout_rate = nn_config.get("dropout_rate", 0.3)
            activation = nn_config.get("activation", "relu")
            output_activation = nn_config.get("output_activation", "sigmoid")
            learning_rate = nn_config.get("learning_rate", 0.001)
            batch_size = nn_config.get("batch_size", 32)
            epochs = nn_config.get("epochs", 100)
            early_stopping_patience = nn_config.get("early_stopping_patience", 10)
            validation_split = nn_config.get("validation_split", 0.2)
            
            # Build neural network model
            input_dim = X_train.shape[1]
            
            # Use Keras functional API for more flexibility
            inputs = Input(shape=(input_dim,))
            x = inputs
            
            # Add hidden layers
            for units in hidden_layers:
                x = Dense(units, activation=activation)(x)
                x = BatchNormalization()(x)
                x = Dropout(dropout_rate)(x)
            
            # Add output layer
            if len(np.unique(y_train)) > 2:
                # Multi-class classification
                num_classes = len(np.unique(y_train))
                outputs = Dense(num_classes, activation="softmax")(x)
                loss = "sparse_categorical_crossentropy"
            else:
                # Binary classification
                outputs = Dense(1, activation=output_activation)(x)
                loss = "binary_crossentropy"
            
            nn_model = Model(inputs=inputs, outputs=outputs)
            
            # Compile model
            nn_model.compile(
                optimizer=Adam(learning_rate=learning_rate),
                loss=loss,
                metrics=["accuracy"]
            )
            
            # Create model checkpoint callback
            checkpoint_path = os.path.join(self.model_dir, f"nn_model_{self.model_version}.h5")
            checkpoint = ModelCheckpoint(
                checkpoint_path,
                monitor="val_loss",
                save_best_only=True,
                mode="min",
                verbose=1
            )
            
            # Create early stopping callback
            early_stopping = EarlyStopping(
                monitor="val_loss",
                patience=early_stopping_patience,
                restore_best_weights=True,
                mode="min",
                verbose=1
            )
            
            # Train model
            if X_val is not None and y_val is not None:
                history = nn_model.fit(
                    X_train, y_train,
                    validation_data=(X_val, y_val),
                    epochs=epochs,
                    batch_size=batch_size,
                    callbacks=[early_stopping, checkpoint],
                    verbose=1
                )
            else:
                history = nn_model.fit(
                    X_train, y_train,
                    validation_split=validation_split,
                    epochs=epochs,
                    batch_size=batch_size,
                    callbacks=[early_stopping, checkpoint],
                    verbose=1
                )
            
            # Plot training history
            self._plot_training_history(history)
            
            # Load best model
            nn_model = load_model(checkpoint_path)
            
            self.model = nn_model
        
        else:
            # Train model normally
            self.model.fit(X_train, y_train)
        
        # Evaluate model on validation set
        self.evaluate(X_val, y_val)
        
        # Save model
        self.save_model()
        
        return self
    
    def predict(
        self,
        X: pd.DataFrame,
        threshold: Optional[float] = None
    ) -> np.ndarray:
        """
        Make predictions with the trained model
        
        Args:
            X: Features to predict on
            threshold: Classification threshold (for binary classification)
            
        Returns:
            Predicted classes
        """
        if self.model is None:
            raise ValueError("Model not trained. Call fit() first.")
        
        if threshold is None:
            threshold = self.model_config.get("threshold", 0.5)
        
        # Make predictions
        if self.model_type == "nn":
            # Neural network
            y_pred_proba = self.model.predict(X)
            
            if y_pred_proba.shape[1] > 1:
                # Multi-class
                y_pred = np.argmax(y_pred_proba, axis=1)
            else:
                # Binary class
                y_pred = (y_pred_proba > threshold).astype(int).flatten()
        else:
            # Scikit-learn model
            try:
                y_pred_proba = self.model.predict_proba(X)
                
                if y_pred_proba.shape[1] > 2:
                    # Multi-class
                    y_pred = np.argmax(y_pred_proba, axis=1)
                else:
                    # Binary class
                    y_pred = (y_pred_proba[:, 1] > threshold).astype(int)
            except AttributeError:
                # Model doesn't support predict_proba
                y_pred = self.model.predict(X)
        
        return y_pred
    
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """
        Predict class probabilities
        
        Args:
            X: Features to predict on
            
        Returns:
            Predicted class probabilities
        """
        if self.model is None:
            raise ValueError("Model not trained. Call fit() first.")
        
        # Make predictions
        if self.model_type == "nn":
            # Neural network
            y_pred_proba = self.model.predict(X)
            
            if y_pred_proba.shape[1] == 1:
                # Binary class, convert to 2-column format
                y_pred_proba = np.hstack((1 - y_pred_proba, y_pred_proba))
        else:
            # Scikit-learn model
            y_pred_proba = self.model.predict_proba(X)
        
        return y_pred_proba
    
    def predict_risk_score(self, X: pd.DataFrame) -> np.ndarray:
        """
        Convert probability predictions to risk scores (0-100)
        
        Args:
            X: Features to predict on
            
        Returns:
            Risk scores (0-100)
        """
        # Get probability predictions
        proba = self.predict_proba(X)
        
        if proba.shape[1] > 2:
            # Multi-class: use weighted sum approach
            # Higher class index = higher risk
            weights = np.arange(proba.shape[1]) / (proba.shape[1] - 1) * 100
            risk_scores = np.sum(proba * weights, axis=1)
        else:
            # Binary class: use probability of positive class
            risk_scores = proba[:, 1] * 100
        
        return risk_scores
    
    def evaluate(
        self,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        threshold: Optional[float] = None
    ) -> Dict[str, float]:
        """
        Evaluate the model on test data
        
        Args:
            X_test: Test features
            y_test: Test labels
            threshold: Classification threshold (for binary classification)
            
        Returns:
            Dictionary of evaluation metrics
        """
        if self.model is None:
            raise ValueError("Model not trained. Call fit() first.")
        
        if threshold is None:
            threshold = self.model_config.get("threshold", 0.5)
        
        # Get predictions
        y_pred = self.predict(X_test, threshold)
        
        # Classification report
        report = classification_report(y_test, y_pred, output_dict=True)
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        # Plot confusion matrix
        self._plot_confusion_matrix(cm, y_test.unique())
        
        # Calculate metrics
        metrics = {}
        for metric in self.model_config.get("metrics", ["accuracy"]):
            if metric == "accuracy":
                metrics["accuracy"] = report["accuracy"]
            elif metric == "precision":
                metrics["precision"] = report["weighted avg"]["precision"]
            elif metric == "recall":
                metrics["recall"] = report["weighted avg"]["recall"]
            elif metric == "f1":
                metrics["f1"] = report["weighted avg"]["f1-score"]
            elif metric == "roc_auc":
                if len(np.unique(y_test)) == 2:
                    try:
                        y_pred_proba = self.predict_proba(X_test)[:, 1]
                        metrics["roc_auc"] = roc_auc_score(y_test, y_pred_proba)
                    except:
                        logger.warning("Could not calculate ROC AUC")
        
        # Print evaluation results
        logger.info("Evaluation results:")
        for metric, value in metrics.items():
            logger.info(f"{metric}: {value:.4f}")
        
        # If binary classification, plot ROC curve and PR curve
        if len(np.unique(y_test)) == 2:
            try:
                y_pred_proba = self.predict_proba(X_test)[:, 1]
                self._plot_roc_curve(y_test, y_pred_proba)
                self._plot_pr_curve(y_test, y_pred_proba)
            except:
                logger.warning("Could not plot ROC and PR curves")
        
        return metrics
    
    def save_model(self, file_path: Optional[str] = None):
        """
        Save the trained model to disk
        
        Args:
            file_path: Path to save the model (optional)
        """
        if self.model is None:
            raise ValueError("Model not trained. Call fit() first.")
        
        if file_path is None:
            os.makedirs(os.path.join(self.model_dir, self.model_version), exist_ok=True)
            file_path = os.path.join(
                self.model_dir,
                self.model_version,
                f"{self.model_type}_model.pkl"
            )
        
        # Save model
        if self.model_type == "nn":
            # Save neural network model
            nn_file_path = file_path.replace(".pkl", ".h5")
            self.model.save(nn_file_path)
            logger.info(f"Saved neural network model to {nn_file_path}")
        else:
            # Save scikit-learn model
            with open(file_path, 'wb') as f:
                pickle.dump(self.model, f)
            logger.info(f"Saved model to {file_path}")
        
        # Save model config
        config_path = os.path.join(
            self.model_dir,
            self.model_version,
            "model_config.json"
        )
        
        with open(config_path, 'w') as f:
            json.dump(self.model_config, f, indent=4)
        
        logger.info(f"Saved model configuration to {config_path}")
    
    def load_model(self, model_version: Optional[str] = None, file_path: Optional[str] = None):
        """
        Load a trained model from disk
        
        Args:
            model_version: Version of the model to load (optional)
            file_path: Path to the model file (optional)
        """
        if model_version is not None:
            self.model_version = model_version
            file_path = os.path.join(
                self.model_dir,
                model_version,
                f"{self.model_type}_model.pkl"
            )
        
        if file_path is None:
            raise ValueError("Either model_version or file_path must be provided")
        
        # Load model
        if self.model_type == "nn":
            # Load neural network model
            nn_file_path = file_path.replace(".pkl", ".h5")
            self.model = load_model(nn_file_path)
            logger.info(f"Loaded neural network model from {nn_file_path}")
        else:
            # Load scikit-learn model
            with open(file_path, 'rb') as f:
                self.model = pickle.load(f)
            logger.info(f"Loaded model from {file_path}")
        
        # Load model config
        config_path = os.path.join(
            self.model_dir,
            self.model_version,
            "model_config.json"
        )
        
        try:
            with open(config_path, 'r') as f:
                self.model_config = json.load(f)
            
            logger.info(f"Loaded model configuration from {config_path}")
        except FileNotFoundError:
            logger.warning(f"Model configuration file not found at {config_path}")
    
    def _plot_confusion_matrix(self, cm: np.ndarray, classes: np.ndarray):
        """
        Plot confusion matrix
        
        Args:
            cm: Confusion matrix
            classes: Class labels
        """
        plt.figure(figsize=(10, 8))
        sns.heatmap(
            cm,
            annot=True,
            fmt="d",
            cmap="Blues",
            xticklabels=classes,
            yticklabels=classes
        )
        plt.xlabel("Predicted")
        plt.ylabel("Actual")
        plt.title("Confusion Matrix")
        
        # Save plot
        os.makedirs(os.path.join(self.model_dir, self.model_version, "plots"), exist_ok=True)
        plot_path = os.path.join(
            self.model_dir,
            self.model_version,
            "plots",
            "confusion_matrix.png"
        )
        plt.savefig(plot_path)
        logger.info(f"Saved confusion matrix plot to {plot_path}")
        plt.close()
    
    def _plot_roc_curve(self, y_true: np.ndarray, y_score: np.ndarray):
        """
        Plot ROC curve
        
        Args:
            y_true: True labels
            y_score: Predicted scores
        """
        from sklearn.metrics import roc_curve, auc
        
        fpr, tpr, _ = roc_curve(y_true, y_score)
        roc_auc = auc(fpr, tpr)
        
        plt.figure(figsize=(10, 8))
        plt.plot(
            fpr, tpr,
            color="darkorange",
            lw=2,
            label=f"ROC curve (area = {roc_auc:.2f})"
        )
        plt.plot([0, 1], [0, 1], color="navy", lw=2, linestyle="--")
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.title("Receiver Operating Characteristic")
        plt.legend(loc="lower right")
        
        # Save plot
        os.makedirs(os.path.join(self.model_dir, self.model_version, "plots"), exist_ok=True)
        plot_path = os.path.join(
            self.model_dir,
            self.model_version,
            "plots",
            "roc_curve.png"
        )
        plt.savefig(plot_path)
        logger.info(f"Saved ROC curve plot to {plot_path}")
        plt.close()
    
    def _plot_pr_curve(self, y_true: np.ndarray, y_score: np.ndarray):
        """
        Plot precision-recall curve
        
        Args:
            y_true: True labels
            y_score: Predicted scores
        """
        from sklearn.metrics import precision_recall_curve, average_precision_score
        
        precision, recall, _ = precision_recall_curve(y_true, y_score)
        avg_precision = average_precision_score(y_true, y_score)
        
        plt.figure(figsize=(10, 8))
        plt.plot(
            recall, precision,
            color="blue",
            lw=2,
            label=f"PR curve (AP = {avg_precision:.2f})"
        )
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel("Recall")
        plt.ylabel("Precision")
        plt.title("Precision-Recall Curve")
        plt.legend(loc="lower left")
        
        # Save plot
        os.makedirs(os.path.join(self.model_dir, self.model_version, "plots"), exist_ok=True)
        plot_path = os.path.join(
            self.model_dir,
            self.model_version,
            "plots",
            "pr_curve.png"
        )
        plt.savefig(plot_path)
        logger.info(f"Saved precision-recall curve plot to {plot_path}")
        plt.close()
    
    def _plot_training_history(self, history):
        """
        Plot training history for neural network
        
        Args:
            history: Training history object
        """
        # Plot loss
        plt.figure(figsize=(12, 5))
        plt.subplot(1, 2, 1)
        plt.plot(history.history['loss'], label='train')
        plt.plot(history.history['val_loss'], label='validation')
        plt.title('Model Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss')
        plt.legend()
        
        # Plot accuracy
        plt.subplot(1, 2, 2)
        plt.plot(history.history['accuracy'], label='train')
        plt.plot(history.history['val_accuracy'], label='validation')
        plt.title('Model Accuracy')
        plt.xlabel('Epoch')
        plt.ylabel('Accuracy')
        plt.legend()
        
        # Save plot
        os.makedirs(os.path.join(self.model_dir, self.model_version, "plots"), exist_ok=True)
        plot_path = os.path.join(
            self.model_dir,
            self.model_version,
            "plots",
            "training_history.png"
        )
        plt.savefig(plot_path)
        logger.info(f"Saved training history plot to {plot_path}")
        plt.close()
