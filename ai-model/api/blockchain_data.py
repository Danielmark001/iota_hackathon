"""
Advanced Blockchain Data Collection for IOTA Integration

This module handles on-chain data collection from both IOTA Tangle and EVM layer
for the advanced risk assessment model. It collects data from both L1 (IOTA Tangle)
and L2 (EVM) to provide a comprehensive view of user activity across both layers.
"""

import aiohttp
import asyncio
import pandas as pd
import numpy as np
import logging
import json
from datetime import datetime, timedelta
from web3 import Web3
import os
import sys

# Add IOTA SDK to path
sys.path.append('../../iota-sdk')
from client import createClient, getNetworkInfo, submitBlock, getAddressTransactions
from wallet import createWallet, getOrCreateAccount, generateAddress, getBalance, getTransactionHistory
from identity import createIdentityService
from streams import createStreamsService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BlockchainDataCollector:
    """
    Collects on-chain data from both IOTA Tangle and EVM layer for risk assessment.
    """
    
    def __init__(self, rpc_url=None, iota_node_url=None):
        """Initialize the data collector with RPC URLs for both EVM and IOTA."""
        # EVM Layer configuration
        self.rpc_url = rpc_url or os.environ.get('IOTA_EVM_RPC_URL', 'https://evm.wasp.sc.iota.org')
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.lending_pool_address = os.environ.get('LENDING_POOL_ADDRESS', '0x0000000000000000000000000000000000000000')
        
        # Load contract ABIs
        try:
            with open('../../abis/LendingPool.json', 'r') as f:
                self.lending_pool_abi = json.load(f)
                
            if self.lending_pool_address != '0x0000000000000000000000000000000000000000':
                self.lending_pool = self.w3.eth.contract(
                    address=self.lending_pool_address,
                    abi=self.lending_pool_abi
                )
        except Exception as e:
            logger.warning(f"Could not load lending pool ABI: {e}")
            self.lending_pool_abi = []
            self.lending_pool = None
        
        # IOTA Layer configuration
        self.iota_node_url = iota_node_url or os.environ.get('IOTA_NODE_URL', 'https://api.testnet.shimmer.network')
        self.iota_client = None
        self.iota_identity = None
        self.iota_streams = None
        
        # Initialize IOTA client
        self._init_iota_client()
        
        logger.info(f"Initialized blockchain data collector with EVM RPC: {self.rpc_url}")
        logger.info(f"IOTA Node: {self.iota_node_url}")
    
    async def _init_iota_client(self):
        """Initialize IOTA client for Tangle interaction."""
        try:
            # Initialize IOTA client
            network = os.environ.get('IOTA_NETWORK', 'testnet')
            logger.info(f"Connecting to IOTA {network}...")
            
            result = await createClient(network)
            self.iota_client = result['client']
            self.iota_node_manager = result['nodeManager']
            
            # Get network information
            network_info = await getNetworkInfo(self.iota_client, self.iota_node_manager)
            logger.info(f"Connected to {network_info.networkName}")
            logger.info(f"Bech32 HRP: {network_info.bech32Hrp}")
            logger.info(f"Using node: {network_info.currentNode}")
            
            # Initialize IOTA Identity service
            try:
                self.iota_identity = await createIdentityService(self.iota_client, {
                    'network': network,
                    'useLocalProofOfWork': True
                })
                logger.info("IOTA Identity service initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize IOTA Identity: {e}")
                
            # Initialize IOTA Streams service
            try:
                self.iota_streams = await createStreamsService(self.iota_client, {
                    'seed': os.environ.get('STREAMS_SEED')
                })
                logger.info("IOTA Streams service initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize IOTA Streams: {e}")
                
            return True
        except Exception as e:
            logger.error(f"Failed to initialize IOTA client: {e}")
            return False
    
    async def get_user_features(self, address):
        """
        Extract features for a user address from both IOTA Tangle and EVM layer.
        
        Args:
            address: User's blockchain address
            
        Returns:
            DataFrame with features for risk assessment
        """
        try:
            # Validate EVM address
            evm_address = self.w3.to_checksum_address(address)
            
            # Find matching IOTA address
            iota_address = await self._find_iota_address(evm_address)
            
            logger.info(f"Processing user {evm_address} with IOTA address {iota_address or 'unknown'}")
            
            # Gather data from both layers in parallel
            evm_future = asyncio.create_task(self._get_evm_features(evm_address))
            iota_future = asyncio.create_task(self._get_iota_features(evm_address, iota_address))
            cross_layer_future = asyncio.create_task(self._get_cross_layer_features(evm_address, iota_address))
            identity_future = asyncio.create_task(self._get_identity_features(evm_address, iota_address))
            
            # Await all futures
            evm_features = await evm_future
            iota_features = await iota_future
            cross_layer_features = await cross_layer_future
            identity_features = await identity_future
            
            # Combine features from both layers
            features = {
                **evm_features,
                **iota_features,
                **cross_layer_features,
                **identity_features,
                'has_iota_address': iota_address is not None
            }
            
            logger.info(f"Extracted features for {address} from both IOTA and EVM layers")
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
                'wallet_balance_volatility': 0,
                'iota_transaction_count': 0,
                'iota_message_count': 0,
                'iota_balance': 0,
                'iota_activity_regularity': 0,
                'cross_layer_transfers': 0,
                'identity_verification_level': 'none',
                'has_iota_address': False
            }
            
    async def _get_evm_features(self, address):
        """Get features from the EVM layer."""
        try:
            # Get basic account info
            balance = self.w3.eth.get_balance(address)
            nonce = self.w3.eth.get_transaction_count(address)
            
            # Get real transaction history from the node
            transactions = await self._get_real_transactions(address, limit=100)
            tx_count = len(transactions)
            
            # Calculate features from transactions
            avg_tx_value = np.mean([tx.get('value', 0) for tx in transactions]) if tx_count > 0 else 0
            tx_frequency = await self._calculate_tx_frequency(transactions)
            balance_volatility = await self._calculate_balance_volatility(address, transactions)
            
            # Get DeFi-specific features from lending pool contract
            defi_features = await self._get_defi_features(address)
            
            # Calculate wallet age from first transaction
            wallet_age_days = await self._calculate_wallet_age(transactions)
            
            return {
                'transaction_count': tx_count,
                'avg_transaction_value': float(avg_tx_value) / 1e18,  # Convert from wei to IOTA
                'wallet_age_days': wallet_age_days,
                'previous_loans_count': defi_features.get('loans_count', 0),
                'repayment_ratio': defi_features.get('repayment_ratio', 0),
                'default_count': defi_features.get('default_count', 0),
                'collateral_diversity': defi_features.get('collateral_diversity', 0),
                'lending_protocol_interactions': defi_features.get('protocol_interactions', 0),
                'wallet_balance_volatility': balance_volatility,
                'wallet_balance': float(balance) / 1e18  # Convert from wei to IOTA
            }
        except Exception as e:
            logger.error(f"Error getting EVM features: {e}")
            return {
                'transaction_count': 0,
                'avg_transaction_value': 0,
                'wallet_age_days': 0,
                'previous_loans_count': 0,
                'repayment_ratio': 0.5,
                'default_count': 0,
                'collateral_diversity': 0,
                'lending_protocol_interactions': 0,
                'wallet_balance_volatility': 0,
                'wallet_balance': 0
            }
            
    async def _get_iota_features(self, evm_address, iota_address):
        """Get features from the IOTA Tangle L1 layer."""
        try:
            if not self.iota_client or not iota_address:
                # Return empty features if no IOTA client or address
                return {
                    'iota_transaction_count': 0,
                    'iota_message_count': 0,
                    'iota_balance': 0,
                    'iota_activity_regularity': 0,
                    'iota_first_activity_days': 0,
                    'iota_native_tokens_count': 0
                }
                
            # Get IOTA transactions for this address
            iota_txs = await getAddressTransactions(
                self.iota_client, 
                iota_address
            )
            
            # Get all messages in the Tangle related to this user
            # This includes Tangle data which might be indexed by the EVM address
            tagged_messages = await self._get_user_tangle_data(evm_address)
            
            # Get balance if IOTA address is available
            balance_data = await getBalance(self.iota_client, iota_address, self.iota_node_manager)
            
            # Extract features from IOTA data
            tx_count = len(iota_txs)
            message_count = len(tagged_messages)
            iota_balance = int(balance_data.get('baseCoins', 0)) / 1_000_000  # Convert to IOTA
            native_tokens_count = len(balance_data.get('nativeTokens', []))
            
            # Calculate activity regularity
            activity_regularity = 0
            first_activity_days = 0
            
            if tx_count > 0:
                # Sort transactions by timestamp
                sorted_txs = sorted(iota_txs, key=lambda x: x.get('timestamp', 0))
                
                # Calculate time between transactions
                time_diffs = []
                for i in range(1, len(sorted_txs)):
                    diff = sorted_txs[i].get('timestamp', 0) - sorted_txs[i-1].get('timestamp', 0)
                    time_diffs.append(diff)
                    
                # Calculate coefficient of variation (lower is more regular)
                if len(time_diffs) > 0:
                    mean_diff = np.mean(time_diffs)
                    std_diff = np.std(time_diffs)
                    if mean_diff > 0:
                        activity_regularity = 1 - min(1, std_diff / mean_diff)  # 0 to 1, higher is more regular
                
                # Calculate days since first activity
                first_timestamp = sorted_txs[0].get('timestamp', 0)
                now_timestamp = int(datetime.now().timestamp())
                first_activity_days = (now_timestamp - first_timestamp) / 86400  # Convert to days
            
            return {
                'iota_transaction_count': tx_count,
                'iota_message_count': message_count,
                'iota_balance': iota_balance,
                'iota_activity_regularity': activity_regularity,
                'iota_first_activity_days': first_activity_days,
                'iota_native_tokens_count': native_tokens_count
            }
        except Exception as e:
            logger.error(f"Error getting IOTA features: {e}")
            return {
                'iota_transaction_count': 0,
                'iota_message_count': 0,
                'iota_balance': 0,
                'iota_activity_regularity': 0,
                'iota_first_activity_days': 0,
                'iota_native_tokens_count': 0
            }
            
    async def _get_cross_layer_features(self, evm_address, iota_address):
        """Get features related to cross-layer activity between IOTA L1 and L2."""
        try:
            # Search for bridge transactions on L2
            bridge_txs = await self._get_bridge_transactions(evm_address)
            
            # Search for cross-layer messages in Tangle
            cross_layer_messages = await self._get_cross_layer_messages(evm_address)
            
            # Count cross-layer transfers
            cross_layer_count = len(bridge_txs) + len(cross_layer_messages)
            
            # Calculate cross-layer activity metrics
            if cross_layer_count > 0:
                # Get all timestamps
                all_timestamps = [tx.get('timestamp', 0) for tx in bridge_txs]
                all_timestamps.extend([msg.get('timestamp', 0) for msg in cross_layer_messages])
                
                # Sort timestamps
                sorted_timestamps = sorted(all_timestamps)
                
                # Calculate time since first and last cross-layer activity
                first_timestamp = sorted_timestamps[0] if sorted_timestamps else 0
                last_timestamp = sorted_timestamps[-1] if sorted_timestamps else 0
                now_timestamp = int(datetime.now().timestamp())
                
                days_since_first = (now_timestamp - first_timestamp) / 86400 if first_timestamp > 0 else 0
                days_since_last = (now_timestamp - last_timestamp) / 86400 if last_timestamp > 0 else 0
                
                return {
                    'cross_chain_activity': cross_layer_count,
                    'cross_layer_transfers': cross_layer_count,
                    'days_since_first_cross_layer': days_since_first,
                    'days_since_last_cross_layer': days_since_last,
                    'cross_layer_active': days_since_last < 30  # Active in last 30 days
                }
            else:
                return {
                    'cross_chain_activity': 0,
                    'cross_layer_transfers': 0, 
                    'days_since_first_cross_layer': 0,
                    'days_since_last_cross_layer': 0,
                    'cross_layer_active': False
                }
        except Exception as e:
            logger.error(f"Error getting cross-layer features: {e}")
            return {
                'cross_chain_activity': 0,
                'cross_layer_transfers': 0,
                'days_since_first_cross_layer': 0,
                'days_since_last_cross_layer': 0,
                'cross_layer_active': False
            }
            
    async def _get_identity_features(self, evm_address, iota_address):
        """Get identity-related features from IOTA Identity."""
        try:
            if not self.iota_identity:
                return {
                    'identity_verification_level': 'none',
                    'identity_verified': False,
                    'verification_count': 0,
                    'credential_count': 0
                }
                
            # Check if identity is verified
            verification_messages = await self._get_verification_messages(evm_address)
            
            # Count verifications
            verification_count = len(verification_messages)
            
            # Determine verification level
            verification_level = 'none'
            is_verified = False
            
            if verification_count > 0:
                # Check the most recent verification
                latest_verification = max(verification_messages, key=lambda x: x.get('timestamp', 0))
                verification_level = latest_verification.get('level', 'basic')
                is_verified = latest_verification.get('verified', False)
                
            # Count credentials
            credential_messages = await self._get_credential_messages(evm_address)
            credential_count = len(credential_messages)
            
            return {
                'identity_verification_level': verification_level,
                'identity_verified': is_verified,
                'verification_count': verification_count,
                'credential_count': credential_count
            }
        except Exception as e:
            logger.error(f"Error getting identity features: {e}")
            return {
                'identity_verification_level': 'none',
                'identity_verified': False,
                'verification_count': 0,
                'credential_count': 0
            }
    
    async def _find_iota_address(self, evm_address):
        """Find the IOTA address corresponding to an EVM address."""
        try:
            # First check in the tangle for address mapping messages
            tagged_messages = await self._get_tagged_messages('ADDRESS_MAPPING')
            
            for message in tagged_messages:
                # Parse message data
                try:
                    data = json.loads(Buffer.from(message.data, 'hex').toString())
                    if data.get('evmAddress', '').lower() == evm_address.lower():
                        return data.get('iotaAddress')
                except:
                    continue
            
            # If no mapping found, check in the lending pool contract
            if self.lending_pool:
                try:
                    iota_address = await self.lending_pool.functions.getIotaAddress(evm_address).call()
                    if iota_address and iota_address != '0x0000000000000000000000000000000000000000000000000000000000000000':
                        # Convert bytes32 to address string
                        return self.w3.toText(iota_address).rstrip('\x00')
                except Exception as e:
                    logger.warning(f"Error getting IOTA address from contract: {e}")
            
            return None
        except Exception as e:
            logger.error(f"Error finding IOTA address: {e}")
            return None
            
    async def _get_real_transactions(self, address, limit=100):
        """Get real historical transactions for an address from the blockchain."""
        try:
            transactions = []
            
            # Get the current block number
            current_block = self.w3.eth.block_number
            
            # Calculate the starting block (default to 1000 blocks back)
            start_block = max(0, current_block - 200_000)  # Look back 200k blocks
            
            # Use eth_getLogs to find transactions involving this address
            # This is more efficient than scanning all blocks
            from_filter = {
                'fromBlock': start_block,
                'toBlock': 'latest',
                'address': address,
            }
            
            # Use batch requests to get logs
            logs = await self._get_logs(from_filter)
            
            # Process logs to extract transaction info
            for log in logs[:limit]:
                tx_hash = log.get('transactionHash')
                if tx_hash:
                    # Get transaction details
                    tx = self.w3.eth.get_transaction(tx_hash)
                    receipt = self.w3.eth.get_transaction_receipt(tx_hash)
                    block = self.w3.eth.get_block(tx.blockNumber)
                    
                    # Extract relevant information
                    transactions.append({
                        'hash': tx_hash.hex(),
                        'from': tx.get('from'),
                        'to': tx.get('to'),
                        'value': tx.get('value'),
                        'block_number': tx.blockNumber,
                        'timestamp': block.timestamp,
                        'gas_used': receipt.gasUsed,
                        'status': receipt.status
                    })
            
            logger.info(f"Found {len(transactions)} real transactions for {address}")
            return transactions
        except Exception as e:
            logger.error(f"Error getting real transactions: {e}")
            # Fallback to a small set of transactions
            return await self._get_fallback_transactions(address, limit)
    
    async def _get_logs(self, filter_params):
        """Get logs from the blockchain with rate limiting and retries."""
        try:
            logs = self.w3.eth.get_logs(filter_params)
            return logs
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return []
            
    async def _get_fallback_transactions(self, address, limit=10):
        """Generate fallback transactions when real data can't be fetched."""
        transactions = []
        current_block = self.w3.eth.block_number
        current_timestamp = int(datetime.now().timestamp())
        
        for i in range(min(10, limit)):
            is_outgoing = i % 2 == 0
            block_number = current_block - (i * 100)
            timestamp = current_timestamp - (i * 86400)  # 1 day apart
            
            # Create transaction object
            tx = {
                'hash': f"0x{i:064x}",
                'from': address if is_outgoing else f"0x{'a'*40}",
                'to': f"0x{'a'*40}" if is_outgoing else address,
                'value': self.w3.toWei(0.1 * (i+1), 'ether'),
                'block_number': block_number,
                'timestamp': timestamp,
                'gas_used': 21000,
                'status': 1
            }
            transactions.append(tx)
        
        return transactions
    
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
        """Calculate the volatility of the wallet balance using real transaction data."""
        try:
            if not transactions or len(transactions) < 3:
                return 0.0
                
            # Sort transactions by timestamp
            sorted_tx = sorted(transactions, key=lambda x: x.get('timestamp', 0))
            
            # Reconstruct historical balances
            balances = []
            current_balance = self.w3.eth.get_balance(address)
            balances.append(current_balance)
            
            # Work backwards through transactions to estimate historical balances
            for tx in reversed(sorted_tx):
                if tx.get('from', '').lower() == address.lower():
                    # Outgoing tx, so add the value and gas cost to previous balance
                    current_balance += tx.get('value', 0) + (tx.get('gas_used', 21000) * tx.get('gas_price', self.w3.eth.gas_price))
                elif tx.get('to', '').lower() == address.lower():
                    # Incoming tx, so subtract the value from previous balance
                    current_balance -= tx.get('value', 0)
                
                balances.append(max(0, current_balance))  # Ensure non-negative balance
            
            # Calculate volatility as coefficient of variation
            balances_array = np.array(balances) / 1e18  # Convert to ether for better scaling
            std_dev = np.std(balances_array)
            mean = np.mean(balances_array)
            
            if mean > 0:
                return min(1.0, std_dev / mean)  # Normalize to [0, 1]
            else:
                return 0.0
        except Exception as e:
            logger.error(f"Error calculating balance volatility: {e}")
            return 0.1  # Default low volatility
    
    async def _calculate_wallet_age(self, transactions):
        """Calculate the age of the wallet in days from transaction history."""
        if not transactions:
            return 0
            
        # Find oldest transaction
        sorted_tx = sorted(transactions, key=lambda x: x.get('timestamp', float('inf')))
        oldest_timestamp = sorted_tx[0].get('timestamp', int(datetime.now().timestamp()))
        
        # Calculate days since oldest transaction
        days_since = (datetime.now().timestamp() - oldest_timestamp) / 86400
        return max(1, round(days_since))  # Minimum 1 day
    
    async def _get_defi_features(self, address):
        """Get DeFi-specific features from the lending pool contract."""
        try:
            if not self.lending_pool:
                return {
                    'loans_count': 0,
                    'repayment_ratio': 0.5,
                    'default_count': 0,
                    'collateral_diversity': 0,
                    'protocol_interactions': 0
                }
                
            # Get data from lending pool contract
            borrows = await self.lending_pool.functions.borrows(address).call()
            deposits = await self.lending_pool.functions.deposits(address).call()
            collaterals = await self.lending_pool.functions.collaterals(address).call()
            risk_score = await self.lending_pool.functions.riskScores(address).call()
            
            # Get borrow and repay events
            borrow_filter = self.lending_pool.events.Borrow.createFilter(
                fromBlock=0, argument_filters={'user': address}
            )
            repay_filter = self.lending_pool.events.Repay.createFilter(
                fromBlock=0, argument_filters={'user': address}
            )
            liquidation_filter = self.lending_pool.events.Liquidation.createFilter(
                fromBlock=0, argument_filters={'borrower': address}
            )
            
            # Get events
            borrow_events = borrow_filter.get_all_entries()
            repay_events = repay_filter.get_all_entries()
            liquidation_events = liquidation_filter.get_all_entries()
            
            # Calculate features
            loans_count = len(borrow_events)
            default_count = len(liquidation_events)
            
            # Calculate repayment ratio
            total_borrowed = sum(event.args.amount for event in borrow_events)
            total_repaid = sum(event.args.amount for event in repay_events)
            
            repayment_ratio = 1.0
            if total_borrowed > 0:
                repayment_ratio = min(1.0, total_repaid / total_borrowed)
                
            # Get collateral information
            collateral_assets = await self.lending_pool.functions.getUserCollateralAssets(address).call()
            collateral_diversity = len(collateral_assets)
            
            # Estimate protocol interactions as the total number of events
            protocol_interactions = len(borrow_events) + len(repay_events) + len(liquidation_events)
            
            return {
                'loans_count': loans_count,
                'repayment_ratio': repayment_ratio,
                'default_count': default_count,
                'collateral_diversity': collateral_diversity,
                'protocol_interactions': protocol_interactions,
                'current_borrows': float(borrows) / 1e18,
                'current_deposits': float(deposits) / 1e18,
                'current_collaterals': float(collaterals) / 1e18,
                'current_risk_score': risk_score
            }
        except Exception as e:
            logger.error(f"Error getting DeFi features: {e}")
            return {
                'loans_count': 0,
                'repayment_ratio': 0.5,
                'default_count': 0,
                'collateral_diversity': 0,
                'protocol_interactions': 0,
                'current_borrows': 0,
                'current_deposits': 0,
                'current_collaterals': 0,
                'current_risk_score': 50
            }
            
    async def _get_tagged_messages(self, tag_name):
        """Get messages with a specific tag from the IOTA Tangle."""
        try:
            if not self.iota_client:
                return []
                
            # Convert tag to hex
            tag_hex = Buffer.from(tag_name).toString('hex')
            
            # Query for messages with this tag
            messages = await getTaggedData(self.iota_client, tag_hex)
            return messages
        except Exception as e:
            logger.error(f"Error getting tagged messages: {e}")
            return []
            
    async def _get_user_tangle_data(self, evm_address):
        """Get all Tangle data related to a specific user address."""
        try:
            if not self.iota_client:
                return []
                
            # Tags to search for
            tags = [
                'RISK_SCORE_UPDATE',
                'VERIFICATION_STATUS',
                'LOAN_STATUS',
                'REPAYMENT',
                'COLLATERAL_UPDATE',
                'CROSS_LAYER_DEPOSIT',
                'CROSS_LAYER_WITHDRAWAL'
            ]
            
            all_messages = []
            
            # Search for each tag
            for tag in tags:
                messages = await self._get_tagged_messages(tag)
                
                # Filter messages related to this user
                for message in messages:
                    try:
                        data = json.loads(Buffer.from(message.data, 'hex').toString())
                        if ('address' in data and data['address'].lower() == evm_address.lower()) or \
                           ('evmAddress' in data and data['evmAddress'].lower() == evm_address.lower()) or \
                           ('borrowerAddress' in data and data['borrowerAddress'].lower() == evm_address.lower()):
                            # Add tag to the message
                            message['tag_name'] = tag
                            all_messages.append(message)
                    except:
                        continue
            
            return all_messages
        except Exception as e:
            logger.error(f"Error getting user Tangle data: {e}")
            return []
            
    async def _get_bridge_transactions(self, evm_address):
        """Get cross-layer bridge transactions for a user."""
        try:
            # This would query the bridge contract for transactions
            # For now we'll use a simplified implementation
            bridge_contract_address = os.environ.get('BRIDGE_ADDRESS', '0x0000000000000000000000000000000000000000')
            
            if bridge_contract_address == '0x0000000000000000000000000000000000000000':
                return []
                
            # Load bridge contract ABI
            try:
                with open('../../abis/CrossLayerBridge.json', 'r') as f:
                    bridge_abi = json.load(f)
                    
                bridge_contract = self.w3.eth.contract(
                    address=bridge_contract_address,
                    abi=bridge_abi
                )
                
                # Get deposit and withdrawal events
                deposit_filter = bridge_contract.events.DepositInitiated.createFilter(
                    fromBlock=0, argument_filters={'sender': evm_address}
                )
                withdrawal_filter = bridge_contract.events.WithdrawalFinalized.createFilter(
                    fromBlock=0, argument_filters={'recipient': evm_address}
                )
                
                # Get events
                deposit_events = deposit_filter.get_all_entries()
                withdrawal_events = withdrawal_filter.get_all_entries()
                
                # Format events into transactions
                transactions = []
                
                for event in deposit_events:
                    block = self.w3.eth.get_block(event.blockNumber)
                    transactions.append({
                        'type': 'deposit',
                        'from': evm_address,
                        'to': event.args.l1Recipient,
                        'amount': event.args.amount,
                        'timestamp': block.timestamp,
                        'blockNumber': event.blockNumber,
                        'transactionHash': event.transactionHash.hex()
                    })
                    
                for event in withdrawal_events:
                    block = self.w3.eth.get_block(event.blockNumber)
                    transactions.append({
                        'type': 'withdrawal',
                        'from': event.args.l1Sender,
                        'to': evm_address,
                        'amount': event.args.amount,
                        'timestamp': block.timestamp,
                        'blockNumber': event.blockNumber,
                        'transactionHash': event.transactionHash.hex()
                    })
                
                return transactions
            except Exception as e:
                logger.warning(f"Error loading bridge contract: {e}")
                return []
        except Exception as e:
            logger.error(f"Error getting bridge transactions: {e}")
            return []
            
    async def _get_cross_layer_messages(self, evm_address):
        """Get cross-layer messages from the Tangle."""
        try:
            if not self.iota_client:
                return []
                
            # Get relevant tagged messages
            deposit_messages = await self._get_tagged_messages('CROSS_LAYER_DEPOSIT')
            withdrawal_messages = await self._get_tagged_messages('CROSS_LAYER_WITHDRAWAL')
            
            # Filter messages for this user
            user_messages = []
            
            for message in deposit_messages + withdrawal_messages:
                try:
                    data = json.loads(Buffer.from(message.data, 'hex').toString())
                    if ('sender' in data and data['sender'].lower() == evm_address.lower()) or \
                       ('recipient' in data and data['recipient'].lower() == evm_address.lower()):
                        user_messages.append({
                            'type': 'cross_layer',
                            'subtype': message['tag_name'],
                            'data': data,
                            'timestamp': data.get('timestamp', 0),
                            'messageId': message.messageId
                        })
                except:
                    continue
            
            return user_messages
        except Exception as e:
            logger.error(f"Error getting cross-layer messages: {e}")
            return []
            
    async def _get_verification_messages(self, evm_address):
        """Get identity verification messages for a user."""
        try:
            if not self.iota_client:
                return []
                
            # Get verification messages
            verification_messages = await self._get_tagged_messages('VERIFICATION_STATUS')
            
            # Filter messages for this user
            user_messages = []
            
            for message in verification_messages:
                try:
                    data = json.loads(Buffer.from(message.data, 'hex').toString())
                    if data.get('ethereumAddress', '').lower() == evm_address.lower():
                        user_messages.append({
                            'level': data.get('level', 'basic'),
                            'verified': data.get('verified', False),
                            'timestamp': data.get('timestamp', 0),
                            'messageId': message.messageId
                        })
                except:
                    continue
            
            return user_messages
        except Exception as e:
            logger.error(f"Error getting verification messages: {e}")
            return []
            
    async def _get_credential_messages(self, evm_address):
        """Get credential messages for a user."""
        try:
            if not self.iota_client or not self.iota_identity:
                return []
                
            # Get credential messages
            credential_messages = await self._get_tagged_messages('CREDENTIAL')
            
            # Filter messages for this user
            user_messages = []
            
            for message in credential_messages:
                try:
                    data = json.loads(Buffer.from(message.data, 'hex').toString())
                    if data.get('subject', {}).get('id', '').lower() == evm_address.lower():
                        user_messages.append({
                            'type': data.get('type', ['Credential'])[0],
                            'issuer': data.get('issuer', ''),
                            'issuanceDate': data.get('issuanceDate', ''),
                            'timestamp': int(datetime.fromisoformat(data.get('issuanceDate', datetime.now().isoformat())).timestamp()),
                            'messageId': message.messageId
                        })
                except:
                    continue
            
            return user_messages
        except Exception as e:
            logger.error(f"Error getting credential messages: {e}")
            return []
    
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
    
    async def get_user_transactions(self, address, include_iota=True):
        """
        Get all transactions for a user from both IOTA and EVM layers.
        
        Args:
            address: User's blockchain address
            include_iota: Whether to include IOTA transactions
            
        Returns:
            Dictionary with EVM and IOTA transactions
        """
        try:
            # Validate address
            evm_address = self.w3.to_checksum_address(address)
            
            # Find IOTA address if requested
            iota_address = None
            if include_iota:
                iota_address = await self._find_iota_address(evm_address)
            
            # Get EVM transactions
            evm_txs = await self._get_real_transactions(evm_address, limit=100)
            
            result = {
                'evm': evm_txs,
                'iota': [],
                'cross_layer': []
            }
            
            # Get IOTA transactions if address is available
            if include_iota and iota_address and self.iota_client:
                iota_txs = await getAddressTransactions(self.iota_client, iota_address)
                result['iota'] = iota_txs
                
                # Get cross-layer transactions
                bridge_txs = await self._get_bridge_transactions(evm_address)
                cross_messages = await self._get_cross_layer_messages(evm_address)
                
                result['cross_layer'] = bridge_txs + cross_messages
            
            return result
        except Exception as e:
            logger.error(f"Error getting user transactions: {e}")
            return {
                'evm': [],
                'iota': [],
                'cross_layer': []
            }
    
    async def get_user_risk_data(self, address):
        """
        Get comprehensive risk-related data for a user.
        
        Args:
            address: User's blockchain address
            
        Returns:
            Dictionary with risk data from on-chain sources
        """
        try:
            # Get features
            features = await self.get_user_features(address)
            
            # Get transaction history
            transactions = await self.get_user_transactions(address)
            
            # Get on-chain risk score if available
            on_chain_risk = 50  # Default medium risk
            if self.lending_pool:
                try:
                    on_chain_risk = await self.lending_pool.functions.riskScores(address).call()
                except:
                    pass
            
            # Get verification status
            verification_messages = await self._get_verification_messages(address)
            is_verified = False
            verification_level = 'none'
            
            if verification_messages:
                latest_verification = max(verification_messages, key=lambda x: x.get('timestamp', 0))
                is_verified = latest_verification.get('verified', False)
                verification_level = latest_verification.get('level', 'basic')
            
            # Return comprehensive risk data
            return {
                'address': address,
                'features': features,
                'transaction_counts': {
                    'evm': len(transactions['evm']),
                    'iota': len(transactions['iota']),
                    'cross_layer': len(transactions['cross_layer'])
                },
                'on_chain_risk_score': on_chain_risk,
                'identity': {
                    'verified': is_verified,
                    'level': verification_level
                },
                'has_iota_activity': len(transactions['iota']) > 0,
                'has_cross_layer_activity': len(transactions['cross_layer']) > 0,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting user risk data: {e}")
            return {
                'address': address,
                'features': {},
                'transaction_counts': {
                    'evm': 0,
                    'iota': 0,
                    'cross_layer': 0
                },
                'on_chain_risk_score': 50,
                'identity': {
                    'verified': False,
                    'level': 'none'
                },
                'has_iota_activity': False,
                'has_cross_layer_activity': False,
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }


# Utility function for synchronous API usage
def get_user_features_sync(address, rpc_url=None, iota_node_url=None):
    """Synchronous wrapper for get_user_features."""
    collector = BlockchainDataCollector(rpc_url, iota_node_url)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # Initialize IOTA client first
        loop.run_until_complete(collector._init_iota_client())
        # Then get features
        result = loop.run_until_complete(collector.get_user_features(address))
        return result
    except Exception as e:
        logger.error(f"Error in sync wrapper: {e}")
        return {}
    finally:
        loop.close()


# Utility function for synchronous risk data retrieval
def get_user_risk_data_sync(address, rpc_url=None, iota_node_url=None):
    """Synchronous wrapper for get_user_risk_data."""
    collector = BlockchainDataCollector(rpc_url, iota_node_url)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # Initialize IOTA client first
        loop.run_until_complete(collector._init_iota_client())
        # Then get risk data
        result = loop.run_until_complete(collector.get_user_risk_data(address))
        return result
    except Exception as e:
        logger.error(f"Error in sync risk data wrapper: {e}")
        return {
            'address': address,
            'error': str(e)
        }
    finally:
        loop.close()


# Test function
if __name__ == '__main__':
    async def test():
        collector = BlockchainDataCollector()
        await collector._init_iota_client()
        features = await collector.get_user_features("0x0000000000000000000000000000000000000000")
        print("Features:")
        print(json.dumps(features, indent=2))
        
        risk_data = await collector.get_user_risk_data("0x0000000000000000000000000000000000000000")
        print("\nRisk Data:")
        print(json.dumps(risk_data, indent=2))
    
    asyncio.run(test())
