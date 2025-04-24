"""
Blockchain Data Fetcher Module

This module is responsible for fetching and processing on-chain data from the IOTA network
for the IntelliLend risk assessment model. It handles the acquisition of transaction histories,
wallet behaviors, and lending protocol interactions.
"""

import os
import logging
import asyncio
import json
import datetime
from typing import Dict, List, Optional, Tuple, Union, Any
import pandas as pd
import numpy as np
import aiohttp
import requests
from web3 import Web3

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BlockchainDataFetcher:
    """
    Class for fetching and processing on-chain data from IOTA networks
    """
    
    def __init__(
        self, 
        evm_rpc_url: str,
        iota_node_url: str,
        lending_pool_address: str,
        chain_id: int = 1,
        api_key: Optional[str] = None,
        cache_dir: str = "./cache"
    ):
        """
        Initialize the blockchain data fetcher
        
        Args:
            evm_rpc_url: URL for the IOTA EVM RPC endpoint
            iota_node_url: URL for the IOTA node
            lending_pool_address: Address of the lending pool contract
            chain_id: Chain ID for the IOTA network
            api_key: API key for any external services
            cache_dir: Directory to cache data
        """
        self.evm_rpc_url = evm_rpc_url
        self.iota_node_url = iota_node_url
        self.lending_pool_address = Web3.to_checksum_address(lending_pool_address)
        self.chain_id = chain_id
        self.api_key = api_key
        self.cache_dir = cache_dir
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize Web3 provider
        self.w3 = Web3(Web3.HTTPProvider(evm_rpc_url))
        
        # Load contract ABIs
        with open("../smart-contracts/evm/abis/LendingPool.json", "r") as f:
            self.lending_pool_abi = json.load(f)
        
        # Initialize contract objects
        self.lending_pool = self.w3.eth.contract(
            address=self.lending_pool_address,
            abi=self.lending_pool_abi
        )
        
        logger.info(f"Initialized BlockchainDataFetcher with IOTA EVM node: {evm_rpc_url}")
        logger.info(f"Connected to network with chain ID: {self.w3.eth.chain_id}")
    
    async def fetch_user_transaction_history(
        self, 
        user_address: str,
        days_back: int = 365,
        include_internal: bool = True
    ) -> pd.DataFrame:
        """
        Fetch transaction history for a user
        
        Args:
            user_address: The address to fetch transactions for
            days_back: Number of days to look back in history
            include_internal: Whether to include internal transactions
            
        Returns:
            DataFrame containing transaction history
        """
        user_address = Web3.to_checksum_address(user_address)
        cache_file = f"{self.cache_dir}/tx_history_{user_address}_{days_back}.csv"
        
        # Check if cached data exists and is recent
        if os.path.exists(cache_file):
            cache_mtime = os.path.getmtime(cache_file)
            cache_dt = datetime.datetime.fromtimestamp(cache_mtime)
            now_dt = datetime.datetime.now()
            if (now_dt - cache_dt).total_seconds() < 3600:  # Cache for 1 hour
                logger.info(f"Loading cached transaction history for {user_address}")
                return pd.read_csv(cache_file)
        
        logger.info(f"Fetching transaction history for {user_address}")
        
        # Calculate start block (approximate)
        current_block = self.w3.eth.block_number
        blocks_per_day = 28800  # Approximate blocks per day (3s block time)
        start_block = max(0, current_block - (blocks_per_day * days_back))
        
        # Get normal transactions
        txs = await self._fetch_transactions(user_address, start_block)
        
        # Get internal transactions if requested
        if include_internal:
            internal_txs = await self._fetch_internal_transactions(user_address, start_block)
            txs.extend(internal_txs)
        
        # Convert to DataFrame
        if txs:
            df = pd.DataFrame(txs)
            
            # Add derived columns
            df['timestamp'] = pd.to_datetime(df['timeStamp'], unit='s')
            df['value_ether'] = df['value'].astype(float) / 1e18
            df['is_outgoing'] = df['from'].str.lower() == user_address.lower()
            
            # Sort by timestamp
            df = df.sort_values('timestamp', ascending=False)
            
            # Cache the result
            df.to_csv(cache_file, index=False)
            
            return df
        else:
            return pd.DataFrame()
    
    async def fetch_lending_activities(
        self, 
        user_address: str,
        days_back: int = 365
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch lending-related activities for a user
        
        Args:
            user_address: The address to fetch activities for
            days_back: Number of days to look back in history
            
        Returns:
            Dictionary of DataFrames containing deposit, borrow, repay, and withdraw events
        """
        user_address = Web3.to_checksum_address(user_address)
        cache_file = f"{self.cache_dir}/lending_activities_{user_address}_{days_back}.pkl"
        
        # Check if cached data exists and is recent
        if os.path.exists(cache_file):
            cache_mtime = os.path.getmtime(cache_file)
            cache_dt = datetime.datetime.fromtimestamp(cache_mtime)
            now_dt = datetime.datetime.now()
            if (now_dt - cache_dt).total_seconds() < 3600:  # Cache for 1 hour
                logger.info(f"Loading cached lending activities for {user_address}")
                return pd.read_pickle(cache_file)
        
        logger.info(f"Fetching lending activities for {user_address}")
        
        # Calculate start block (approximate)
        current_block = self.w3.eth.block_number
        blocks_per_day = 28800  # Approximate blocks per day (3s block time)
        start_block = max(0, current_block - (blocks_per_day * days_back))
        
        # Define event filters
        from_block = start_block
        to_block = current_block
        
        # Get deposit events
        deposit_filter = self.lending_pool.events.Deposit.create_filter(
            fromBlock=from_block,
            toBlock=to_block,
            argument_filters={'onBehalfOf': user_address}
        )
        deposit_events = await self._fetch_events(deposit_filter)
        
        # Get borrow events
        borrow_filter = self.lending_pool.events.Borrow.create_filter(
            fromBlock=from_block,
            toBlock=to_block,
            argument_filters={'onBehalfOf': user_address}
        )
        borrow_events = await self._fetch_events(borrow_filter)
        
        # Get repay events
        repay_filter = self.lending_pool.events.Repay.create_filter(
            fromBlock=from_block,
            toBlock=to_block,
            argument_filters={'user': user_address}
        )
        repay_events = await self._fetch_events(repay_filter)
        
        # Get withdraw events
        withdraw_filter = self.lending_pool.events.Withdraw.create_filter(
            fromBlock=from_block,
            toBlock=to_block,
            argument_filters={'user': user_address}
        )
        withdraw_events = await self._fetch_events(withdraw_filter)
        
        # Process events into DataFrames
        activities = {
            'deposits': self._process_events_to_df(deposit_events),
            'borrows': self._process_events_to_df(borrow_events),
            'repays': self._process_events_to_df(repay_events),
            'withdraws': self._process_events_to_df(withdraw_events)
        }
        
        # Cache the result
        pd.to_pickle(activities, cache_file)
        
        return activities
    
    async def fetch_wallet_analysis(self, user_address: str) -> Dict[str, Any]:
        """
        Analyze wallet characteristics
        
        Args:
            user_address: The address to analyze
            
        Returns:
            Dictionary containing wallet analysis results
        """
        user_address = Web3.to_checksum_address(user_address)
        cache_file = f"{self.cache_dir}/wallet_analysis_{user_address}.json"
        
        # Check if cached data exists and is recent
        if os.path.exists(cache_file):
            cache_mtime = os.path.getmtime(cache_file)
            cache_dt = datetime.datetime.fromtimestamp(cache_mtime)
            now_dt = datetime.datetime.now()
            if (now_dt - cache_dt).total_seconds() < 3600:  # Cache for 1 hour
                logger.info(f"Loading cached wallet analysis for {user_address}")
                with open(cache_file, 'r') as f:
                    return json.load(f)
        
        logger.info(f"Analyzing wallet for {user_address}")
        
        # Get account balance
        balance = self.w3.eth.get_balance(user_address)
        balance_ether = balance / 1e18
        
        # Get transaction count
        tx_count = self.w3.eth.get_transaction_count(user_address)
        
        # Get code at address to determine if it's a contract
        code = self.w3.eth.get_code(user_address)
        is_contract = len(code) > 0
        
        # Get first transaction (account age)
        txs_df = await self.fetch_user_transaction_history(user_address, days_back=1000)
        if not txs_df.empty:
            first_tx = txs_df.iloc[-1]
            account_age_days = (datetime.datetime.now() - pd.to_datetime(first_tx['timestamp'])).days
            
            # Calculate transaction frequency
            if account_age_days > 0:
                tx_frequency = tx_count / account_age_days
            else:
                tx_frequency = 0
                
            # Calculate average transaction value
            avg_tx_value = txs_df['value_ether'].mean()
            
            # Calculate balance volatility (standard deviation of daily balances)
            # Group by day and calculate closing balance
            if len(txs_df) > 10:  # Only if we have enough data
                txs_df['date'] = txs_df['timestamp'].dt.date
                daily_balances = []
                running_balance = balance_ether
                
                # Work backwards from current balance
                for date, group in txs_df.groupby('date', sort=False):
                    # Adjust balance by transactions
                    for _, tx in group.iterrows():
                        if tx['is_outgoing']:
                            running_balance += tx['value_ether']  # Add back outgoing value
                        else:
                            running_balance -= tx['value_ether']  # Subtract incoming value
                    
                    daily_balances.append({'date': date, 'balance': running_balance})
                
                daily_balances_df = pd.DataFrame(daily_balances)
                balance_volatility = daily_balances_df['balance'].std() / daily_balances_df['balance'].mean() if daily_balances_df['balance'].mean() > 0 else 0
            else:
                balance_volatility = 0
        else:
            account_age_days = 0
            tx_frequency = 0
            avg_tx_value = 0
            balance_volatility = 0
        
        # Collate results
        analysis = {
            'address': user_address,
            'balance': balance_ether,
            'transaction_count': tx_count,
            'is_contract': is_contract,
            'account_age_days': account_age_days,
            'transaction_frequency': tx_frequency,
            'average_transaction_value': avg_tx_value,
            'balance_volatility': balance_volatility,
            'analysis_timestamp': datetime.datetime.now().isoformat()
        }
        
        # Cache the result
        with open(cache_file, 'w') as f:
            json.dump(analysis, f)
        
        return analysis
    
    async def fetch_cross_chain_activity(self, user_address: str) -> Dict[str, Any]:
        """
        Fetch cross-chain activity for a user using the bridge contract
        
        Args:
            user_address: The address to fetch activity for
            
        Returns:
            Dictionary containing cross-chain activity metrics
        """
        # For brevity, we'll simulate this part since it would involve integrating
        # with the cross-chain bridge contract and other networks
        
        # In a real implementation, this would:
        # 1. Query the bridge contract for messages sent by this user
        # 2. Look up corresponding transactions on other chains
        # 3. Analyze cross-chain transaction patterns
        
        return {
            'has_cross_chain_activity': True,
            'cross_chain_networks': ['Ethereum', 'Polygon'],
            'total_cross_chain_transactions': 15,
            'total_cross_chain_volume': 2500.0,
            'cross_chain_frequency': 'Medium',  # Low, Medium, High
            'first_cross_chain_activity': '2023-01-15',
            'last_cross_chain_activity': '2023-04-02'
        }
    
    async def fetch_user_feature_vector(self, user_address: str) -> Dict[str, float]:
        """
        Compile a complete feature vector for a user
        
        Args:
            user_address: The address to analyze
            
        Returns:
            Dictionary containing all features for the risk model
        """
        logger.info(f"Generating feature vector for {user_address}")
        
        # Run all data fetching functions in parallel
        wallet_analysis_task = asyncio.create_task(self.fetch_wallet_analysis(user_address))
        tx_history_task = asyncio.create_task(self.fetch_user_transaction_history(user_address))
        lending_activities_task = asyncio.create_task(self.fetch_lending_activities(user_address))
        cross_chain_activity_task = asyncio.create_task(self.fetch_cross_chain_activity(user_address))
        
        # Wait for all tasks to complete
        wallet_analysis = await wallet_analysis_task
        tx_history = await tx_history_task
        lending_activities = await lending_activities_task
        cross_chain_activity = await cross_chain_activity_task
        
        # Get LendingPool contract data
        user_config = await self._fetch_user_lending_configuration(user_address)
        
        # Compile wallet activity features
        wallet_features = {
            'wallet_age_days': wallet_analysis['account_age_days'],
            'transaction_count': wallet_analysis['transaction_count'],
            'avg_transaction_value': wallet_analysis['average_transaction_value'],
            'transaction_frequency': wallet_analysis['transaction_frequency'],
            'balance': wallet_analysis['balance'],
            'balance_volatility': wallet_analysis['balance_volatility'],
            'is_contract': 1 if wallet_analysis['is_contract'] else 0
        }
        
        # Compile lending activity features
        lending_features = {}
        
        # Deposits
        deposits_df = lending_activities['deposits']
        if not deposits_df.empty:
            lending_features.update({
                'deposit_count': len(deposits_df),
                'total_deposit_value': deposits_df['amount'].sum(),
                'avg_deposit_value': deposits_df['amount'].mean(),
                'last_deposit_days': (datetime.datetime.now() - deposits_df['timestamp'].max()).days,
                'deposit_frequency': len(deposits_df) / max(1, wallet_analysis['account_age_days'])
            })
        else:
            lending_features.update({
                'deposit_count': 0,
                'total_deposit_value': 0,
                'avg_deposit_value': 0,
                'last_deposit_days': 999,
                'deposit_frequency': 0
            })
        
        # Borrows
        borrows_df = lending_activities['borrows']
        if not borrows_df.empty:
            lending_features.update({
                'borrow_count': len(borrows_df),
                'total_borrow_value': borrows_df['amount'].sum(),
                'avg_borrow_value': borrows_df['amount'].mean(),
                'last_borrow_days': (datetime.datetime.now() - borrows_df['timestamp'].max()).days,
                'borrow_frequency': len(borrows_df) / max(1, wallet_analysis['account_age_days'])
            })
        else:
            lending_features.update({
                'borrow_count': 0,
                'total_borrow_value': 0,
                'avg_borrow_value': 0,
                'last_borrow_days': 999,
                'borrow_frequency': 0
            })
        
        # Repays
        repays_df = lending_activities['repays']
        if not repays_df.empty:
            lending_features.update({
                'repay_count': len(repays_df),
                'total_repay_value': repays_df['amount'].sum(),
                'avg_repay_value': repays_df['amount'].mean(),
                'last_repay_days': (datetime.datetime.now() - repays_df['timestamp'].max()).days,
                'repay_frequency': len(repays_df) / max(1, wallet_analysis['account_age_days'])
            })
        else:
            lending_features.update({
                'repay_count': 0,
                'total_repay_value': 0,
                'avg_repay_value': 0,
                'last_repay_days': 999,
                'repay_frequency': 0
            })
        
        # Withdraws
        withdraws_df = lending_activities['withdraws']
        if not withdraws_df.empty:
            lending_features.update({
                'withdraw_count': len(withdraws_df),
                'total_withdraw_value': withdraws_df['amount'].sum(),
                'avg_withdraw_value': withdraws_df['amount'].mean(),
                'last_withdraw_days': (datetime.datetime.now() - withdraws_df['timestamp'].max()).days,
                'withdraw_frequency': len(withdraws_df) / max(1, wallet_analysis['account_age_days'])
            })
        else:
            lending_features.update({
                'withdraw_count': 0,
                'total_withdraw_value': 0,
                'avg_withdraw_value': 0,
                'last_withdraw_days': 999,
                'withdraw_frequency': 0
            })
        
        # Calculate repayment ratio
        if lending_features['total_borrow_value'] > 0:
            lending_features['repayment_ratio'] = min(1.0, lending_features['total_repay_value'] / lending_features['total_borrow_value'])
        else:
            lending_features['repayment_ratio'] = 1.0  # Perfect score if no borrows
            
        # Add user configuration data
        if user_config:
            lending_features.update({
                'current_risk_score': user_config.get('riskScore', 50),
                'active_borrows': 1 if user_config.get('borrowing', False) else 0,
                'using_as_collateral': 1 if user_config.get('usingAsCollateral', False) else 0
            })
        else:
            lending_features.update({
                'current_risk_score': 50,  # Default
                'active_borrows': 0,
                'using_as_collateral': 0
            })
        
        # Add cross-chain features
        cross_chain_features = {
            'has_cross_chain_activity': 1 if cross_chain_activity['has_cross_chain_activity'] else 0,
            'cross_chain_networks_count': len(cross_chain_activity['cross_chain_networks']),
            'cross_chain_tx_count': cross_chain_activity['total_cross_chain_transactions'],
            'cross_chain_volume': cross_chain_activity['total_cross_chain_volume'],
            'cross_chain_frequency': {
                'Low': 0.33,
                'Medium': 0.66,
                'High': 1.0
            }.get(cross_chain_activity['cross_chain_frequency'], 0)
        }
        
        # Combine all features
        features = {**wallet_features, **lending_features, **cross_chain_features}
        
        return features
    
    async def _fetch_transactions(self, address: str, start_block: int) -> List[Dict]:
        """Fetch normal transactions for an address"""
        url = f"{self.evm_rpc_url}/api"
        params = {
            'module': 'account',
            'action': 'txlist',
            'address': address,
            'startblock': start_block,
            'endblock': 99999999,
            'sort': 'desc'
        }
        
        if self.api_key:
            params['apikey'] = self.api_key
            
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data['status'] == '1':
                        return data['result']
        
        return []
    
    async def _fetch_internal_transactions(self, address: str, start_block: int) -> List[Dict]:
        """Fetch internal transactions for an address"""
        url = f"{self.evm_rpc_url}/api"
        params = {
            'module': 'account',
            'action': 'txlistinternal',
            'address': address,
            'startblock': start_block,
            'endblock': 99999999,
            'sort': 'desc'
        }
        
        if self.api_key:
            params['apikey'] = self.api_key
            
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data['status'] == '1':
                        return data['result']
        
        return []
    
    async def _fetch_events(self, event_filter) -> List[Dict]:
        """Fetch events matching a filter"""
        try:
            events = event_filter.get_all_entries()
            return events
        except Exception as e:
            logger.error(f"Error fetching events: {e}")
            return []
    
    def _process_events_to_df(self, events: List[Dict]) -> pd.DataFrame:
        """Convert event logs to a DataFrame"""
        if not events:
            return pd.DataFrame()
        
        processed_events = []
        
        for event in events:
            # Extract event args
            args = dict(event['args'])
            
            # Extract common fields
            event_dict = {
                'transaction_hash': event['transactionHash'].hex(),
                'block_number': event['blockNumber'],
                'log_index': event['logIndex'],
                'event_name': event['event']
            }
            
            # Add timestamp (need to get block)
            try:
                block = self.w3.eth.get_block(event['blockNumber'])
                event_dict['timestamp'] = datetime.datetime.fromtimestamp(block['timestamp'])
            except Exception as e:
                logger.warning(f"Could not get block timestamp: {e}")
                event_dict['timestamp'] = None
            
            # Add all args
            for key, value in args.items():
                # Convert bytes to hex
                if isinstance(value, bytes):
                    value = value.hex()
                # Convert addresses to checksummed
                elif isinstance(value, str) and value.startswith('0x') and len(value) == 42:
                    value = Web3.to_checksum_address(value)
                
                event_dict[key] = value
            
            processed_events.append(event_dict)
        
        return pd.DataFrame(processed_events)
    
    async def _fetch_user_lending_configuration(self, user_address: str) -> Dict:
        """Fetch user configuration from the lending pool"""
        try:
            config = self.lending_pool.functions.getUserConfiguration(user_address).call()
            
            # Format will depend on the actual contract, this is just an example
            return {
                'riskScore': config[0] if isinstance(config, tuple) and len(config) > 0 else 50,
                'borrowing': config[1] if isinstance(config, tuple) and len(config) > 1 else False,
                'usingAsCollateral': config[2] if isinstance(config, tuple) and len(config) > 2 else False
            }
        except Exception as e:
            logger.error(f"Error fetching user configuration: {e}")
            return None
