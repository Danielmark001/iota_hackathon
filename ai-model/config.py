"""
IntelliLend AI Model Configuration

This module contains configuration settings for the IntelliLend AI risk assessment models,
including hyperparameters, feature definitions, and model architecture settings.
"""

import os
from datetime import datetime

# Base directory for AI model components
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths to model files and data
MODEL_DIR = os.path.join(BASE_DIR, 'models')
DATA_DIR = os.path.join(BASE_DIR, 'data-processing', 'data')
LOGS_DIR = os.path.join(BASE_DIR, 'logs')

# Ensure directories exist
for directory in [MODEL_DIR, DATA_DIR, LOGS_DIR]:
    os.makedirs(directory, exist_ok=True)

# Model version and metadata
MODEL_VERSION = '1.2.0'
MODEL_TIMESTAMP = datetime.now().isoformat()
MODEL_DESCRIPTION = 'IntelliLend Risk Assessment Model with Enhanced ML Capabilities'

# Risk classifier settings
RISK_CLASSIFIER = {
    'model_type': 'random_forest',
    'hyperparameters': {
        'n_estimators': 300,
        'max_depth': 30,
        'min_samples_split': 5,
        'class_weight': 'balanced_subsample'
    },
    'file_path': os.path.join(MODEL_DIR, 'risk_classifier.joblib')
}

# Default predictor settings
DEFAULT_PREDICTOR = {
    'model_type': 'gradient_boosting',
    'hyperparameters': {
        'n_estimators': 200,
        'learning_rate': 0.05,
        'max_depth': 5,
        'subsample': 0.9
    },
    'file_path': os.path.join(MODEL_DIR, 'default_predictor.joblib')
}

# Time series model settings
TIME_SERIES_MODEL = {
    'model_type': 'prophet',
    'hyperparameters': {
        'changepoint_prior_scale': 0.05,
        'seasonality_mode': 'multiplicative',
        'yearly_seasonality': False,
        'weekly_seasonality': True,
        'daily_seasonality': True
    },
    'fallback_model': 'arima',
    'fallback_hyperparameters': {
        'order': (1, 1, 1)
    },
    'directory': os.path.join(MODEL_DIR, 'time_series')
}

# Reinforcement learning settings for interest rate optimization
INTEREST_OPTIMIZER = {
    'model_type': 'ppo',
    'hyperparameters': {
        'policy_type': 'MlpPolicy',
        'learning_rate': 3e-4,
        'n_steps': 2048,
        'batch_size': 64,
        'n_epochs': 10,
        'gamma': 0.99,
        'gae_lambda': 0.95,
        'clip_range': 0.2,
        'ent_coef': 0.01,
        'max_grad_norm': 0.5,
        'use_sde': True,
        'sde_sample_freq': 4
    },
    'environment': {
        'reward_scale': 5.0,
        'observation_space_dim': 5,
        'action_space_dim': 1,
        'max_steps': 10,
        'interest_rate_bounds': [0.01, 0.25]  # Min and max interest rates (1% to 25%)
    },
    'file_path': os.path.join(MODEL_DIR, 'interest_optimizer')
}

