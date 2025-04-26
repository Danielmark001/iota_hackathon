"""
Synthetic Data Generator for IOTA Risk Model Training

This script generates synthetic data that can be used to train the IOTA risk assessment model.
It creates realistic distributions of features and includes known correlations with the target variable.
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
from typing import Dict, Any, List, Optional, Tuple
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("data_generator.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def generate_ethereum_address() -> str:
    """Generate a random Ethereum address."""
    return "0x" + ''.join(random.choices('0123456789abcdef', k=40))

def generate_iota_address() -> str:
    """Generate a random IOTA address."""
    prefixes = ["smr", "rms", "iota"]
    prefix = random.choice(prefixes)
    return f"{prefix}1" + ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=60))

def generate_synthetic_data(n_samples: int = 1000, default_rate: float = 0.15,
                            output_file: str = None) -> pd.DataFrame:
    """
    Generate synthetic data for training risk models.
    
    Args:
        n_samples: Number of samples to generate
        default_rate: Proportion of loans that default
        output_file: Path to save the CSV file (optional)
        
    Returns:
        DataFrame with synthetic data
    """
    logger.info(f"Generating {n_samples} synthetic data samples with {default_rate*100:.1f}% default rate")
    
    # Generate Ethereum and IOTA addresses
    eth_addresses = [generate_ethereum_address() for _ in range(n_samples)]
    
    # Some users don't have IOTA addresses
    has_iota_address = np.random.choice([True, False], n_samples, p=[0.7, 0.3])
    iota_addresses = [generate_iota_address() if has else None for has in has_iota_address]
    
    # Generate basic user features
    transaction_count = np.random.poisson(15, n_samples)  # IOTA transaction count
    message_count = np.random.poisson(8, n_samples)  # IOTA message count
    balance = np.random.exponential(200, n_samples)  # IOTA balance
    eth_balance = np.random.exponential(1.5, n_samples)  # Ethereum balance in ETH
    
    # Activity metrics
    activity_regularity = np.random.beta(5, 2, n_samples)  # Higher is more regular
    first_activity_days = np.random.randint(1, 365*2, n_samples)  # Days since first activity
    native_tokens_count = np.random.poisson(3, n_samples)  # Number of different tokens held
    cross_layer_transfers = np.random.poisson(2, n_samples)  # Number of cross-layer transfers
    
    # Identity verification (none, basic, advanced, full)
    identity_levels = ["none", "basic", "advanced", "full"]
    identity_weights = [0.4, 0.3, 0.2, 0.1]  # Most users have no or basic verification
    identity_verification_level = np.random.choice(identity_levels, n_samples, p=identity_weights)
    identity_verified = identity_verification_level != "none"
    
    # Lending metrics
    current_borrows = np.random.exponential(100, n_samples)
    current_collaterals = np.zeros(n_samples)
    
    # Ensure realistic collateral ratios (typically 1.2-3.0)
    for i in range(n_samples):
        if current_borrows[i] > 0:
            # Generate collateral ratio between 0.8 and 3.0 with most values around 1.5-2.0
            collateral_ratio = np.random.beta(6, 3, 1)[0] * 2.2 + 0.8
            current_collaterals[i] = current_borrows[i] * collateral_ratio
    
    # Generate repayment history
    repayment_ratio = np.random.beta(8, 2, n_samples)  # Most users repay well
    previous_loans_count = np.random.poisson(3, n_samples)
    
    # Set some users to have no history
    new_users = np.random.choice([True, False], n_samples, p=[0.2, 0.8])
    for i in range(n_samples):
        if new_users[i]:
            previous_loans_count[i] = 0
            repayment_ratio[i] = 0.5  # Neutral for new users
    
    # Generate target variable with known correlations
    # Higher probability of default with:
    # - Low collateral ratio
    # - Low repayment ratio
    # - Low transaction count
    # - No identity verification
    # - Low activity regularity
    
    # Calculate default probabilities
    default_probs = np.zeros(n_samples)
    
    for i in range(n_samples):
        # Base probability from global default rate
        prob = default_rate
        
        # Adjust based on key risk factors
        
        # Collateral ratio effect
        if current_borrows[i] > 0:
            collateral_ratio = current_collaterals[i] / current_borrows[i]
            if collateral_ratio < 1.2:
                prob *= 2.0  # Much higher default risk with low collateral
            elif collateral_ratio > 2.0:
                prob *= 0.5  # Much lower default risk with high collateral
        
        # Repayment history effect
        if previous_loans_count[i] > 0:
            if repayment_ratio[i] < 0.7:
                prob *= 2.5  # Poor repayment history increases default risk
            elif repayment_ratio[i] > 0.9:
                prob *= 0.4  # Excellent repayment history decreases default risk
        
        # Transaction count effect
        if transaction_count[i] < 5:
            prob *= 1.5  # Low activity increases risk
        elif transaction_count[i] > 20:
            prob *= 0.7  # High activity decreases risk
        
        # Identity verification effect
        if identity_verification_level[i] == "none":
            prob *= 1.3  # No verification increases risk
        elif identity_verification_level[i] == "full":
            prob *= 0.6  # Full verification decreases risk
        
        # Activity regularity effect
        if activity_regularity[i] < 0.3:
            prob *= 1.4  # Irregular activity increases risk
        elif activity_regularity[i] > 0.7:
            prob *= 0.8  # Regular activity decreases risk
        
        # Cross-layer activity effect
        if cross_layer_transfers[i] > 5:
            prob *= 0.7  # Active cross-layer users have lower risk
        
        # Cap probability at 1.0
        default_probs[i] = min(1.0, prob)
    
    # Generate default outcome based on calculated probabilities
    default_risk = np.random.binomial(1, default_probs)
    
    # Combine all features into a DataFrame
    data = pd.DataFrame({
        "address": eth_addresses,
        "iota_address": iota_addresses,
        "has_iota_address": has_iota_address,
        "transaction_count": transaction_count,
        "message_count": message_count,
        "balance": balance,
        "eth_balance": eth_balance,
        "activity_regularity": activity_regularity,
        "first_activity_days": first_activity_days,
        "native_tokens_count": native_tokens_count,
        "cross_layer_transfers": cross_layer_transfers,
        "identity_verification_level": identity_verification_level,
        "identity_verified": identity_verified,
        "wallet_balance": balance + (eth_balance * 1800),  # Convert ETH to USD
        "current_borrows": current_borrows,
        "current_collaterals": current_collaterals,
        "repayment_ratio": repayment_ratio,
        "previous_loans_count": previous_loans_count,
        "default_risk": default_risk
    })
    
    # Add some missing values to simulate real-world data
    for col in ["transaction_count", "message_count", "balance", "cross_layer_transfers", 
                "wallet_balance", "current_borrows", "current_collaterals", "repayment_ratio"]:
        # Randomly set some values to NaN (5% of values)
        mask = np.random.choice([True, False], n_samples, p=[0.05, 0.95])
        data.loc[mask, col] = np.nan
    
    # Create real_iota_data column
    data["used_real_iota_data"] = np.random.choice([True, False], n_samples, p=[0.6, 0.4])
    
    # For users without IOTA address, set IOTA-specific fields to NaN
    no_iota_mask = ~data["has_iota_address"]
    for col in ["transaction_count", "message_count", "balance", "activity_regularity", 
                "first_activity_days", "native_tokens_count"]:
        data.loc[no_iota_mask, col] = np.nan
    
    # Save to CSV if output file specified
    if output_file:
        data.to_csv(output_file, index=False)
        logger.info(f"Saved {n_samples} samples to {output_file}")
        
        # Save actual default rate for verification
        actual_default_rate = data["default_risk"].mean()
        logger.info(f"Actual default rate: {actual_default_rate*100:.2f}%")
    
    return data

def main():
    """Command-line interface for data generation."""
    parser = argparse.ArgumentParser(description="Generate synthetic data for IOTA risk model training")
    parser.add_argument("--samples", type=int, default=1000, help="Number of samples to generate")
    parser.add_argument("--default-rate", type=float, default=0.15, help="Default rate (0-1)")
    parser.add_argument("--output", type=str, default="synthetic_training_data.csv", help="Output CSV file")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    
    args = parser.parse_args()
    
    # Set random seed if specified
    if args.seed is not None:
        np.random.seed(args.seed)
        random.seed(args.seed)
    
    # Generate and save data
    data = generate_synthetic_data(
        n_samples=args.samples,
        default_rate=args.default_rate,
        output_file=args.output
    )
    
    print(f"Generated {len(data)} samples with {data['default_risk'].mean()*100:.2f}% default rate")
    print(f"Data saved to {args.output}")
    
    # Print data statistics
    print("\nData Statistics:")
    print(f"Users with IOTA address: {data['has_iota_address'].mean()*100:.1f}%")
    print(f"Users with identity verification: {data['identity_verified'].mean()*100:.1f}%")
    verification_counts = data['identity_verification_level'].value_counts(normalize=True) * 100
    for level, percent in verification_counts.items():
        print(f"  - {level}: {percent:.1f}%")
    
    print(f"\nAverage transaction count: {data['transaction_count'].mean():.1f}")
    print(f"Average cross-layer transfers: {data['cross_layer_transfers'].mean():.1f}")
    
    # Calculate and display collateral ratio
    data['collateral_ratio'] = data.apply(
        lambda row: row['current_collaterals'] / row['current_borrows'] if row['current_borrows'] > 0 else 0, 
        axis=1
    )
    print(f"\nAverage collateral ratio: {data['collateral_ratio'][data['collateral_ratio'] > 0].mean():.2f}")
    
    # Default rate by key factors
    print("\nDefault Rates by Factor:")
    
    # By verification level
    for level in ["none", "basic", "advanced", "full"]:
        subset = data[data['identity_verification_level'] == level]
        default_rate = subset['default_risk'].mean() * 100
        print(f"  - Verification {level}: {default_rate:.1f}%")
    
    # By transaction count
    low_tx = data[data['transaction_count'] < 5]
    high_tx = data[data['transaction_count'] > 20]
    print(f"  - Low transactions (<5): {low_tx['default_risk'].mean()*100:.1f}%")
    print(f"  - High transactions (>20): {high_tx['default_risk'].mean()*100:.1f}%")
    
    # By collateral ratio
    low_collateral = data[data['collateral_ratio'] < 1.2]
    high_collateral = data[data['collateral_ratio'] > 2.0]
    if len(low_collateral) > 0:
        print(f"  - Low collateral ratio (<1.2): {low_collateral['default_risk'].mean()*100:.1f}%")
    if len(high_collateral) > 0:
        print(f"  - High collateral ratio (>2.0): {high_collateral['default_risk'].mean()*100:.1f}%")

if __name__ == "__main__":
    main()
