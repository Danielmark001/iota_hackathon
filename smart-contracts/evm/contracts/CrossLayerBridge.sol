// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CrossLayerBridge
 * @dev Bridge for communication between IOTA EVM (Layer 2) and IOTA's native Layer 1
 * @notice Facilitates cross-layer messaging and asset transfers
 */
contract CrossLayerBridge is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    
    // Events
    event MessageSentToL1(
        bytes32 indexed messageId,
        bytes32 indexed targetAddress,
        string messageType,
        uint256 timestamp
    );
    
    event MessageReceivedFromL1(
        bytes32 indexed messageId,
        address indexed sender,
        string messageType,
        uint256 timestamp
    );
    
    event AssetTransferredToL1(
        bytes32 indexed transferId,
        bytes32 indexed recipient,
        string assetType,
        uint256 amount,
        uint256 timestamp
    );
    
    event AssetReceivedFromL1(
        bytes32 indexed transferId,
        address indexed recipient,
        string assetType,
        uint256 amount,
        uint256 timestamp
    );
    
    event OracleAdded(address indexed oracle, uint256 timestamp);
    event OracleRemoved(address indexed oracle, uint256 timestamp);
    
    // Struct to track message verification status against L1
    struct MessageVerification {
        bytes32 messageId;
        bytes32 tangleBlockId; // Block ID on the Tangle where this message is stored
        bool verified;         // Whether this message is verified on L1
        uint256 verificationTimestamp;
    }
    
    // Message structure
    struct Message {
        bytes32 messageId;
        address sender;
        bytes32 targetAddress;
        string messageType;
        bytes payload;
        uint256 timestamp;
        bool processed;
        MessageVerification verification;
    }
    
    // Asset transfer structure
    struct AssetTransfer {
        bytes32 transferId;
        address sender;
        bytes32 recipient;
        string assetType;
        uint256 amount;
        uint256 timestamp;
        bool processed;
        MessageVerification verification;
    }
    
    // Oracles authorized to relay messages from L1
    mapping(address => bool) public authorizedOracles;
    address[] public oracleList;
    
    // Mappings to store messages and transfers
    mapping(bytes32 => Message) public sentMessages;
    mapping(bytes32 => Message) public receivedMessages;
    mapping(bytes32 => AssetTransfer) public sentTransfers;
    mapping(bytes32 => AssetTransfer) public receivedTransfers;
    
    // Next message and transfer IDs
    uint256 private nextMessageNonce;
    uint256 private nextTransferNonce;
    
    // Counters
    uint256 public totalMessagesSent;
    uint256 public totalMessagesReceived;
    uint256 public totalTransfersSent;
    uint256 public totalTransfersReceived;
    
    // IOTA L1 configuration
    string public iotaNetwork;
    bytes32 public iotaNodeId;
    uint256 public l1ConfirmationBlocks; // Number of blocks required for L1 confirmation
    
    /**
     * @dev Constructor to initialize the bridge
     * @param initialOracles Initial list of authorized oracles
     * @param _iotaNetwork IOTA network name (e.g., "mainnet", "testnet")
     * @param _l1ConfirmationBlocks Number of blocks required for L1 confirmation
     */
    constructor(
        address[] memory initialOracles,
        string memory _iotaNetwork,
        uint256 _l1ConfirmationBlocks
    ) {
        // Initialize oracles
        for (uint256 i = 0; i < initialOracles.length; i++) {
            _addOracle(initialOracles[i]);
        }
        
        // Initialize nonces
        nextMessageNonce = 1;
        nextTransferNonce = 1;
        
        // Set IOTA configuration
        iotaNetwork = _iotaNetwork;
        l1ConfirmationBlocks = _l1ConfirmationBlocks > 0 ? _l1ConfirmationBlocks : 10;
        
        // Generate a random node ID for this bridge instance
        iotaNodeId = keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender));
    }
    
    /**
     * @dev Modifier to restrict access to authorized oracles
     */
    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }
    
    /**
     * @dev Send a message to Layer 1
     * @param targetAddress Recipient address on L1 (as bytes32)
     * @param messageType Type of message (for routing)
     * @param payload Message data
     * @param gasLimit Gas limit for L1 execution
     * @return messageId The ID of the sent message
     */
    function sendMessageToL1(
        bytes32 targetAddress,
        string calldata messageType,
        bytes calldata payload,
        uint256 gasLimit
    ) external payable nonReentrant whenNotPaused returns (bytes32 messageId) {
        require(targetAddress != bytes32(0), "Invalid target address");
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            block.chainid,
            msg.sender,
            nextMessageNonce++,
            block.timestamp
        ));
        
        // Store message
        sentMessages[messageId] = Message({
            messageId: messageId,
            sender: msg.sender,
            targetAddress: targetAddress,
            messageType: messageType,
            payload: payload,
            timestamp: block.timestamp,
            processed: false,
            verification: MessageVerification({
                messageId: messageId,
                tangleBlockId: bytes32(0),
                verified: false,
                verificationTimestamp: 0
            })
        });
        
        totalMessagesSent++;
        
        // Emit event for L1 oracles to pick up
        emit MessageSentToL1(messageId, targetAddress, messageType, block.timestamp);
        
        return messageId;
    }
    
    /**
     * @dev Update a sent message with its Tangle block ID
     * @param messageId ID of the message
     * @param tangleBlockId Tangle block ID where the message was stored
     * @return success Whether the update was successful
     */
    function updateMessageTangleBlock(
        bytes32 messageId,
        bytes32 tangleBlockId
    ) external onlyOracle returns (bool success) {
        require(messageId != bytes32(0), "Invalid message ID");
        require(tangleBlockId != bytes32(0), "Invalid Tangle block ID");
        
        Message storage message = sentMessages[messageId];
        require(message.messageId == messageId, "Message not found");
        
        // Update Tangle block ID
        message.verification.tangleBlockId = tangleBlockId;
        
        return true;
    }
    
    /**
     * @dev Mark a sent message as verified on L1
     * @param messageId ID of the message
     * @param verified Whether the message was verified
     * @return success Whether the update was successful
     */
    function markMessageVerified(
        bytes32 messageId,
        bool verified
    ) external onlyOracle returns (bool success) {
        require(messageId != bytes32(0), "Invalid message ID");
        
        Message storage message = sentMessages[messageId];
        require(message.messageId == messageId, "Message not found");
        
        // Update verification status
        message.verification.verified = verified;
        message.verification.verificationTimestamp = block.timestamp;
        
        return true;
    }
    
    /**
     * @dev Receive a message from Layer 1 (only callable by oracles)
     * @param messageId ID of the message
     * @param sender Sender address on L1 (as bytes32)
     * @param targetAddress Recipient address on L2
     * @param messageType Type of message
     * @param payload Message data
     * @param tangleBlockId Tangle block ID where the message is stored
     * @return success Whether the message was successfully received
     */
    function receiveMessageFromL1(
        bytes32 messageId,
        bytes32 sender,
        address targetAddress,
        string calldata messageType,
        bytes calldata payload,
        bytes32 tangleBlockId
    ) external onlyOracle nonReentrant whenNotPaused returns (bool success) {
        require(messageId != bytes32(0), "Invalid message ID");
        require(targetAddress != address(0), "Invalid target address");
        require(receivedMessages[messageId].messageId == bytes32(0), "Message already received");
        
        // Store message
        receivedMessages[messageId] = Message({
            messageId: messageId,
            sender: msg.sender, // Oracle address
            targetAddress: bytes32(uint256(uint160(targetAddress))),
            messageType: messageType,
            payload: payload,
            timestamp: block.timestamp,
            processed: false,
            verification: MessageVerification({
                messageId: messageId,
                tangleBlockId: tangleBlockId,
                verified: true, // Messages from L1 are considered verified
                verificationTimestamp: block.timestamp
            })
        });
        
        totalMessagesReceived++;
        
        // Emit event
        emit MessageReceivedFromL1(messageId, msg.sender, messageType, block.timestamp);
        
        // Process message based on type
        _processReceivedMessage(messageId, sender, targetAddress, messageType, payload);
        
        return true;
    }
    
    /**
     * @dev Process a received message based on its type
     * @param messageId ID of the message
     * @param sender Sender address on L1
     * @param targetAddress Recipient address on L2
     * @param messageType Type of message
     * @param payload Message data
     */
    function _processReceivedMessage(
        bytes32 messageId,
        bytes32 sender,
        address targetAddress,
        string memory messageType,
        bytes memory payload
    ) internal {
        // Mark the message as processed
        receivedMessages[messageId].processed = true;
        
        // If the target is a contract, try to forward the message
        if (targetAddress != address(this) && targetAddress.code.length > 0) {
            // Forward to target contract via low-level call
            (bool success, ) = targetAddress.call(
                abi.encodeWithSignature(
                    "handleL1Message(bytes32,bytes32,string,bytes)",
                    messageId,
                    sender,
                    messageType,
                    payload
                )
            );
            
            // If forwarding fails, mark as unprocessed
            if (!success) {
                receivedMessages[messageId].processed = false;
            }
        }
    }
    
    /**
     * @dev Transfer assets to Layer 1
     * @param recipient Recipient address on L1 (as bytes32)
     * @param assetType Type of asset (e.g., "IOTA", "SMR")
     * @param amount Amount to transfer
     * @return transferId The ID of the transfer
     */
    function transferAssetToL1(
        bytes32 recipient,
        string calldata assetType,
        uint256 amount
    ) external payable nonReentrant whenNotPaused returns (bytes32 transferId) {
        require(recipient != bytes32(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        
        // For native ETH transfers
        if (keccak256(abi.encodePacked(assetType)) == keccak256(abi.encodePacked("ETH"))) {
            require(msg.value == amount, "Incorrect ETH amount sent");
        } else if (keccak256(abi.encodePacked(assetType)) == keccak256(abi.encodePacked("IOTA"))) {
            // For IOTA token transfers, we'd handle ERC20 transfers here
            // This is a simplified implementation
            revert("IOTA token transfers not implemented yet");
        }
        
        // Generate transfer ID
        transferId = keccak256(abi.encodePacked(
            block.chainid,
            msg.sender,
            nextTransferNonce++,
            block.timestamp
        ));
        
        // Store transfer
        sentTransfers[transferId] = AssetTransfer({
            transferId: transferId,
            sender: msg.sender,
            recipient: recipient,
            assetType: assetType,
            amount: amount,
            timestamp: block.timestamp,
            processed: false,
            verification: MessageVerification({
                messageId: transferId,
                tangleBlockId: bytes32(0),
                verified: false,
                verificationTimestamp: 0
            })
        });
        
        totalTransfersSent++;
        
        // Emit event for L1 oracles to pick up
        emit AssetTransferredToL1(transferId, recipient, assetType, amount, block.timestamp);
        
        return transferId;
    }
    
    /**
     * @dev Update a sent transfer with its Tangle block ID
     * @param transferId ID of the transfer
     * @param tangleBlockId Tangle block ID where the transfer was stored
     * @return success Whether the update was successful
     */
    function updateTransferTangleBlock(
        bytes32 transferId,
        bytes32 tangleBlockId
    ) external onlyOracle returns (bool success) {
        require(transferId != bytes32(0), "Invalid transfer ID");
        require(tangleBlockId != bytes32(0), "Invalid Tangle block ID");
        
        AssetTransfer storage transfer = sentTransfers[transferId];
        require(transfer.transferId == transferId, "Transfer not found");
        
        // Update Tangle block ID
        transfer.verification.tangleBlockId = tangleBlockId;
        
        return true;
    }
    
    /**
     * @dev Mark a sent transfer as verified on L1
     * @param transferId ID of the transfer
     * @param verified Whether the transfer was verified
     * @return success Whether the update was successful
     */
    function markTransferVerified(
        bytes32 transferId,
        bool verified
    ) external onlyOracle returns (bool success) {
        require(transferId != bytes32(0), "Invalid transfer ID");
        
        AssetTransfer storage transfer = sentTransfers[transferId];
        require(transfer.transferId == transferId, "Transfer not found");
        
        // Update verification status
        transfer.verification.verified = verified;
        transfer.verification.verificationTimestamp = block.timestamp;
        
        return true;
    }
    
    /**
     * @dev Receive an asset transfer from Layer 1 (only callable by oracles)
     * @param transferId ID of the transfer
     * @param sender Sender address on L1 (as bytes32)
     * @param recipient Recipient address on L2
     * @param assetType Type of asset
     * @param amount Amount transferred
     * @param tangleBlockId Tangle block ID where the transfer is stored
     * @return success Whether the transfer was successfully received
     */
    function receiveAssetFromL1(
        bytes32 transferId,
        bytes32 sender,
        address recipient,
        string calldata assetType,
        uint256 amount,
        bytes32 tangleBlockId
    ) external onlyOracle nonReentrant whenNotPaused returns (bool success) {
        require(transferId != bytes32(0), "Invalid transfer ID");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(receivedTransfers[transferId].transferId == bytes32(0), "Transfer already received");
        
        // Store transfer
        receivedTransfers[transferId] = AssetTransfer({
            transferId: transferId,
            sender: msg.sender, // Oracle address
            recipient: bytes32(uint256(uint160(recipient))),
            assetType: assetType,
            amount: amount,
            timestamp: block.timestamp,
            processed: false,
            verification: MessageVerification({
                messageId: transferId,
                tangleBlockId: tangleBlockId,
                verified: true, // Transfers from L1 are considered verified
                verificationTimestamp: block.timestamp
            })
        });
        
        totalTransfersReceived++;
        
        // Emit event
        emit AssetReceivedFromL1(transferId, recipient, assetType, amount, block.timestamp);
        
        // Process transfer based on asset type
        _processReceivedTransfer(transferId, sender, recipient, assetType, amount);
        
        return true;
    }
    
    /**
     * @dev Process a received asset transfer
     * @param transferId ID of the transfer
     * @param sender Sender address on L1
     * @param recipient Recipient address on L2
     * @param assetType Type of asset
     * @param amount Amount transferred
     */
    function _processReceivedTransfer(
        bytes32 transferId,
        bytes32 sender,
        address recipient,
        string memory assetType,
        uint256 amount
    ) internal {
        // Mark the transfer as processed
        receivedTransfers[transferId].processed = true;
        
        // Handle native ETH transfers
        if (keccak256(abi.encodePacked(assetType)) == keccak256(abi.encodePacked("ETH"))) {
            // Forward ETH to recipient
            (bool success, ) = recipient.call{value: amount}("");
            
            if (!success) {
                // Mark as unprocessed if forwarding fails
                receivedTransfers[transferId].processed = false;
            }
        } else if (keccak256(abi.encodePacked(assetType)) == keccak256(abi.encodePacked("IOTA"))) {
            // For IOTA token transfers, we'd mint an ERC20 token here
            // This is a simplified implementation
            receivedTransfers[transferId].processed = false;
        }
    }
    
    /**
     * @dev Add an oracle (only callable by owner)
     * @param oracle Address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
        _addOracle(oracle);
    }
    
    /**
     * @dev Internal function to add an oracle
     * @param oracle Address of the oracle to add
     */
    function _addOracle(address oracle) internal {
        require(oracle != address(0), "Invalid oracle address");
        require(!authorizedOracles[oracle], "Oracle already exists");
        
        authorizedOracles[oracle] = true;
        oracleList.push(oracle);
        
        emit OracleAdded(oracle, block.timestamp);
    }
    
    /**
     * @dev Remove an oracle (only callable by owner)
     * @param oracle Address of the oracle to remove
     */
    function removeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Oracle does not exist");
        
        authorizedOracles[oracle] = false;
        
        // Remove from list
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[oracleList.length - 1];
                oracleList.pop();
                break;
            }
        }
        
        emit OracleRemoved(oracle, block.timestamp);
    }
    
    /**
     * @dev Get all oracle addresses
     * @return _oracles Array of oracle addresses
     */
    function getOracles() external view returns (address[] memory _oracles) {
        return oracleList;
    }
    
    /**
     * @dev Get details of a sent message
     * @param messageId ID of the message
     * @return sender Sender address
     * @return targetAddress Target address on L1
     * @return messageType Message type
     * @return timestamp When the message was sent
     * @return processed Whether the message has been processed
     * @return verified Whether the message has been verified on L1
     * @return tangleBlockId Tangle block ID where the message is stored
     */
    function getSentMessageDetails(bytes32 messageId) external view returns (
        address sender,
        bytes32 targetAddress,
        string memory messageType,
        uint256 timestamp,
        bool processed,
        bool verified,
        bytes32 tangleBlockId
    ) {
        Message memory message = sentMessages[messageId];
        return (
            message.sender,
            message.targetAddress,
            message.messageType,
            message.timestamp,
            message.processed,
            message.verification.verified,
            message.verification.tangleBlockId
        );
    }
    
    /**
     * @dev Get details of a received message
     * @param messageId ID of the message
     * @return sender Oracle address that relayed the message
     * @return targetAddress Target address on L2
     * @return messageType Message type
     * @return timestamp When the message was received
     * @return processed Whether the message has been processed
     * @return tangleBlockId Tangle block ID where the message is stored
     */
    function getReceivedMessageDetails(bytes32 messageId) external view returns (
        address sender,
        bytes32 targetAddress,
        string memory messageType,
        uint256 timestamp,
        bool processed,
        bytes32 tangleBlockId
    ) {
        Message memory message = receivedMessages[messageId];
        return (
            message.sender,
            message.targetAddress,
            message.messageType,
            message.timestamp,
            message.processed,
            message.verification.tangleBlockId
        );
    }
    
    /**
     * @dev Update IOTA network configuration (only callable by owner)
     * @param _iotaNetwork IOTA network name
     * @param _l1ConfirmationBlocks Number of blocks required for L1 confirmation
     */
    function updateIotaConfig(
        string calldata _iotaNetwork,
        uint256 _l1ConfirmationBlocks
    ) external onlyOwner {
        iotaNetwork = _iotaNetwork;
        l1ConfirmationBlocks = _l1ConfirmationBlocks > 0 ? _l1ConfirmationBlocks : 10;
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {}
}
