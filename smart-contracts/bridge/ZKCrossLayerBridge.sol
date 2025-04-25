// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ZKCrossLayerBridge
 * @dev Advanced bridge contract for cross-layer communication between EVM (L2) and Move (L1)
 * with zero-knowledge proof integration for privacy-preserving message passing
 */
contract ZKCrossLayerBridge is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant BRIDGE_ADMIN_ROLE = keccak256("BRIDGE_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant ZK_VERIFIER_ROLE = keccak256("ZK_VERIFIER_ROLE");
    
    // Message statuses
    enum MessageStatus {
        Pending,
        Processed,
        Failed,
        Canceled,
        Verified
    }
    
    // Message direction
    enum MessageDirection {
        L2ToL1,
        L1ToL2
    }
    
    // Bridge message with metadata
    struct BridgeMessage {
        bytes32 messageId;
        address sender;
        bytes32 targetAddress; // Move layer address as bytes32
        bytes payload;
        bytes encryptedPayload; // For privacy-sensitive data
        uint256 timestamp;
        MessageStatus status;
        MessageDirection direction;
        string messageType;
        uint256 gasLimit;
        uint256 fee;
        bool isPrivate;
        bytes32 zkProofId; // Reference to associated ZK proof if applicable
        uint256 expiryTime;
        mapping(address => bool) confirmations; // Oracle confirmations
        uint256 confirmationCount;
    }
    
    // Zero-knowledge proof data
    struct ZKProof {
        bytes32 proofId;
        address verifier;
        bytes proof;
        bytes32 messageId;
        bool verified;
        uint256 timestamp;
        string proofType;
        bytes32 publicInputHash;
    }
    
    // User data for privacy-preserving risk assessment
    struct UserRiskData {
        address user;
        uint256 riskScoreCommitment; // Committed risk score (hashed)
        mapping(string => bytes) attributeProofs; // Proofs for various attributes
        uint256 lastUpdate;
        bool hasValidProof;
    }
    
    // Mapping of message ID to message
    mapping(bytes32 => BridgeMessage) public messages;
    
    // Mapping of proof ID to ZK proof
    mapping(bytes32 => ZKProof) public zkProofs;
    
    // Mapping of processed L1 message hashes to prevent replay
    mapping(bytes32 => bool) public processedL1Messages;
    
    // Mapping of user to risk data
    mapping(address => UserRiskData) public userRiskData;
    
    // Registry of trusted verifier contracts for different proof types
    mapping(string => address) public verifierRegistry;
    
    // Array to track all message IDs
    bytes32[] public allMessageIds;
    
    // Array to track all proof IDs
    bytes32[] public allProofIds;
    
    // Fee configuration
    uint256 public baseFee;
    uint256 public feePerByte;
    uint256 public privateFeeMultiplier; // Additional fee for private messages
    uint256 public zkProofVerificationFee;
    
    // Security parameters
    uint256 public minConfirmations;
    uint256 public messageTimeout;
    uint256 public maxMessageSize;
    uint256 public maxEncryptionOverhead;
    
    // Protocol stats
    uint256 public totalMessagesL2ToL1;
    uint256 public totalMessagesL1ToL2;
    uint256 public totalProcessedMessages;
    uint256 public totalFailedMessages;
    uint256 public totalPrivateMessages;
    uint256 public totalZKProofs;
    uint256 public totalVerifiedProofs;
    
    // Addresses for protocol integration
    address public lendingPoolAddress;
    address public riskAssessmentAddress;
    address public trustedEncryptionOracleAddress;
    
    // Events
    event MessageSent(
        bytes32 indexed messageId,
        address indexed sender,
        bytes32 indexed targetAddress,
        string messageType,
        uint256 timestamp,
        MessageDirection direction,
        bool isPrivate
    );
    
    event MessageProcessed(
        bytes32 indexed messageId,
        address indexed processor,
        uint256 timestamp,
        bool success
    );
    
    event MessageConfirmed(
        bytes32 indexed messageId,
        address indexed oracle,
        uint256 timestamp,
        uint256 confirmationCount
    );
    
    event MessageCanceled(
        bytes32 indexed messageId,
        address indexed canceller,
        uint256 timestamp
    );
    
    event ProofSubmitted(
        bytes32 indexed proofId,
        bytes32 indexed messageId,
        address submitter,
        string proofType,
        uint256 timestamp
    );
    
    event ProofVerified(
        bytes32 indexed proofId,
        bytes32 indexed messageId,
        address verifier,
        bool success,
        uint256 timestamp
    );
    
    event RiskDataUpdated(
        address indexed user,
        uint256 commitmentHash,
        bool hasValidProof,
        uint256 timestamp
    );
    
    event FeeUpdated(
        uint256 baseFee,
        uint256 feePerByte,
        uint256 privateFeeMultiplier,
        uint256 zkProofVerificationFee,
        address updater,
        uint256 timestamp
    );
    
    event SecurityParamsUpdated(
        uint256 minConfirmations,
        uint256 messageTimeout,
        uint256 maxMessageSize,
        address updater,
        uint256 timestamp
    );
    
    event VerifierRegistered(
        string proofType,
        address verifierAddress,
        address registrar,
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
        privateFeeMultiplier = 2; // Private messages cost 2x more
        zkProofVerificationFee = 0.005 ether;
        
        minConfirmations = 3;
        messageTimeout = 3 days;
        maxMessageSize = 10 * 1024; // 10 KB max message size
        maxEncryptionOverhead = 256; // Max additional bytes for encryption overhead
    }
    
    /**
     * @dev Register protocol contract addresses
     * @param _lendingPoolAddress Address of the lending pool contract
     * @param _riskAssessmentAddress Address of the risk assessment contract
     * @param _trustedEncryptionOracleAddress Address of the encryption oracle
     */
    function registerProtocolAddresses(
        address _lendingPoolAddress,
        address _riskAssessmentAddress,
        address _trustedEncryptionOracleAddress
    ) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        lendingPoolAddress = _lendingPoolAddress;
        riskAssessmentAddress = _riskAssessmentAddress;
        trustedEncryptionOracleAddress = _trustedEncryptionOracleAddress;
    }
    
    /**
     * @dev Register a zero-knowledge proof verifier
     * @param proofType Type of proof this verifier handles
     * @param verifierAddress Address of the verifier contract
     */
    function registerVerifier(string calldata proofType, address verifierAddress) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        require(verifierAddress != address(0), "Invalid verifier address");
        verifierRegistry[proofType] = verifierAddress;
        
        emit VerifierRegistered(
            proofType,
            verifierAddress,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Send a standard message from L2 (EVM) to L1 (Move)
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
        // Check message size
        require(payload.length <= maxMessageSize, "Message too large");
        
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
        
        // Create message struct
        BridgeMessage storage newMessage = messages[messageId];
        newMessage.messageId = messageId;
        newMessage.sender = msg.sender;
        newMessage.targetAddress = targetAddress;
        newMessage.payload = payload;
        newMessage.timestamp = block.timestamp;
        newMessage.status = MessageStatus.Pending;
        newMessage.direction = MessageDirection.L2ToL1;
        newMessage.messageType = messageType;
        newMessage.gasLimit = gasLimit;
        newMessage.fee = msg.value;
        newMessage.isPrivate = false;
        newMessage.expiryTime = block.timestamp + messageTimeout;
        newMessage.confirmationCount = 0;
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL2ToL1++;
        
        // Emit event
        emit MessageSent(
            messageId,
            msg.sender,
            targetAddress,
            messageType,
            block.timestamp,
            MessageDirection.L2ToL1,
            false
        );
        
        return messageId;
    }
    
    /**
     * @dev Send a private message with encrypted payload from L2 to L1
     * @param targetAddress The address on L1 to receive the message
     * @param messageType The type of message
     * @param encryptedPayload The encrypted message payload
     * @param gasLimit Gas limit for the message execution on L1
     * @return messageId The ID of the sent message
     */
    function sendPrivateMessageToL1(
        bytes32 targetAddress,
        string calldata messageType,
        bytes calldata encryptedPayload,
        uint256 gasLimit
    ) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 messageId) 
    {
        // Check message size
        require(encryptedPayload.length <= maxMessageSize + maxEncryptionOverhead, "Message too large");
        
        // Calculate fee with privacy premium
        uint256 requiredFee = (baseFee * privateFeeMultiplier) + 
                             (feePerByte * encryptedPayload.length * privateFeeMultiplier);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            msg.sender,
            targetAddress,
            messageType,
            encryptedPayload,
            block.timestamp,
            totalMessagesL2ToL1
        ));
        
        // Create message struct
        BridgeMessage storage newMessage = messages[messageId];
        newMessage.messageId = messageId;
        newMessage.sender = msg.sender;
        newMessage.targetAddress = targetAddress;
        newMessage.encryptedPayload = encryptedPayload;
        newMessage.timestamp = block.timestamp;
        newMessage.status = MessageStatus.Pending;
        newMessage.direction = MessageDirection.L2ToL1;
        newMessage.messageType = messageType;
        newMessage.gasLimit = gasLimit;
        newMessage.fee = msg.value;
        newMessage.isPrivate = true;
        newMessage.expiryTime = block.timestamp + messageTimeout;
        newMessage.confirmationCount = 0;
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL2ToL1++;
        totalPrivateMessages++;
        
        // Emit event
        emit MessageSent(
            messageId,
            msg.sender,
            targetAddress,
            messageType,
            block.timestamp,
            MessageDirection.L2ToL1,
            true
        );
        
        return messageId;
    }
    
    /**
     * @dev Submit a zero-knowledge proof for a message
     * @param messageId The message ID the proof is associated with
     * @param proofType The type of proof being submitted
     * @param proof The zero-knowledge proof data
     * @param publicInputHash Hash of the public inputs to the proof
     * @return proofId The ID of the submitted proof
     */
    function submitZKProof(
        bytes32 messageId,
        string calldata proofType,
        bytes calldata proof,
        bytes32 publicInputHash
    ) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 proofId) 
    {
        // Verify the message exists
        require(messages[messageId].messageId == messageId, "Message not found");
        
        // Verify fee
        require(msg.value >= zkProofVerificationFee, "Insufficient verification fee");
        
        // Verify a verifier exists for this proof type
        require(verifierRegistry[proofType] != address(0), "No verifier for proof type");
        
        // Generate proof ID
        proofId = keccak256(abi.encodePacked(
            messageId,
            proofType,
            proof,
            publicInputHash,
            block.timestamp,
            msg.sender
        ));
        
        // Store the proof
        ZKProof storage newProof = zkProofs[proofId];
        newProof.proofId = proofId;
        newProof.verifier = verifierRegistry[proofType];
        newProof.proof = proof;
        newProof.messageId = messageId;
        newProof.verified = false;
        newProof.timestamp = block.timestamp;
        newProof.proofType = proofType;
        newProof.publicInputHash = publicInputHash;
        
        // Update message with proof reference
        messages[messageId].zkProofId = proofId;
        
        // Add to tracking
        allProofIds.push(proofId);
        totalZKProofs++;
        
        emit ProofSubmitted(
            proofId,
            messageId,
            msg.sender,
            proofType,
            block.timestamp
        );
        
        // Try to verify the proof immediately
        bool verified = _verifyProof(proofId, proofType, proof, publicInputHash);
        
        if (verified) {
            newProof.verified = true;
            totalVerifiedProofs++;
            
            emit ProofVerified(
                proofId,
                messageId,
                newProof.verifier,
                true,
                block.timestamp
            );
        }
        
        return proofId;
    }
    
    /**
     * @dev Verify a proof that was previously submitted
     * @param proofId The ID of the proof to verify
     */
    function verifyPendingProof(bytes32 proofId) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(ZK_VERIFIER_ROLE) 
    {
        ZKProof storage proof = zkProofs[proofId];
        
        // Verify the proof exists and is not already verified
        require(proof.proofId == proofId, "Proof not found");
        require(!proof.verified, "Proof already verified");
        
        // Verify the proof
        bool verified = _verifyProof(
            proofId, 
            proof.proofType, 
            proof.proof, 
            proof.publicInputHash
        );
        
        if (verified) {
            proof.verified = true;
            totalVerifiedProofs++;
            
            // If associated with a message, update message status
            if (proof.messageId != bytes32(0)) {
                BridgeMessage storage message = messages[proof.messageId];
                if (message.messageId == proof.messageId) {
                    message.status = MessageStatus.Verified;
                }
                
                // If this is a risk assessment proof, update user risk data
                if (keccak256(bytes(proof.proofType)) == keccak256(bytes("RISK_ASSESSMENT"))) {
                    // Extract user address from the proof data
                    address user = _extractUserFromProof(proof.proof);
                    
                    if (user != address(0)) {
                        // Update user risk data
                        UserRiskData storage userData = userRiskData[user];
                        userData.user = user;
                        userData.riskScoreCommitment = uint256(proof.publicInputHash);
                        userData.lastUpdate = block.timestamp;
                        userData.hasValidProof = true;
                        
                        emit RiskDataUpdated(
                            user,
                            uint256(proof.publicInputHash),
                            true,
                            block.timestamp
                        );
                    }
                }
            }
            
            emit ProofVerified(
                proofId,
                proof.messageId,
                msg.sender,
                true,
                block.timestamp
            );
        }
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
        // Check message size
        require(payload.length <= maxMessageSize, "Message too large");
        
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
        
        // Create message struct
        BridgeMessage storage newMessage = messages[messageId];
        newMessage.messageId = messageId;
        newMessage.sender = address(uint160(uint256(sender))); // Convert bytes32 to address
        newMessage.targetAddress = bytes32(0); // No target for L1->L2, processed immediately
        newMessage.payload = payload;
        newMessage.timestamp = block.timestamp;
        newMessage.status = MessageStatus.Processed;
        newMessage.direction = MessageDirection.L1ToL2;
        newMessage.messageType = messageType;
        newMessage.gasLimit = 0;
        newMessage.fee = 0;
        newMessage.isPrivate = false;
        newMessage.expiryTime = 0; // No expiry for already processed messages
        newMessage.confirmationCount = minConfirmations; // Already confirmed
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL1ToL2++;
        totalProcessedMessages++;
        
        // Execute the message based on type
        bool success = _executeMessage(messageType, payload);
        
        // Update status if failed
        if (!success) {
            newMessage.status = MessageStatus.Failed;
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
     * @dev Process a private message from L1 to L2
     * @param sender The L1 address that sent the message
     * @param messageType The type of message
     * @param encryptedPayload The encrypted message payload
     * @param l1Timestamp Timestamp from the L1 chain
     * @param signature Signature from the oracle validating this message
     * @return messageId The ID of the processed message
     */
    function processPrivateMessageFromL1(
        bytes32 sender,
        string calldata messageType,
        bytes calldata encryptedPayload,
        uint256 l1Timestamp,
        bytes calldata signature
    ) 
        external 
        onlyRole(RELAYER_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 messageId) 
    {
        // Check message size
        require(encryptedPayload.length <= maxMessageSize + maxEncryptionOverhead, "Message too large");
        
        // Generate message hash
        messageId = keccak256(abi.encodePacked(
            sender,
            messageType,
            encryptedPayload,
            l1Timestamp
        ));
        
        // Prevent replay
        require(!processedL1Messages[messageId], "Message already processed");
        
        // Verify oracle signature
        require(_verifySignature(messageId, signature), "Invalid signature");
        
        // Mark as processed
        processedL1Messages[messageId] = true;
        
        // Create message struct
        BridgeMessage storage newMessage = messages[messageId];
        newMessage.messageId = messageId;
        newMessage.sender = address(uint160(uint256(sender))); // Convert bytes32 to address
        newMessage.targetAddress = bytes32(0);
        newMessage.encryptedPayload = encryptedPayload;
        newMessage.timestamp = block.timestamp;
        newMessage.status = MessageStatus.Pending; // Private messages need decryption before processing
        newMessage.direction = MessageDirection.L1ToL2;
        newMessage.messageType = messageType;
        newMessage.gasLimit = 0;
        newMessage.fee = 0;
        newMessage.isPrivate = true;
        newMessage.expiryTime = block.timestamp + messageTimeout;
        newMessage.confirmationCount = minConfirmations; // Already confirmed by oracle
        
        // Add to tracking
        allMessageIds.push(messageId);
        totalMessagesL1ToL2++;
        totalPrivateMessages++;
        
        emit MessageSent(
            messageId,
            address(uint160(uint256(sender))),
            bytes32(0),
            messageType,
            block.timestamp,
            MessageDirection.L1ToL2,
            true
        );
        
        return messageId;
    }
    
    /**
     * @dev Decrypt and process a private message
     * @param messageId The ID of the private message
     * @param decryptedPayload The decrypted payload from the encryption oracle
     * @param oracleSignature Signature from the encryption oracle verifying the decryption
     */
    function processDecryptedMessage(
        bytes32 messageId,
        bytes calldata decryptedPayload,
        bytes calldata oracleSignature
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(ORACLE_ROLE) 
    {
        BridgeMessage storage message = messages[messageId];
        
        // Verify message exists and is private
        require(message.messageId == messageId, "Message not found");
        require(message.isPrivate, "Not a private message");
        require(message.status == MessageStatus.Pending, "Message not pending");
        
        // For L1->L2 messages, verify the encryption oracle signature
        if (message.direction == MessageDirection.L1ToL2) {
            bytes32 decryptionHash = keccak256(abi.encodePacked(messageId, decryptedPayload));
            address signer = decryptionHash.toEthSignedMessageHash().recover(oracleSignature);
            require(signer == trustedEncryptionOracleAddress, "Invalid decryption oracle signature");
            
            // Store the decrypted payload
            message.payload = decryptedPayload;
            
            // Execute the message
            bool success = _executeMessage(message.messageType, decryptedPayload);
            
            // Update status
            if (success) {
                message.status = MessageStatus.Processed;
                totalProcessedMessages++;
            } else {
                message.status = MessageStatus.Failed;
                totalFailedMessages++;
            }
            
            // Emit event
            emit MessageProcessed(
                messageId,
                msg.sender,
                block.timestamp,
                success
            );
        }
        // For L2->L1 messages, we're just storing the decrypted payload for confirmation
        else {
            // Just decrypt and store in preparation for confirmation
            message.payload = decryptedPayload;
        }
    }
    
    /**
     * @dev Add confirmation for a L2->L1 message from an oracle
     * @param messageId The ID of the message
     * @param signature The oracle's signature
     */
    function confirmMessage(bytes32 messageId, bytes calldata signature) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(ORACLE_ROLE) 
    {
        BridgeMessage storage message = messages[messageId];
        
        // Verify message exists and is pending
        require(message.messageId == messageId, "Message not found");
        require(message.status == MessageStatus.Pending || message.status == MessageStatus.Verified, "Message not pending or verified");
        require(message.direction == MessageDirection.L2ToL1, "Wrong message direction");
        
        // Verify this oracle hasn't already confirmed
        require(!message.confirmations[msg.sender], "Already confirmed by this oracle");
        
        // Verify signature
        bytes32 confirmationHash = keccak256(abi.encodePacked(messageId));
        address signer = confirmationHash.toEthSignedMessageHash().recover(signature);
        require(signer == msg.sender, "Invalid signature");
        
        // Add confirmation
        message.confirmations[msg.sender] = true;
        message.confirmationCount++;
        
        // Emit event
        emit MessageConfirmed(
            messageId,
            msg.sender,
            block.timestamp,
            message.confirmationCount
        );
        
        // If we've reached the required confirmations, update status to processed
        if (message.confirmationCount >= minConfirmations && message.status != MessageStatus.Processed) {
            message.status = MessageStatus.Processed;
            totalProcessedMessages++;
            
            emit MessageProcessed(
                messageId,
                msg.sender,
                block.timestamp,
                true
            );
        }
    }
    
    /**
     * @dev Notify that a L2->L1 message failed on L1
     * @param messageId The ID of the message
     * @param signature The oracle's signature
     */
    function notifyMessageFailure(bytes32 messageId, bytes calldata signature) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(ORACLE_ROLE) 
    {
        BridgeMessage storage message = messages[messageId];
        
        // Verify message exists and is not already failed
        require(message.messageId == messageId, "Message not found");
        require(message.status != MessageStatus.Failed, "Message already failed");
        require(message.direction == MessageDirection.L2ToL1, "Wrong message direction");
        
        // Verify signature
        bytes32 failureHash = keccak256(abi.encodePacked(messageId, "FAILURE"));
        address signer = failureHash.toEthSignedMessageHash().recover(signature);
        require(signer == msg.sender, "Invalid signature");
        
        // Update status
        message.status = MessageStatus.Failed;
        totalFailedMessages++;
        
        // Refund fees for failed messages
        payable(message.sender).transfer(message.fee);
        
        // Emit event
        emit MessageProcessed(
            messageId,
            msg.sender,
            block.timestamp,
            false
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
        require(message.sender == msg.sender || hasRole(BRIDGE_ADMIN_ROLE, msg.sender), "Not authorized");
        
        // Verify message has timed out (or allow admin to cancel any time)
        require(
            block.timestamp > message.expiryTime || 
            hasRole(BRIDGE_ADMIN_ROLE, msg.sender), 
            "Message not timed out"
        );
        
        // Update message status
        message.status = MessageStatus.Canceled;
        
        // Refund fees (minus a processing fee)
        uint256 refundAmount = message.fee * 9 / 10; // 90% refund
        payable(message.sender).transfer(refundAmount);
        
        // Emit event
        emit MessageCanceled(
            messageId,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Get message details
     * @param messageId The ID of the message
     * @return sender The sender address
     * @return timestamp The timestamp when the message was sent
     * @return status The status of the message
     * @return direction The direction of the message
     * @return messageType The type of message
     * @return isPrivate Whether the message is private
     * @return confirmationCount The number of confirmations
     */
    function getMessageDetails(bytes32 messageId) 
        external 
        view 
        returns (
            address sender,
            uint256 timestamp,
            MessageStatus status,
            MessageDirection direction,
            string memory messageType,
            bool isPrivate,
            uint256 confirmationCount
        ) 
    {
        BridgeMessage storage message = messages[messageId];
        require(message.messageId == messageId, "Message not found");
        
        return (
            message.sender,
            message.timestamp,
            message.status,
            message.direction,
            message.messageType,
            message.isPrivate,
            message.confirmationCount
        );
    }
    
    /**
     * @dev Get proof details
     * @param proofId The ID of the proof
     * @return messageId The associated message ID
     * @return verifier The address of the verifier
     * @return timestamp The timestamp when the proof was submitted
     * @return proofType The type of proof
     * @return verified Whether the proof has been verified
     */
    function getProofDetails(bytes32 proofId) 
        external 
        view 
        returns (
            bytes32 messageId,
            address verifier,
            uint256 timestamp,
            string memory proofType,
            bool verified
        ) 
    {
        ZKProof storage proof = zkProofs[proofId];
        require(proof.proofId == proofId, "Proof not found");
        
        return (
            proof.messageId,
            proof.verifier,
            proof.timestamp,
            proof.proofType,
            proof.verified
        );
    }
    
    /**
     * @dev Get user risk data
     * @param user The user address
     * @return riskScoreCommitment The committed risk score
     * @return lastUpdate The timestamp of the last update
     * @return hasValidProof Whether the user has a valid proof
     */
    function getUserRiskData(address user) 
        external 
        view 
        returns (
            uint256 riskScoreCommitment,
            uint256 lastUpdate,
            bool hasValidProof
        ) 
    {
        UserRiskData storage userData = userRiskData[user];
        
        return (
            userData.riskScoreCommitment,
            userData.lastUpdate,
            userData.hasValidProof
        );
    }
    
    /**
     * @dev Update fee parameters
     * @param newBaseFee The new base fee
     * @param newFeePerByte The new fee per byte
     * @param newPrivateFeeMultiplier The new multiplier for private messages
     * @param newZKProofVerificationFee The new fee for ZK proof verification
     */
    function updateFees(
        uint256 newBaseFee, 
        uint256 newFeePerByte,
        uint256 newPrivateFeeMultiplier,
        uint256 newZKProofVerificationFee
    ) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        baseFee = newBaseFee;
        feePerByte = newFeePerByte;
        privateFeeMultiplier = newPrivateFeeMultiplier;
        zkProofVerificationFee = newZKProofVerificationFee;
        
        emit FeeUpdated(
            newBaseFee,
            newFeePerByte,
            newPrivateFeeMultiplier,
            newZKProofVerificationFee,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Update security parameters
     * @param newMinConfirmations The new minimum confirmations
     * @param newMessageTimeout The new message timeout
     * @param newMaxMessageSize The new maximum message size
     */
    function updateSecurityParams(
        uint256 newMinConfirmations, 
        uint256 newMessageTimeout,
        uint256 newMaxMessageSize
    ) 
        external 
        onlyRole(BRIDGE_ADMIN_ROLE) 
    {
        minConfirmations = newMinConfirmations;
        messageTimeout = newMessageTimeout;
        maxMessageSize = newMaxMessageSize;
        
        emit SecurityParamsUpdated(
            newMinConfirmations,
            newMessageTimeout,
            newMaxMessageSize,
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
     * @dev Get protocol statistics
     * @return Total messages, processed, failed, private messages, ZK proofs, verified proofs
     */
    function getStats() 
        external 
        view 
        returns (
            uint256 totalMessages,
            uint256 processedMessages,
            uint256 failedMessages,
            uint256 privateMessagesCount,
            uint256 zkProofsCount,
            uint256 verifiedProofsCount
        ) 
    {
        return (
            totalMessagesL2ToL1 + totalMessagesL1ToL2,
            totalProcessedMessages,
            totalFailedMessages,
            totalPrivateMessages,
            totalZKProofs,
            totalVerifiedProofs
        );
    }
    
    /**
     * @dev Get message IDs by sender
     * @param sender The sender address
     * @return ids Array of message IDs
     */
    function getMessageIdsBySender(address sender) 
        external 
        view 
        returns (bytes32[] memory) 
    {
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
     * @dev Get proof IDs by user
     * @param user The user address
     * @return ids Array of proof IDs
     */
    function getProofIdsByUser(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        uint256 count = 0;
        
        // Count proofs associated with this user's messages
        for (uint256 i = 0; i < allProofIds.length; i++) {
            bytes32 messageId = zkProofs[allProofIds[i]].messageId;
            if (messageId != bytes32(0) && messages[messageId].sender == user) {
                count++;
            }
        }
        
        // Create array of the right size
        bytes32[] memory userProofIds = new bytes32[](count);
        
        // Fill array
        uint256 index = 0;
        for (uint256 i = 0; i < allProofIds.length; i++) {
            bytes32 messageId = zkProofs[allProofIds[i]].messageId;
            if (messageId != bytes32(0) && messages[messageId].sender == user) {
                userProofIds[index] = allProofIds[i];
                index++;
            }
        }
        
        return userProofIds;
    }
    
    /**
     * @dev Verify a signature from an oracle
     * @param messageHash The hash of the message
     * @param signature The signature
     * @return Whether the signature is valid
     */
    function _verifySignature(bytes32 messageHash, bytes calldata signature) 
        internal 
        view 
        returns (bool) 
    {
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        return hasRole(ORACLE_ROLE, signer);
    }
    
    /**
     * @dev Verify a zero-knowledge proof
     * @param proofId The ID of the proof
     * @param proofType The type of proof
     * @param proof The proof data
     * @param publicInputHash Hash of the public inputs
     * @return Whether the proof is valid
     */
    function _verifyProof(
        bytes32 proofId, 
        string memory proofType, 
        bytes memory proof, 
        bytes32 publicInputHash
    ) 
        internal 
        returns (bool) 
    {
        // Get the verifier contract for this proof type
        address verifier = verifierRegistry[proofType];
        if (verifier == address(0)) {
            return false;
        }
        
        // Verify the proof using the appropriate verifier
        // This is a simplified implementation; in a real system we would call
        // the specific verifier contract with the appropriate interface
        
        // For RISK_ASSESSMENT proofs
        if (keccak256(bytes(proofType)) == keccak256(bytes("RISK_ASSESSMENT"))) {
            // Call the risk assessment verifier
            (bool success, bytes memory result) = verifier.call(
                abi.encodeWithSignature(
                    "verifyRiskProof(bytes32,bytes,bytes32)",
                    proofId,
                    proof,
                    publicInputHash
                )
            );
            
            if (success && result.length > 0) {
                return abi.decode(result, (bool));
            }
        }
        // For IDENTITY_VERIFICATION proofs
        else if (keccak256(bytes(proofType)) == keccak256(bytes("IDENTITY_VERIFICATION"))) {
            // Call the identity verification verifier
            (bool success, bytes memory result) = verifier.call(
                abi.encodeWithSignature(
                    "verifyIdentityProof(bytes32,bytes,bytes32)",
                    proofId,
                    proof,
                    publicInputHash
                )
            );
            
            if (success && result.length > 0) {
                return abi.decode(result, (bool));
            }
        }
        // For CREDIT_SCORE proofs
        else if (keccak256(bytes(proofType)) == keccak256(bytes("CREDIT_SCORE"))) {
            // Call the credit score verifier
            (bool success, bytes memory result) = verifier.call(
                abi.encodeWithSignature(
                    "verifyCreditScoreProof(bytes32,bytes,bytes32)",
                    proofId,
                    proof,
                    publicInputHash
                )
            );
            
            if (success && result.length > 0) {
                return abi.decode(result, (bool));
            }
        }
        
        // Default to false for unknown proof types or failed verification
        return false;
    }
    
    /**
     * @dev Execute a message from L1 based on its type
     * @param messageType The type of message
     * @param payload The message payload
     * @return success Whether the execution was successful
     */
    function _executeMessage(string memory messageType, bytes memory payload) 
        internal 
        returns (bool) 
    {
        // RISK_SCORE_UPDATE: Update user risk score in the lending pool
        if (keccak256(bytes(messageType)) == keccak256(bytes("RISK_SCORE_UPDATE"))) {
            // Extract user address and risk score from payload
            (address user, uint256 score) = abi.decode(payload, (address, uint256));
            
            // Call the risk assessment contract or lending pool to update the score
            if (lendingPoolAddress != address(0)) {
                // This would call the LendingPool.updateRiskScore function
                (bool success,) = lendingPoolAddress.call(
                    abi.encodeWithSignature(
                        "updateRiskScore(address,uint256)",
                        user,
                        score
                    )
                );
                return success;
            }
        }
        // ASSET_TRANSFER: Process a cross-chain asset transfer
        else if (keccak256(bytes(messageType)) == keccak256(bytes("ASSET_TRANSFER"))) {
            // Extract transfer details from payload
            (address recipient, address token, uint256 amount) = abi.decode(
                payload, 
                (address, address, uint256)
            );
            
            // This would call the appropriate asset transfer function
            // Implementation depends on the specific token and transfer mechanism
            return true;
        }
        // COLLATERAL_CHANGE: Process a collateral status change
        else if (keccak256(bytes(messageType)) == keccak256(bytes("COLLATERAL_CHANGE"))) {
            // Extract details from payload
            (address user, uint256 collateralAmount) = abi.decode(payload, (address, uint256));
            
            // Update collateral in the lending pool
            if (lendingPoolAddress != address(0)) {
                // This would call the appropriate function in the lending pool
                (bool success,) = lendingPoolAddress.call(
                    abi.encodeWithSignature(
                        "updateCollateralFromL1(address,uint256)",
                        user,
                        collateralAmount
                    )
                );
                return success;
            }
        }
        // IDENTITY_VERIFICATION: Process identity verification
        else if (keccak256(bytes(messageType)) == keccak256(bytes("IDENTITY_VERIFICATION"))) {
            // Extract details from payload
            (address user, uint256 verificationLevel) = abi.decode(payload, (address, uint256));
            
            // Update user verification level
            if (riskAssessmentAddress != address(0)) {
                (bool success,) = riskAssessmentAddress.call(
                    abi.encodeWithSignature(
                        "updateVerificationLevel(address,uint256)",
                        user,
                        verificationLevel
                    )
                );
                return success;
            }
        }
        // LIQUIDATION: Process liquidation notification
        else if (keccak256(bytes(messageType)) == keccak256(bytes("LIQUIDATION"))) {
            // Extract details from payload
            (address borrower, uint256 repayAmount, uint256 collateralSeized) = abi.decode(
                payload, 
                (address, uint256, uint256)
            );
            
            // Process liquidation
            if (lendingPoolAddress != address(0)) {
                (bool success,) = lendingPoolAddress.call(
                    abi.encodeWithSignature(
                        "processLiquidationFromL1(address,uint256,uint256)",
                        borrower,
                        repayAmount,
                        collateralSeized
                    )
                );
                return success;
            }
        }
        
        // Default to true for unknown message types
        // This helps prevent messages from getting stuck
        return true;
    }
    
    /**
     * @dev Extract user address from proof data (simplified implementation)
     * @param proof The proof data
     * @return user The extracted user address
     */
    function _extractUserFromProof(bytes memory proof) 
        internal 
        pure 
        returns (address) 
    {
        // This is a simplified implementation
        // In a real system, the user address would be extracted based on the specific
        // proof format and verification mechanism
        
        if (proof.length >= 20) {
            address user;
            assembly {
                user := mload(add(proof, 20))
            }
            return user;
        }
        
        return address(0);
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

/**
 * Interface for a zero-knowledge proof verifier
 */
interface IZKVerifier {
    function verifyRiskProof(bytes32 proofId, bytes calldata proof, bytes32 publicInputHash) 
        external returns (bool);
        
    function verifyIdentityProof(bytes32 proofId, bytes calldata proof, bytes32 publicInputHash)
        external returns (bool);
        
    function verifyCreditScoreProof(bytes32 proofId, bytes calldata proof, bytes32 publicInputHash)
        external returns (bool);
}
