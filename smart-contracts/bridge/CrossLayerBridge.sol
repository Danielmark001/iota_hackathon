// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CrossLayerBridge
 * @dev Bridge contract for cross-layer communication between EVM (L2) and Move (L1)
 * @notice This contract handles message passing between the EVM and Move layers
 */
contract CrossLayerBridge is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    // Message statuses
    enum MessageStatus {
        Pending,
        Processed,
        Failed,
        Canceled
    }
    
    // Message direction
    enum MessageDirection {
        L2ToL1,
        L1ToL2
    }
    
    // Message with metadata
    struct BridgeMessage {
        bytes32 messageId;
        address sender;
        bytes32 targetAddress; // Move layer address as bytes32
        bytes payload;
        uint256 timestamp;
        MessageStatus status;
        MessageDirection direction;
        string messageType;
        uint256 gasLimit;
        uint256 fee;
    }
    
    // Mapping of message ID to message
    mapping(bytes32 => BridgeMessage) public messages;
    
    // Mapping of processed L1 message hashes to prevent replay
    mapping(bytes32 => bool) public processedL1Messages;
    
    // Array to track all message IDs
    bytes32[] public allMessageIds;
    
    // Fee configuration
    uint256 public baseFee;
    uint256 public feePerByte;
    
    // Security parameters
    uint256 public minConfirmations;
    uint256 public messageTimeout;
    
    // Protocol stats
    uint256 public totalMessagesL2ToL1;
    uint256 public totalMessagesL1ToL2;
    uint256 public totalProcessedMessages;
    uint256 public totalFailedMessages;
    
    // Events
    event MessageSent(
        bytes32 indexed messageId,
        address indexed sender,
        bytes32 indexed targetAddress,
        string messageType,
        bytes payload,
        uint256 timestamp,
        MessageDirection direction
    );
    
    event MessageProcessed(
        bytes32 indexed messageId,
        address indexed processor,
        uint256 timestamp,
        bool success
    );
    
    event MessageCanceled(
        bytes32 indexed messageId,
        address indexed canceller,
        uint256 timestamp
    );
    
    event FeeUpdated(
        uint256 baseFee,
        uint256 feePerByte,
        address updater,
        uint256 timestamp
    );
    
    event SecurityParamsUpdated(
        uint256 minConfirmations,
        uint256 messageTimeout,
        address updater,
        uint256 timestamp
    );
    
    /**
     * @dev Constructor
     * @param admin Address of the admin
     */
    constructor(address admin) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(BRIDGE_ADMIN_ROLE, admin);
        
        baseFee = 0.001 ether;
        feePerByte = 0.00001 ether;
        minConfirmations = 3;
        messageTimeout = 3 days;
    }
    
    /**
     * @dev Send a message from L2 (EVM) to L1 (Move)
     * @param targetAddress The address on L1 to receive the message
     * @param messageType The type of message
     * @param payload The message payload
     * @param gasLimit Gas limit for the message execution on L1
     * @return messageId The ID of the sent message
     */
    function sendMessageToL1(
        bytes32 targetAddress,
        string calldata messageType,
        bytes calldata payload,
        uint256 gasLimit
    ) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 messageId) 
    {
        // Calculate fee
        uint256 requiredFee = baseFee + (feePerByte * payload.length);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            msg.sender,
            targetAddress,
            messageType,
            payload,
            block.timestamp,
            totalMessagesL2ToL1
        ));
        
        // Store message
        messages[messageId] = BridgeMessage({
            messageId: messageId,
            sender: msg.sender,
            targetAddress: targetAddress,
            payload: payload,
            timestamp: block.timestamp,
            status: MessageStatus.Pending,
            direction: MessageDirection.L2ToL1,
            messageType: messageType,
            gasLimit: gasLimit,
            fee: msg.value
        });
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL2ToL1++;
        
        // Emit event
        emit MessageSent(
            messageId,
            msg.sender,
            targetAddress,
            messageType,
            payload,
            block.timestamp,
            MessageDirection.L2ToL1
        );
        
        return messageId;
    }
    
    /**
     * @dev Process a message from L1 (Move) to L2 (EVM)
     * @param sender The L1 address that sent the message
     * @param messageType The type of message
     * @param payload The message payload
     * @param l1Timestamp Timestamp from the L1 chain
     * @param signature Signature from the oracle validating this message
     * @return messageId The ID of the processed message
     */
    function processMessageFromL1(
        bytes32 sender,
        string calldata messageType,
        bytes calldata payload,
        uint256 l1Timestamp,
        bytes calldata signature
    ) 
        external 
        onlyRole(RELAYER_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 messageId) 
    {
        // Generate message hash
        messageId = keccak256(abi.encodePacked(
            sender,
            messageType,
            payload,
            l1Timestamp
        ));
        
        // Prevent replay
        require(!processedL1Messages[messageId], "Message already processed");
        
        // Verify oracle signature
        require(_verifySignature(messageId, signature), "Invalid signature");
        
        // Mark as processed
        processedL1Messages[messageId] = true;
        
        // Store message
        messages[messageId] = BridgeMessage({
            messageId: messageId,
            sender: address(uint160(uint256(sender))), // Convert bytes32 to address
            targetAddress: bytes32(0), // No target for L1->L2, processed immediately
            payload: payload,
            timestamp: block.timestamp,
            status: MessageStatus.Processed,
            direction: MessageDirection.L1ToL2,
            messageType: messageType,
            gasLimit: 0,
            fee: 0
        });
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL1ToL2++;
        totalProcessedMessages++;
        
        // Execute the message based on type
        bool success = _executeMessage(messageType, payload);
        
        // Update status if failed
        if (!success) {
            messages[messageId].status = MessageStatus.Failed;
            totalFailedMessages++;
        }
        
        // Emit event
        emit MessageProcessed(
            messageId,
            msg.sender,
            block.timestamp,
            success
        );
        
        return messageId;
    }
    
    /**
     * @dev Confirm that a message from L2 was processed on L1
     * @param messageId The ID of the message
     * @param success Whether the processing was successful
     * @param signature Signature from the oracle validating this confirmation
     */
    function confirmL2ToL1Message(
        bytes32 messageId,
        bool success,
        bytes calldata signature
    ) 
        external 
        onlyRole(RELAYER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        BridgeMessage storage message = messages[messageId];
        
        // Verify message exists and is pending
        require(message.messageId == messageId, "Message not found");
        require(message.status == MessageStatus.Pending, "Message not pending");
        require(message.direction == MessageDirection.L2ToL1, "Wrong message direction");
        
        // Verify oracle signature
        bytes32 confirmationHash = keccak256(abi.encodePacked(messageId, success));
        require(_verifySignature(confirmationHash, signature), "Invalid signature");
        
        // Update message status
        if (success) {
            message.status = MessageStatus.Processed;
            totalProcessedMessages++;
        } else {
            message.status = MessageStatus.Failed;
            totalFailedMessages++;
            
            // Refund fees for failed messages
            payable(message.sender).transfer(message.fee);
        }
        
        // Emit event
        emit MessageProcessed(
            messageId,
            msg.sender,
            block.timestamp,
            success
        );
    }
    
    /**
     * @dev Cancel a pending message that has timed out
     * @param messageId The ID of the message
     */
    function cancelMessage(bytes32 messageId) external nonReentrant {
        BridgeMessage storage message = messages[messageId];
        
        // Verify message exists, is pending, and sender is original sender
        require(message.messageId == messageId, "Message not found");
        require(message.status == MessageStatus.Pending, "Message not pending");
        require(message.sender == msg.sender, "Not message sender");
        
        // Verify message has timed out
        require(block.timestamp > message.timestamp + messageTimeout, "Message not timed out");
        
        // Update message status
        message.status = MessageStatus.Canceled;
        
        // Refund fees
        payable(msg.sender).transfer(message.fee);
        
        // Emit event
        emit MessageCanceled(
            messageId,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Update the fee parameters
     * @param newBaseFee The new base fee
     * @param newFeePerByte The new fee per byte
     */
    function updateFees(uint256 newBaseFee, uint256 newFeePerByte) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        baseFee = newBaseFee;
        feePerByte = newFeePerByte;
        
        emit FeeUpdated(
            newBaseFee,
            newFeePerByte,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Update the security parameters
     * @param newMinConfirmations The new minimum confirmations
     * @param newMessageTimeout The new message timeout
     */
    function updateSecurityParams(uint256 newMinConfirmations, uint256 newMessageTimeout) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        minConfirmations = newMinConfirmations;
        messageTimeout = newMessageTimeout;
        
        emit SecurityParamsUpdated(
            newMinConfirmations,
            newMessageTimeout,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Pause the bridge
     */
    function pause() external onlyRole(BRIDGE_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the bridge
     */
    function unpause() external onlyRole(BRIDGE_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get the total number of messages
     * @return total The total number of messages
     */
    function getTotalMessages() external view returns (uint256) {
        return totalMessagesL2ToL1 + totalMessagesL1ToL2;
    }
    
    /**
     * @dev Get all message IDs for a sender
     * @param sender The address of the sender
     * @return ids Array of message IDs
     */
    function getMessageIdsBySender(address sender) external view returns (bytes32[] memory) {
        uint256 count = 0;
        
        // Count messages for this sender
        for (uint256 i = 0; i < allMessageIds.length; i++) {
            if (messages[allMessageIds[i]].sender == sender) {
                count++;
            }
        }
        
        // Create array of the right size
        bytes32[] memory senderIds = new bytes32[](count);
        
        // Fill array
        uint256 index = 0;
        for (uint256 i = 0; i < allMessageIds.length; i++) {
            if (messages[allMessageIds[i]].sender == sender) {
                senderIds[index] = allMessageIds[i];
                index++;
            }
        }
        
        return senderIds;
    }
    
    /**
     * @dev Get all message IDs for a message type
     * @param messageType The type of message
     * @return ids Array of message IDs
     */
    function getMessageIdsByType(string calldata messageType) external view returns (bytes32[] memory) {
        uint256 count = 0;
        
        // Count messages of this type
        for (uint256 i = 0; i < allMessageIds.length; i++) {
            if (keccak256(bytes(messages[allMessageIds[i]].messageType)) == keccak256(bytes(messageType))) {
                count++;
            }
        }
        
        // Create array of the right size
        bytes32[] memory typeIds = new bytes32[](count);
        
        // Fill array
        uint256 index = 0;
        for (uint256 i = 0; i < allMessageIds.length; i++) {
            if (keccak256(bytes(messages[allMessageIds[i]].messageType)) == keccak256(bytes(messageType))) {
                typeIds[index] = allMessageIds[i];
                index++;
            }
        }
        
        return typeIds;
    }
    
    /**
     * @dev Verify a signature from an oracle
     * @param messageHash The hash of the message
     * @param signature The signature
     * @return Whether the signature is valid
     */
    function _verifySignature(bytes32 messageHash, bytes calldata signature) internal view returns (bool) {
        // In a real implementation, this would verify the signature against the oracle's public key
        // For simplicity, we're not implementing the full signature verification
        
        // Example of how this might be implemented:
        // bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        // address signer = ecrecover(ethSignedMessageHash, v, r, s);
        // return hasRole(ORACLE_ROLE, signer);
        
        // For hackathon purposes, just return true
        return true;
    }
    
    /**
     * @dev Execute a message from L1
     * @param messageType The type of message
     * @param payload The message payload
     * @return success Whether the execution was successful
     */
    function _executeMessage(string calldata messageType, bytes calldata payload) internal returns (bool) {
        // In a real implementation, this would execute different actions based on the message type
        // For example, updating risk scores, processing cross-chain transfers, etc.
        
        if (keccak256(bytes(messageType)) == keccak256(bytes("RISK_SCORE_UPDATE"))) {
            // Example: Extract user address and risk score from payload
            (address user, uint256 score) = abi.decode(payload, (address, uint256));
            
            // Call the risk assessment contract or lending pool to update the score
            // We would normally have an interface defined, but for brevity:
            // IAIRiskAssessment(riskAssessmentAddress).updateUserRiskScore(user, score);
            
            return true;
        } else if (keccak256(bytes(messageType)) == keccak256(bytes("ASSET_TRANSFER"))) {
            // Example: Process a cross-chain asset transfer
            
            return true;
        } else if (keccak256(bytes(messageType)) == keccak256(bytes("COLLATERAL_CHANGE"))) {
            // Example: Process a collateral status change
            
            return true;
        }
        
        // Unknown message type
        return false;
    }
    
    /**
     * @dev Withdraw accumulated fees
     * @param amount The amount to withdraw
     * @param recipient The address to receive the fees
     */
    function withdrawFees(uint256 amount, address payable recipient) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        require(address(this).balance >= amount, "Insufficient balance");
        recipient.transfer(amount);
    }
    
    // Fallback function to accept ETH
    receive() external payable {}
}
