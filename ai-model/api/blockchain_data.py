"""
Blockchain Data Collection for AI Risk Model

This module handles on-chain data collection for the risk assessment model.
"""

import aiohttp
import asyncio
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta
from web3 import Web3
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BlockchainDataCollector:
    """
    Collects on-chain data for risk assessment.
    """
    
    def __init__(self, rpc_url=None):
        """Initialize the data collector with RPC URL."""
        self.rpc_url = rpc_url or os.environ.get('IOTA_EVM_RPC_URL', 'https://evm.wasp.sc.iota.org')
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.lending_pool_address = os.environ.get('LENDING_POOL_ADDRESS', '0x0000000000000000000000000000000000000000')
        
        # Load contract ABIs (simplified for now)
        self.lending_pool_abi = []  # In production, load from file
        
        logger.info(f"Initialized blockchain data collector with RPC: {self.rpc_url}")
    
    async def get_user_features(self, address):
        """
        Extract features for a user address.
        
        Args:
            address: User's blockchain address
            
        Returns:
            DataFrame with features for risk assessment
        """
        try:
            address = self.w3.to_checksum_address(address)
            
            # Get basic account info
            balance = self.w3.eth.get_balance(address)
            nonce = self.w3.eth.get_transaction_count(address)
            
            # Get transaction history (last 100 transactions for example)
            transactions = await self._get_transactions(address, limit=100)
            tx_count = len(transactions)
            
            # Calculate features from transactions
            avg_tx_value = np.mean([tx.get('value', 0) for tx in transactions]) if tx_count > 0 else 0
            tx_frequency = await self._calculate_tx_frequency(transactions)
            balance_volatility = await self._calculate_balance_volatility(address, transactions)
            
            # Get DeFi-specific features
            defi_features = await self._get_defi_features(address)
            
            # Combine all features
            features = {
                'transaction_count': tx_count,
                'avg_transaction_value': float(avg_tx_value) / 1e18,  # Convert from wei to IOTA
                'wallet_age_days': await self._get_wallet_age(address),
                'previous_loans_count': defi_features.get('loans_count', 0),
                'repayment_ratio': defi_features.get('repayment_ratio', 0),
                'default_count': defi_features.get('default_count', 0),
                'collateral_diversity': defi_features.get('collateral_diversity', 0),
                'cross_chain_activity': defi_features.get('cross_chain_activity', 0),
                'lending_protocol_interactions': defi_features.get('protocol_interactions', 0),
                'wallet_balance_volatility': balance_volatility
            }
            
            logger.info(f"Extracted features for {address}")
            return features
            
        except Exception as e:
            logger.error(f"Error extracting features for {address}: {e}")
            # Return default features
            return {
                'transaction_count': 0,
                'avg_transaction_value': 0,
                'wallet_age_days': 0,
                'previous_loans_count': 0,
                'repayment_ratio': 0.5,
                'default_count': 0,
                'collateral_diversity': 0,
                'cross_chain_activity': 0,
                'lending_protocol_interactions': 0,
                'wallet_balance_volatility': 0
            }
    
    async def _get_transactions(self, address, limit=100):
        """Get historical transactions for an address."""
        # In a real implementation, this would query the blockchain node or an indexer API
        # For simplicity, we're returning mock data
        mock_transactions = []
        current_block = self.w3.eth.block_number
        
        for i in range(min(10, limit)):  # Mocking 10 transactions for demo
            mock_transactions.append({
                'hash': f"0x{i}{'0'*63}",
                'from': address if i % 2 == 0 else f"0x{'a'*40}",
                'to': f"0x{'a'*40}" if i % 2 == 0 else address,
                'value': self.w3.to_wei(0.1 * (i+1), 'ether'),
                'block_number': current_block - (i * 10),
                'timestamp': int(datetime.now().timestamp()) - (i * 86400)  # 1 day apart
            })
        
        return mock_transactions
    
    async def _calculate_tx_frequency(self, transactions):
        """Calculate transaction frequency (transactions per day)."""
        if not transactions or len(transactions) < 2:
            return 0
        
        # Sort transactions by timestamp
        sorted_tx = sorted(transactions, key=lambda x: x.get('timestamp', 0))
        
        # Get time range
        first_tx = sorted_tx[0].get('timestamp', 0)
        last_tx = sorted_tx[-1].get('timestamp', 0)
        
        time_range_days = (last_tx - first_tx) / 86400  # Convert seconds to days
        if time_range_days < 1:
            time_range_days = 1  # Avoid division by zero
        
        return len(transactions) / time_range_days
    
    async def _calculate_balance_volatility(self, address, transactions):
        """Calculate the volatility of the wallet balance."""
        # In a real implementation, this would use historical balance data
        # For simplicity, we're using a random value between 0 and 10
        return np.random.rand() * 10
    
    async def _get_wallet_age(self, address):
        """Get the age of the wallet in days."""
        # In a real implementation, this would find the first transaction
        # For simplicity, returning a random value between 1 and 1000
        return int(np.random.rand() * 1000) + 1
    
    async def _get_defi_features(self, address):
        """Get DeFi-specific features for the address."""
        # In a real implementation, this would query DeFi protocols
        # For simplicity, returning mock data
        return {
            'loans_count': int(np.random.rand() * 10),
            'repayment_ratio': np.random.rand() * 0.5 + 0.5,  # 0.5 to 1.0
            'default_count': int(np.random.rand() * 3),
            'collateral_diversity': int(np.random.rand() * 5),
            'cross_chain_activity': int(np.random.rand() * 5),
            'protocol_interactions': int(np.random.rand() * 20)
        }
    
    async def batch_get_user_features(self, addresses):
        """
        Get features for multiple addresses in parallel.
        
        Args:
            addresses: List of blockchain addresses
            
        Returns:
            List of feature dictionaries, one per address
        """
        tasks = [self.get_user_features(address) for address in addresses]
        results = await asyncio.gather(*tasks)
        
        return list(zip(addresses, results))


# Utility function for synchronous API usage
def get_user_features_sync(address, rpc_url=None):
    """Synchronous wrapper for get_user_features."""
    collector = BlockchainDataCollector(rpc_url)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(collector.get_user_features(address))
    loop.close()
    return result


# Test function
if __name__ == '__main__':
    async def test():
        collector = BlockchainDataCollector()
        features = await collector.get_user_features("0x0000000000000000000000000000000000000000")
        print(features)
    
    asyncio.run(test())
