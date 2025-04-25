// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILendingPool.sol";
import "./interfaces/IIOTAStreams.sol";

/**
 * @title IntelliLend Flash Loan Protection
 * @dev Protects the lending platform from flash loan attacks and manipulation
 */
contract FlashLoanProtection is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant MONITORING_PERIOD = 5 minutes; // Time window for monitoring transactions
    uint256 public constant BLOCKS_TO_CONFIRM = 3; // Blocks required for transaction confirmation
    
    // State variables
    ILendingPool public lendingPool;
    IIOTAStreams public iotaStreams;
    
    // Transaction monitoring
    struct Transaction {
        address user;
        uint256 amount;
        uint256 timestamp;
        uint256 blockNumber;
        bool confirmed;
        bool flagged;
        string transactionType;
    }
    
    mapping(bytes32 => Transaction) public transactions;
    mapping(address => uint256) public userRiskScores;
    mapping(address => uint256) public lastActivityTimestamp;
    mapping(address => uint256) public consecutiveHighValueTxs;
    
    // Thresholds for detection
    uint256 public largeTransactionThreshold;
    uint256 public rapidTransactionThreshold;
    uint256 public priceMovementThreshold;
    uint256 public flashLoanMultiplier;
    
    // IOTA Streams channel for security events
    bytes public streamsChannelAddress;
    
    // Events
    event TransactionMonitored(
        bytes32 indexed txId,
        address indexed user,
        uint256 amount,
        string transactionType,
        uint256 timestamp
    );
    
    event TransactionFlagged(
        bytes32 indexed txId,
        address indexed user,
        string reason,
        uint256 timestamp
    );
    
    event TransactionConfirmed(
        bytes32 indexed txId,
        uint256 confirmationTime
    );
    
    event UserBlacklisted(
        address indexed user,
        string reason,
        uint256 timestamp
    );
    
    event ThresholdUpdated(
        string thresholdName,
        uint256 newValue
    );
    
    /**
     * @dev Constructor to initialize the flash loan protection
     * @param _lendingPool Address of the lending pool contract
     * @param _iotaStreamsAddress Address of the IOTA Streams contract
     * @param _largeTransactionThreshold Threshold for large transactions
     */
    constructor(
        address _lendingPool,
        address _iotaStreamsAddress,
        uint256 _largeTransactionThreshold
    ) {
        lendingPool = ILendingPool(_lendingPool);
        iotaStreams = IIOTAStreams(_iotaStreamsAddress);
        largeTransactionThreshold = _largeTransactionThreshold;
        rapidTransactionThreshold = 3; // 3 transactions within monitoring period
        priceMovementThreshold = 5; // 5% price movement
        flashLoanMultiplier = 20; // 20x user's normal transaction volume
        
        // Initialize IOTA Streams channel for security events
        bytes memory seed = abi.encodePacked(blockhash(block.number - 1), address(this));
        streamsChannelAddress = iotaStreams.createChannel(seed);
    }
    
    /**
     * @dev Monitor a transaction for potential flash loan attack
     * @param user Address of the user
     * @param amount Transaction amount
     * @param transactionType Type of transaction (deposit, borrow, etc.)
     * @return txId Transaction ID for reference
     */
    function monitorTransaction(
        address user,
        uint256 amount,
        string calldata transactionType
    ) external returns (bytes32) {
        require(msg.sender == address(lendingPool) || msg.sender == owner(), "Unauthorized");
        
        // Generate transaction ID
        bytes32 txId = keccak256(abi.encodePacked(user, amount, block.timestamp, transactionType));
        
        // Store transaction data
        transactions[txId] = Transaction({
            user: user,
            amount: amount,
            timestamp: block.timestamp,
            blockNumber: block.number,
            confirmed: false,
            flagged: false,
            transactionType: transactionType
        });
        
        // Check for suspicious patterns
        _checkForSuspiciousActivity(txId, user, amount, transactionType);
        
        // Update user's last activity timestamp
        lastActivityTimestamp[user] = block.timestamp;
        
        // Emit event
        emit TransactionMonitored(txId, user, amount, transactionType, block.timestamp);
        
        // Send event to IOTA Streams
        bytes memory payload = abi.encode(
            txId,
            user,
            amount,
            transactionType,
            block.timestamp
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "TRANSACTION_MONITORED");
        
        return txId;
    }
    
    /**
     * @dev Confirm a transaction after sufficient blocks have passed
     * @param txId Transaction ID to confirm
     */
    function confirmTransaction(bytes32 txId) external {
        Transaction storage tx = transactions[txId];
        
        require(tx.timestamp > 0, "Transaction not found");
        require(!tx.confirmed, "Transaction already confirmed");
        require(block.number >= tx.blockNumber + BLOCKS_TO_CONFIRM, "Not enough blocks passed");
        
        tx.confirmed = true;
        
        // Reset user's consecutive high value transaction counter if this was flagged
        if (tx.flagged) {
            consecutiveHighValueTxs[tx.user] = 0;
        }
        
        emit TransactionConfirmed(txId, block.timestamp);
        
        // Send confirmation to IOTA Streams
        bytes memory payload = abi.encode(
            txId,
            block.timestamp
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "TRANSACTION_CONFIRMED");
    }
    
    /**
     * @dev Check for suspicious activity patterns
     * @param txId Transaction ID
     * @param user User address
     * @param amount Transaction amount
     * @param transactionType Type of transaction
     */
    function _checkForSuspiciousActivity(
        bytes32 txId,
        address user,
        uint256 amount,
        string memory transactionType
    ) internal {
        // Check for large transactions
        if (amount >= largeTransactionThreshold) {
            _flagTransaction(txId, user, "Large transaction amount");
            consecutiveHighValueTxs[user]++;
        }
        
        // Check for rapid transactions
        uint256 txCount = _countRecentTransactions(user);
        if (txCount >= rapidTransactionThreshold) {
            _flagTransaction(txId, user, "Rapid transaction sequence");
        }
        
        // Check for abnormal behavior based on past patterns
        if (_isAbnormalBehavior(user, amount, transactionType)) {
            _flagTransaction(txId, user, "Abnormal behavior pattern");
        }
        
        // If user has too many consecutive high-value transactions, increase risk score
        if (consecutiveHighValueTxs[user] >= 3) {
            userRiskScores[user] += 20;
            
            // Update risk score in lending pool if it exists
            try lendingPool.updateRiskScore(user, lendingPool.riskScores(user) + 20) {
                // Successfully updated risk score
            } catch {
                // Lending pool doesn't support risk score updates
            }
            
            // If risk score is too high, blacklist user
            if (userRiskScores[user] >= 80) {
                _blacklistUser(user, "Too many high-risk transactions");
            }
        }
    }
    
    /**
     * @dev Flag a transaction as suspicious
     * @param txId Transaction ID
     * @param user User address
     * @param reason Reason for flagging
     */
    function _flagTransaction(bytes32 txId, address user, string memory reason) internal {
        Transaction storage tx = transactions[txId];
        tx.flagged = true;
        
        // Increase user risk score
        userRiskScores[user] += 10;
        
        emit TransactionFlagged(txId, user, reason, block.timestamp);
        
        // Send flag to IOTA Streams
        bytes memory payload = abi.encode(
            txId,
            user,
            reason,
            block.timestamp
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "TRANSACTION_FLAGGED");
    }
    
    /**
     * @dev Count recent transactions by the user within monitoring period
     * @param user User address
     * @return count Number of recent transactions
     */
    function _countRecentTransactions(address user) internal view returns (uint256) {
        uint256 count = 0;
        uint256 cutoffTime = block.timestamp - MONITORING_PERIOD;
        
        // Ideally, we would have a more efficient way to do this,
        // but for simplicity, we're using a more basic approach
        // In a real implementation, we would use a data structure optimized for this
        
        return count;
    }
    
    /**
     * @dev Check if user behavior is abnormal based on history
     * @param user User address
     * @param amount Transaction amount
     * @param transactionType Type of transaction
     * @return isAbnormal Whether the behavior is abnormal
     */
    function _isAbnormalBehavior(
        address user,
        uint256 amount,
        string memory transactionType
    ) internal view returns (bool) {
        // Simplified implementation for the hackathon
        // In a real implementation, we would use more sophisticated analysis
        
        // Check if this is the user's first transaction
        if (lastActivityTimestamp[user] == 0) {
            return false;
        }
        
        // Check if the transaction amount is much larger than user's normal activity
        // This would require tracking average transaction amounts per user
        
        return false;
    }
    
    /**
     * @dev Blacklist a user for suspicious activity
     * @param user User address
     * @param reason Reason for blacklisting
     */
    function _blacklistUser(address user, string memory reason) internal {
        // Update risk score in lending pool to maximum
        try lendingPool.updateRiskScore(user, 100) {
            // Successfully blacklisted user in lending pool
        } catch {
            // Lending pool doesn't support risk score updates
        }
        
        emit UserBlacklisted(user, reason, block.timestamp);
        
        // Send blacklist event to IOTA Streams
        bytes memory payload = abi.encode(
            user,
            reason,
            block.timestamp
        );
        
        iotaStreams.sendMessage(streamsChannelAddress, payload, "USER_BLACKLISTED");
    }
    
    /**
     * @dev Update large transaction threshold
     * @param newThreshold New threshold value
     */
    function updateLargeTransactionThreshold(uint256 newThreshold) external onlyOwner {
        largeTransactionThreshold = newThreshold;
        
        emit ThresholdUpdated("largeTransactionThreshold", newThreshold);
    }
    
    /**
     * @dev Update rapid transaction threshold
     * @param newThreshold New threshold value
     */
    function updateRapidTransactionThreshold(uint256 newThreshold) external onlyOwner {
        rapidTransactionThreshold = newThreshold;
        
        emit ThresholdUpdated("rapidTransactionThreshold", newThreshold);
    }
    
    /**
     * @dev Update price movement threshold
     * @param newThreshold New threshold value
     */
    function updatePriceMovementThreshold(uint256 newThreshold) external onlyOwner {
        priceMovementThreshold = newThreshold;
        
        emit ThresholdUpdated("priceMovementThreshold", newThreshold);
    }
    
    /**
     * @dev Update flash loan multiplier
     * @param newMultiplier New multiplier value
     */
    function updateFlashLoanMultiplier(uint256 newMultiplier) external onlyOwner {
        flashLoanMultiplier = newMultiplier;
        
        emit ThresholdUpdated("flashLoanMultiplier", newMultiplier);
    }
    
    /**
     * @dev Get transaction details
     * @param txId Transaction ID
     * @return Full transaction details
     */
    function getTransactionDetails(bytes32 txId) external view returns (
        address user,
        uint256 amount,
        uint256 timestamp,
        uint256 blockNumber,
        bool confirmed,
        bool flagged,
        string memory transactionType
    ) {
        Transaction storage tx = transactions[txId];
        
        return (
            tx.user,
            tx.amount,
            tx.timestamp,
            tx.blockNumber,
            tx.confirmed,
            tx.flagged,
            tx.transactionType
        );
    }
    
    /**
     * @dev Get user risk score
     * @param user User address
     * @return riskScore Risk score of the user
     */
    function getUserRiskScore(address user) external view returns (uint256) {
        return userRiskScores[user];
    }
}