# Feature definitions
FEATURES = {
    # Transaction history features
    'transaction_count': {
        'description': 'Total number of transactions by the user',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'scale'
    },
    'avg_transaction_value': {
        'description': 'Average value of transactions',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'log_scale'
    },
    'max_transaction_value': {
        'description': 'Maximum transaction value',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'log_scale'
    },
    'min_transaction_value': {
        'description': 'Minimum transaction value',
        'type': 'numerical',
        'importance': 'low',
        'preprocessing': 'log_scale'
    },
    'transaction_frequency': {
        'description': 'Average number of transactions per day',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'transaction_regularity': {
        'description': 'Consistency of transaction patterns',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'transaction_growth_rate': {
        'description': 'Rate of growth in transaction activity',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'none'
    },
    'incoming_tx_ratio': {
        'description': 'Ratio of incoming to total transactions',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    
    # Wallet characteristics
    'wallet_age_days': {
        'description': 'Age of wallet in days',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'log_scale'
    },
    'wallet_balance': {
        'description': 'Current wallet balance',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'log_scale'
    },
    'wallet_balance_volatility': {
        'description': 'Volatility of wallet balance',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'none'
    },
    'balance_utilization_ratio': {
        'description': 'Ratio of used balance to total balance',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'address_entropy': {
        'description': 'Measure of randomness in address usage',
        'type': 'numerical',
        'importance': 'low',
        'preprocessing': 'none'
    },
    
    # Lending history
    'previous_loans_count': {
        'description': 'Number of previous loans',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'scale'
    },
    'repayment_ratio': {
        'description': 'Ratio of repaid loans to total loans',
        'type': 'numerical',
        'importance': 'very_high',
        'preprocessing': 'none'
    },
    'default_count': {
        'description': 'Number of defaults',
        'type': 'numerical',
        'importance': 'very_high',
        'preprocessing': 'none'
    },
    'avg_loan_duration': {
        'description': 'Average duration of loans in days',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'max_loan_amount': {
        'description': 'Maximum loan amount',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'log_scale'
    },
    'early_repayment_frequency': {
        'description': 'Frequency of early repayments',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'late_payment_frequency': {
        'description': 'Frequency of late payments',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'none'
    },
    
    # Collateral behavior
    'collateral_diversity': {
        'description': 'Diversity of collateral types',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'collateral_value_ratio': {
        'description': 'Ratio of collateral value to loan value',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'none'
    },
    'collateral_quality_score': {
        'description': 'Quality score of collateral',
        'type': 'categorical',
        'importance': 'high',
        'preprocessing': 'one_hot_encode'
    },
    'collateral_volatility': {
        'description': 'Volatility of collateral value',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'none'
    },
    
    # Network analysis
    'network_centrality': {
        'description': 'Measure of user centrality in the transaction network',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'unique_counterparties': {
        'description': 'Number of unique transaction counterparties',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'trusted_counterparties_ratio': {
        'description': 'Ratio of trusted counterparties to total',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'counterparty_risk_exposure': {
        'description': 'Risk exposure from counterparties',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    
    # Cross-chain and protocol activity
    'cross_chain_activity': {
        'description': 'Level of cross-chain activity',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'defi_protocol_diversity': {
        'description': 'Diversity of DeFi protocols used',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'lending_protocol_interactions': {
        'description': 'Number of interactions with lending protocols',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'staking_history_score': {
        'description': 'Score based on staking history',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'governance_participation': {
        'description': 'Level of participation in governance',
        'type': 'numerical',
        'importance': 'low',
        'preprocessing': 'none'
    },
    
    # Market condition features
    'market_volatility_correlation': {
        'description': 'Correlation of user activity with market volatility',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'token_price_correlation': {
        'description': 'Correlation of user activity with token prices',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'none'
    },
    'liquidation_risk_score': {
        'description': 'Score indicating liquidation risk',
        'type': 'numerical',
        'importance': 'high',
        'preprocessing': 'scale'
    },
    
    # Security and identity features
    'identity_verification_level': {
        'description': 'Level of identity verification',
        'type': 'categorical',
        'importance': 'high',
        'preprocessing': 'one_hot_encode'
    },
    'security_score': {
        'description': 'Security score based on wallet behavior',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    },
    'social_trust_score': {
        'description': 'Trust score based on social verification',
        'type': 'numerical',
        'importance': 'medium',
        'preprocessing': 'scale'
    }
}

# Engineered features
ENGINEERED_FEATURES = [
    'default_risk_ratio',
    'late_payment_risk',
    'lending_engagement',
    'financial_stability',
    'collateral_health',
    'network_trust',
    'market_risk_exposure',
    'combined_risk_indicator'
]

# Feature groups for different use cases
FEATURE_GROUPS = {
    'core_risk': [
        'repayment_ratio',
        'default_count',
        'late_payment_frequency',
        'wallet_balance_volatility',
        'collateral_value_ratio',
        'collateral_quality_score'
    ],
    'identity': [
        'identity_verification_level',
        'security_score',
        'social_trust_score',
        'network_centrality',
        'trusted_counterparties_ratio'
    ],
    'activity': [
        'transaction_count',
        'transaction_frequency',
        'transaction_growth_rate',
        'lending_protocol_interactions',
        'previous_loans_count'
    ],
    'market': [
        'market_volatility_correlation',
        'token_price_correlation',
        'liquidation_risk_score',
        'collateral_volatility'
    ],
    'time_series': [
        'transaction_count',
        'avg_transaction_value',
        'wallet_balance',
        'repayment_ratio',
        'default_count',
        'market_volatility_correlation'
    ]
}

# Risk category definitions
RISK_CATEGORIES = {
    0: {
        'name': 'Low Risk',
        'description': 'Very safe borrowers with excellent repayment history',
        'score_range': [0, 25],
        'interest_rate_adjustment': -0.02,  # -2% from base rate
        'collateral_factor_adjustment': 0.05,  # +5% to collateral factor
        'color': 'green'
    },
    1: {
        'name': 'Medium-Low Risk',
        'description': 'Good borrowers with solid repayment history',
        'score_range': [26, 40],
        'interest_rate_adjustment': -0.01,  # -1% from base rate
        'collateral_factor_adjustment': 0.025,  # +2.5% to collateral factor
        'color': 'lightgreen'
    },
    2: {
        'name': 'Medium Risk',
        'description': 'Average borrowers with acceptable repayment history',
        'score_range': [41, 60],
        'interest_rate_adjustment': 0.0,  # No adjustment
        'collateral_factor_adjustment': 0.0,  # No adjustment
        'color': 'yellow'
    },
    3: {
        'name': 'Medium-High Risk',
        'description': 'Below average borrowers with some repayment issues',
        'score_range': [61, 75],
        'interest_rate_adjustment': 0.03,  # +3% to base rate
        'collateral_factor_adjustment': -0.05,  # -5% from collateral factor
        'color': 'orange'
    },
    4: {
        'name': 'High Risk',
        'description': 'Risky borrowers with significant repayment issues',
        'score_range': [76, 100],
        'interest_rate_adjustment': 0.08,  # +8% to base rate
        'collateral_factor_adjustment': -0.1,  # -10% from collateral factor
        'color': 'red'
    }
}

# Recommendation templates
RECOMMENDATION_TEMPLATES = {
    'add_collateral': {
        'title': 'Add More Collateral',
        'description': 'Increase your collateral to improve your position health and reduce liquidation risk.',
        'condition': lambda user_data: user_data.get('collateral_value_ratio', 1.5) < 1.5,
        'impact': 'high'
    },
    'verify_identity': {
        'title': 'Complete Identity Verification',
        'description': 'Verify your identity to receive better borrowing terms.',
        'condition': lambda user_data: not user_data.get('identity_verified', False),
        'impact': 'high'
    },
    'reduce_volatility': {
        'title': 'Reduce Wallet Volatility',
        'description': 'Maintain more consistent wallet balances to demonstrate financial stability.',
        'condition': lambda user_data: user_data.get('wallet_balance_volatility', 0) > 0.3,
        'impact': 'medium'
    },
    'diversify_collateral': {
        'title': 'Diversify Your Collateral',
        'description': 'Use multiple types of collateral to reduce risk from price fluctuations.',
        'condition': lambda user_data: user_data.get('collateral_diversity', 1) < 2,
        'impact': 'medium'
    },
    'repay_partial': {
        'title': 'Make Partial Repayment',
        'description': 'Reducing your loan balance will improve your position health.',
        'condition': lambda user_data: user_data.get('health_factor', 2) < 1.5,
        'impact': 'high'
    },
    'consistent_repayments': {
        'title': 'Maintain Consistent Repayments',
        'description': 'Regular on-time repayments will improve your credit profile.',
        'condition': lambda user_data: user_data.get('late_payment_frequency', 0) > 0.1,
        'impact': 'medium'
    },
    'reduce_cross_chain': {
        'title': 'Reduce Cross-Chain Exposure',
        'description': 'High cross-chain activity increases your risk profile.',
        'condition': lambda user_data: user_data.get('cross_chain_activity', 0) > 5,
        'impact': 'low'
    },
    'market_correlation': {
        'title': 'Monitor Market Correlation',
        'description': 'Your assets are highly correlated with market volatility.',
        'condition': lambda user_data: user_data.get('market_volatility_correlation', 0) > 0.7,
        'impact': 'medium'
    }
}

# API configuration
API_CONFIG = {
    'host': '0.0.0.0',
    'port': 5000,
    'debug': False,
    'timeout': 30,
    'rate_limit': 100,  # requests per minute
    'endpoints': {
        'risk_assessment': '/api/risk-assessment',
        'recommendations': '/api/recommendations',
        'interest_rate': '/api/interest-rate',
        'time_series': '/api/time-series',
        'verification': '/api/verify-identity'
    }
}

# Blockchain integration
BLOCKCHAIN_CONFIG = {
    'update_threshold': 5,  # Min risk score change to trigger on-chain update
    'update_frequency': 24 * 60 * 60,  # Min time between updates (in seconds)
    'risk_score_mapping': {
        'evm': {
            'scale': 100,  # 0-100 scale
            'invert': False  # Higher is riskier
        },
        'move': {
            'scale': 255,  # 0-255 scale for Move u8 type
            'invert': False  # Higher is riskier
        }
    }
}

# Zero-knowledge proof settings
ZK_PROOF_CONFIG = {
    'supported_schemes': ['groth16', 'plonk', 'stark'],
    'default_scheme': 'groth16',
    'proving_key_path': os.path.join(BASE_DIR, 'proving_keys'),
    'verification_key_path': os.path.join(BASE_DIR, 'verification_keys'),
    'proof_types': {
        'IDENTITY_VERIFICATION': {
            'description': 'Proof of identity verification without revealing personal data',
            'public_inputs': ['user_address', 'verification_level', 'timestamp'],
            'private_inputs': ['identity_documents', 'personal_info', 'biometric_data']
        },
        'CREDIT_HISTORY': {
            'description': 'Proof of credit history without revealing full history',
            'public_inputs': ['user_address', 'credit_score', 'timestamp'],
            'private_inputs': ['repayment_history', 'default_history', 'loan_amounts']
        },
        'COLLATERAL_OWNERSHIP': {
            'description': 'Proof of collateral ownership without revealing full details',
            'public_inputs': ['user_address', 'collateral_value', 'timestamp'],
            'private_inputs': ['asset_ids', 'ownership_proof', 'asset_details']
        },
        'RISK_SCORE_UPDATE': {
            'description': 'Proof of risk assessment without revealing assessment factors',
            'public_inputs': ['user_address', 'risk_score', 'timestamp'],
            'private_inputs': ['risk_factors', 'raw_scores', 'calculation_details']
        }
    }
}

# Runtime configuration
def update_runtime_config():
    """
    Update runtime configuration based on environment variables
    """
    # Get environment variables with defaults
    config = {}
    
    # Model selection
    config['use_local_model'] = os.environ.get('USE_LOCAL_MODEL', 'true').lower() == 'true'
    config['model_type'] = os.environ.get('MODEL_TYPE', 'ensemble')
    
    # API settings
    config['api_url'] = os.environ.get('AI_API_URL', 'http://localhost:5000')
    config['api_key'] = os.environ.get('AI_API_KEY', '')
    
    # Blockchain settings
    config['update_on_chain'] = os.environ.get('UPDATE_ON_CHAIN', 'false').lower() == 'true'
    config['generate_zk_proof'] = os.environ.get('GENERATE_ZK_PROOF', 'false').lower() == 'true'
    config['cross_layer_enabled'] = os.environ.get('CROSS_LAYER_ENABLED', 'true').lower() == 'true'
    
    # Logging
    config['log_level'] = os.environ.get('LOG_LEVEL', 'INFO')
    config['log_file'] = os.path.join(LOGS_DIR, f'intellilend_ai_{datetime.now().strftime("%Y%m%d")}.log')
    
    return config

# Get runtime configuration
RUNTIME_CONFIG = update_runtime_config()

if __name__ == "__main__":
    """
    Print configuration details when run directly
    """
    import json
    import sys
    
    config_summary = {
        'model_version': MODEL_VERSION,
        'features_count': len(FEATURES),
        'model_types': {
            'risk_classifier': RISK_CLASSIFIER['model_type'],
            'default_predictor': DEFAULT_PREDICTOR['model_type'],
            'time_series': TIME_SERIES_MODEL['model_type'],
            'interest_optimizer': INTEREST_OPTIMIZER['model_type']
        },
        'risk_categories': list(RISK_CATEGORIES.keys()),
        'runtime_config': RUNTIME_CONFIG
    }
    
    # Print basic summary
    print(f"=== IntelliLend AI Model Configuration ===")
    print(f"Version: {MODEL_VERSION}")
    print(f"Base Directory: {BASE_DIR}")
    print(f"Features: {len(FEATURES)} total, {len(ENGINEERED_FEATURES)} engineered")
    print(f"Risk Categories: {len(RISK_CATEGORIES)}")
    print(f"ZK Proof Types: {len(ZK_PROOF_CONFIG['proof_types'])}")
    
    # Print detailed configuration if requested
    if len(sys.argv) > 1 and sys.argv[1] == '--verbose':
        print("\nDetailed Configuration:")
        print(json.dumps(config_summary, indent=2))
