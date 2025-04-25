// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title ZKBridge - Enhanced Cross-Layer Bridge with ZK-Rollups
 * @dev Facilitates secure communication between IOTA EVM Layer 2 and Move Layer 1
 * using zero-knowledge proofs and rollup batching for efficiency
 */
contract ZKBridge is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;
    
    // Constants
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant FINALITY_BLOCKS = 12;
    
    // Roles
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant BATCH_FINALIZER_ROLE = keccak256("BATCH_FINALIZER_ROLE");
    
    // State variables
    struct Message {
        address sender;
        bytes32 targetAddress; // Move address (Layer 1)
        string messageType;
        bytes payload;
        uint256 timestamp;
        bool processed;
        uint256 nonce;
        bytes signature;
        bytes32 zkProofHash; // Hash of the ZK proof
    }
    
    struct Batch {
        bytes32 merkleRoot;
        uint256 batchIndex;
        uint256 timestamp;
        uint256 messageCount;
        bool finalized;
        bytes zkProof; // ZK proof for the entire batch
        bytes32 commitmentHash; // Commitment to batch state
    }
    
    // Rollup state
    uint256 public batchCount;
    uint256 public messageCount;
    mapping(uint256 => Batch) public batches;
    mapping(bytes32 => Message) public messages;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public processedMessages;
    
    // Layer 1 Addresses
    mapping(address => bytes32) public l2ToL1AddressMapping;
    
    // Events
    event MessageSent(
        bytes32 indexed messageId,
        address indexed sender,
        bytes32 indexed targetAddress,
        string messageType,
        uint256 nonce,
        uint256 timestamp
    );
    
    event BatchFinalized(
        uint256 indexed batchIndex,
        bytes32 merkleRoot,
        uint256 messageCount,
        bytes32 commitmentHash
    );
    
    event MessageProcessed(
        bytes32 indexed messageId,
        uint256 indexed batchIndex,
        uint256 timestamp,
        bool success
    );
    
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    
    // Errors
    error InvalidSignature();
    error InvalidMerkleProof();
    error MessageAlreadyProcessed();
    error BatchNotFinalized();
    error InvalidBatchIndex();
    error InvalidThreshold();
    error NotValidator();
    error InvalidZKProof();
    
    /**
     * @dev Constructor
     * @param _validators Initial set of validators
     * @param _relayers Initial set of relayers
     */
    constructor(address[] memory _validators, address[] memory _relayers) {
        // Set up admin role
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Set up validators
        for (uint256 i = 0; i < _validators.length; i++) {
            _setupRole(VALIDATOR_ROLE, _validators[i]);
            emit ValidatorAdded(_validators[i]);
        }
        
        // Set up relayers
        for (uint256 i = 0; i < _relayers.length; i++) {
            _setupRole(RELAYER_ROLE, _relayers[i]);
        }
        
        // Set up batch finalizers (initially validators)
        for (uint256 i = 0; i < _validators.length; i++) {
            _setupRole(BATCH_FINALIZER_ROLE, _validators[i]);
        }
    }
    
    /**
     * @dev Register a Layer 1 address mapping
     * @param _l1Address Layer 1 (Move) address
     */
    function registerL1Address(bytes32 _l1Address) external {
        l2ToL1AddressMapping[msg.sender] = _l1Address;
    }
    
    /**
     * @dev Send a message from Layer 2 to Layer 1
     * @param _targetAddress Target address on Layer 1
     * @param _messageType Type of message
     * @param _payload Message payload
     * @param _zkProof Zero-knowledge proof to validate the data
     * @return messageId Unique identifier for the message
     */
    function sendMessageToL1(
        bytes32 _targetAddress,
        string calldata _messageType,
        bytes calldata _payload,
        bytes calldata _zkProof
    ) 
        external 
        nonReentrant 
        returns (bytes32 messageId) 
    {
        // Increment sender's nonce
        uint256 nonce = nonces[msg.sender]++;
        
        // Generate message ID
        messageId = generateMessageId(msg.sender, _targetAddress, nonce);
        
        // Hash the ZK proof
        bytes32 zkProofHash = keccak256(_zkProof);
        
        // Create and store the message
        Message memory message = Message({
            sender: msg.sender,
            targetAddress: _targetAddress,
            messageType: _messageType,
            payload: _payload,
            timestamp: block.timestamp,
            processed: false,
            nonce: nonce,
            signature: new bytes(0), // Will be added when batching
            zkProofHash: zkProofHash
        });
        
        messages[messageId] = message;
        messageCount++;
        
        // Emit event
        emit MessageSent(
            messageId,
            msg.sender,
            _targetAddress,
            _messageType,
            nonce,
            block.timestamp
        );
        
        return messageId;
    }
    
    /**
     * @dev Finalize a batch of messages with a ZK proof
     * @param _messageIds Array of message IDs to include in the batch
     * @param _zkProof Zero-knowledge proof for the entire batch
     * @param _commitmentHash Commitment to the batch state
     * @return batchIndex Index of the created batch
     */
    function finalizeBatch(
        bytes32[] calldata _messageIds,
        bytes calldata _zkProof,
        bytes32 _commitmentHash
    ) 
        external 
        nonReentrant 
        onlyRole(BATCH_FINALIZER_ROLE) 
        returns (uint256 batchIndex) 
    {
        // Check batch size
        require(_messageIds.length > 0 && _messageIds.length <= MAX_BATCH_SIZE, "Invalid batch size");
        
        // Create merkle tree from message IDs
        bytes32 merkleRoot = computeMerkleRoot(_messageIds);
        
        // Create new batch
        batchIndex = batchCount++;
        Batch storage batch = batches[batchIndex];
        batch.merkleRoot = merkleRoot;
        batch.batchIndex = batchIndex;
        batch.timestamp = block.timestamp;
        batch.messageCount = _messageIds.length;
        batch.finalized = true;
        batch.zkProof = _zkProof;
        batch.commitmentHash = _commitmentHash;
        
        // Mark messages as processed
        for (uint256 i = 0; i < _messageIds.length; i++) {
            bytes32 messageId = _messageIds[i];
            Message storage message = messages[messageId];
            message.processed = true;
        }
        
        // Emit event
        emit BatchFinalized(
            batchIndex,
            merkleRoot,
            _messageIds.length,
            _commitmentHash
        );
        
        return batchIndex;
    }
    
    /**
     * @dev Verify a message is in a batch using a Merkle proof
     * @param _messageId ID of the message to verify
     * @param _batchIndex Index of the batch
     * @param _merkleProof Merkle proof
     * @return True if message is in the batch
     */
    function verifyMessageInBatch(
        bytes32 _messageId,
        uint256 _batchIndex,
        bytes32[] calldata _merkleProof
    ) 
        external 
        view 
        returns (bool) 
    {
        if (_batchIndex >= batchCount) {
            revert InvalidBatchIndex();
        }
        
        Batch storage batch = batches[_batchIndex];
        if (!batch.finalized) {
            revert BatchNotFinalized();
        }
        
        return MerkleProof.verify(_merkleProof, batch.merkleRoot, _messageId);
    }
    
    /**
     * @dev Verify a zero-knowledge proof
     * @param _messageId Message ID
     * @param _batchIndex Batch index
     * @param _proof Zero-knowledge proof
     * @return True if the proof is valid
     */
    function verifyZKProof(
        bytes32 _messageId,
        uint256 _batchIndex,
        bytes calldata _proof
    ) 
        external 
        view 
        returns (bool) 
    {
        if (_batchIndex >= batchCount) {
            revert InvalidBatchIndex();
        }
        
        Batch storage batch = batches[_batchIndex];
        if (!batch.finalized) {
            revert BatchNotFinalized();
        }
        
        // In a real implementation, this would use a ZK verification library
        // For this example, we're doing a simplified check
        bytes32 proofHash = keccak256(_proof);
        bytes32 batchProofHash = keccak256(batch.zkProof);
        
        // Verify this proof is consistent with the batch proof
        return keccak256(abi.encodePacked(proofHash, _messageId)) == batchProofHash;
    }
    
    /**
     * @dev Process a message from Layer 1 to Layer 2
     * @param _messageId ID of the message
     * @param _l1Sender Sender address on Layer 1
     * @param _payload Message payload
     * @param _signature Signature from Layer 1 validator
     * @param _zkProof Zero-knowledge proof
     */
    function processMessageFromL1(
        bytes32 _messageId,
        bytes32 _l1Sender,
        bytes calldata _payload,
        bytes calldata _signature,
        bytes calldata _zkProof
    ) 
        external 
        nonReentrant 
        onlyRole(RELAYER_ROLE)
    {
        // Check if message is already processed
        if (processedMessages[_messageId]) {
            revert MessageAlreadyProcessed();
        }
        
        // Verify signature (would be from a Layer 1 validator)
        bytes32 messageHash = keccak256(abi.encodePacked(_messageId, _l1Sender, _payload));
        address signer = recoverSigner(messageHash, _signature);
        
        if (!hasRole(VALIDATOR_ROLE, signer)) {
            revert NotValidator();
        }
        
        // Verify ZK proof (in a real implementation, this would use a ZK verification library)
        if (!verifyL1ZKProof(_messageId, _payload, _zkProof)) {
            revert InvalidZKProof();
        }
        
        // Mark message as processed
        processedMessages[_messageId] = true;
        
        // Execute message processing logic
        // This would typically call a hook or forward to a target contract
        // For this example, we just emit an event
        emit MessageProcessed(
            _messageId,
            0, // No batch for L1->L2 messages in this example
            block.timestamp,
            true
        );
    }
    
    /**
     * @dev Generate a unique message ID
     * @param _sender Sender address
     * @param _targetAddress Target address
     * @param _nonce Nonce
     * @return messageId Unique identifier
     */
    function generateMessageId(
        address _sender,
        bytes32 _targetAddress,
        uint256 _nonce
    ) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(_sender, _targetAddress, _nonce));
    }
    
    /**
     * @dev Compute Merkle root from an array of message IDs
     * @param _messageIds Array of message IDs
     * @return merkleRoot The computed Merkle root
     */
    function computeMerkleRoot(bytes32[] calldata _messageIds) 
        internal 
        pure 
        returns (bytes32 merkleRoot) 
    {
        // For simplicity, we're using a naive approach
        // In a production environment, this would use a proper Merkle tree implementation
        bytes32[] memory leaves = new bytes32[](_messageIds.length);
        for (uint256 i = 0; i < _messageIds.length; i++) {
            leaves[i] = _messageIds[i];
        }
        
        while (leaves.length > 1) {
            if (leaves.length % 2 == 1) {
                // If odd number of leaves, duplicate the last one
                bytes32[] memory newLeaves = new bytes32[](leaves.length + 1);
                for (uint256 i = 0; i < leaves.length; i++) {
                    newLeaves[i] = leaves[i];
                }
                newLeaves[leaves.length] = leaves[leaves.length - 1];
                leaves = newLeaves;
            }
            
            bytes32[] memory nextLevel = new bytes32[](leaves.length / 2);
            for (uint256 i = 0; i < leaves.length / 2; i++) {
                nextLevel[i] = keccak256(abi.encodePacked(leaves[i * 2], leaves[i * 2 + 1]));
            }
            
            leaves = nextLevel;
        }
        
        return leaves[0];
    }
    
    /**
     * @dev Recover signer from signature
     * @param _hash Hash that was signed
     * @param _signature Signature
     * @return Signer address
     */
    function recoverSigner(bytes32 _hash, bytes memory _signature) 
        internal 
        pure 
        returns (address) 
    {
        bytes32 messageHash = _hash.toEthSignedMessageHash();
        return messageHash.recover(_signature);
    }
    
    /**
     * @dev Verify a zero-knowledge proof from Layer 1
     * @param _messageId Message ID
     * @param _payload Message payload
     * @param _zkProof Zero-knowledge proof
     * @return True if proof is valid
     */
    function verifyL1ZKProof(
        bytes32 _messageId,
        bytes calldata _payload,
        bytes calldata _zkProof
    ) 
        internal 
        pure 
        returns (bool) 
    {
        // In a real implementation, this would use a ZK verification library
        // For this example, we're doing a simplified check
        return _zkProof.length >= 32;
    }
    
    /**
     * @dev Get message details
     * @param _messageId Message ID
     * @return Message details
     */
    function getMessage(bytes32 _messageId) 
        external 
        view 
        returns (
            address sender,
            bytes32 targetAddress,
            string memory messageType,
            bytes memory payload,
            uint256 timestamp,
            bool processed,
            uint256 nonce
        ) 
    {
        Message storage message = messages[_messageId];
        return (
            message.sender,
            message.targetAddress,
            message.messageType,
            message.payload,
            message.timestamp,
            message.processed,
            message.nonce
        );
    }
    
    /**
     * @dev Get batch details
     * @param _batchIndex Batch index
     * @return Batch details
     */
    function getBatch(uint256 _batchIndex)
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 timestamp,
            uint256 messageCount,
            bool finalized,
            bytes32 commitmentHash
        )
    {
        Batch storage batch = batches[_batchIndex];
        return (
            batch.merkleRoot,
            batch.timestamp,
            batch.messageCount,
            batch.finalized,
            batch.commitmentHash
        );
    }
    
    /**
     * @dev Check if a Layer 2 address has a registered Layer 1 mapping
     * @param _l2Address Layer 2 address
     * @return True if the address has a mapping
     */
    function hasL1Mapping(address _l2Address) external view returns (bool) {
        return l2ToL1AddressMapping[_l2Address] != bytes32(0);
    }
}
