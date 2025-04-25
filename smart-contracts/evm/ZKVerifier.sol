// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ZKVerifier
 * @dev Verifies zero-knowledge proofs for privacy-preserving credit scoring and identity verification
 */
contract ZKVerifier is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Supported proof types
    enum ProofType {
        CREDIT_SCORE,
        IDENTITY,
        INCOME_VERIFICATION,
        ASSET_OWNERSHIP,
        REPUTATION
    }
    
    // Verification record for auditing
    struct VerificationRecord {
        bytes32 proofId;
        address user;
        ProofType proofType;
        bytes32 publicInputHash;
        bool verified;
        uint256 timestamp;
        address verifier;
        uint256 expiryTime;
    }
    
    // Mapping from proof ID to verification record
    mapping(bytes32 => VerificationRecord) public verifications;
    
    // Mapping from user to their active proof IDs by type
    mapping(address => mapping(uint256 => bytes32)) public userActiveProofs;
    
    // Storage of verification keys for different proof types
    mapping(uint256 => bytes) public verificationKeys;
    
    // Events
    event ProofSubmitted(
        bytes32 indexed proofId,
        address indexed user,
        uint256 proofType,
        bytes32 publicInputHash,
        uint256 timestamp
    );
    
    event ProofVerified(
        bytes32 indexed proofId,
        address indexed user,
        uint256 proofType,
        bool success,
        address verifier,
        uint256 timestamp
    );
    
    event VerificationKeyUpdated(
        uint256 proofType,
        address updater,
        uint256 timestamp
    );
    
    /**
     * @dev Constructor
     * @param admin Address of the admin
     */
    constructor(address admin) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
        _setupRole(VERIFIER_ROLE, admin);
    }
    
    /**
     * @dev Set the verification key for a specific proof type
     * @param proofType Type of proof
     * @param verificationKey The verification key
     */
    function setVerificationKey(uint256 proofType, bytes calldata verificationKey) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        verificationKeys[proofType] = verificationKey;
        
        emit VerificationKeyUpdated(proofType, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Submit a zero-knowledge proof for verification
     * @param user Address of the user
     * @param proofType Type of proof
     * @param proof The zero-knowledge proof
     * @param publicInputHash Hash of the public inputs
     * @param expiryTime Expiry time for the proof
     * @return proofId ID of the submitted proof
     */
    function submitProof(
        address user,
        uint256 proofType,
        bytes calldata proof,
        bytes32 publicInputHash,
        uint256 expiryTime
    ) 
        external 
        nonReentrant 
        returns (bytes32 proofId) 
    {
        require(proofType <= uint256(ProofType.REPUTATION), "Invalid proof type");
        require(expiryTime > block.timestamp, "Expiry time must be in the future");
        
        // Generate proof ID
        proofId = keccak256(abi.encodePacked(
            user,
            proofType,
            proof,
            publicInputHash,
            block.timestamp
        ));
        
        // Create verification record
        VerificationRecord storage record = verifications[proofId];
        record.proofId = proofId;
        record.user = user;
        record.proofType = ProofType(proofType);
        record.publicInputHash = publicInputHash;
        record.verified = false;
        record.timestamp = block.timestamp;
        record.expiryTime = expiryTime;
        
        emit ProofSubmitted(
            proofId,
            user,
            proofType,
            publicInputHash,
            block.timestamp
        );
        
        // Try to verify the proof immediately
        if (verificationKeys[proofType].length > 0) {
            _verifyProof(proofId, proof, publicInputHash, proofType);
        }
        
        return proofId;
    }
    
    /**
     * @dev Verify a previously submitted proof
     * @param proofId ID of the proof
     * @param proof The zero-knowledge proof
     */
    function verifyProof(bytes32 proofId, bytes calldata proof) 
        external 
        onlyRole(VERIFIER_ROLE) 
        nonReentrant 
    {
        VerificationRecord storage record = verifications[proofId];
        
        require(record.proofId == proofId, "Proof not found");
        require(!record.verified, "Proof already verified");
        require(block.timestamp <= record.expiryTime, "Proof expired");
        
        bool success = _verifyProof(
            proofId,
            proof,
            record.publicInputHash,
            uint256(record.proofType)
        );
        
        require(success, "Proof verification failed");
    }
    
    /**
     * @dev Check if a user has a valid proof of a specific type
     * @param user Address of the user
     * @param proofType Type of proof
     * @return valid Whether the user has a valid proof
     * @return proofId ID of the proof
     */
    function hasValidProof(address user, uint256 proofType) 
        external 
        view 
        returns (bool valid, bytes32 proofId) 
    {
        proofId = userActiveProofs[user][proofType];
        
        if (proofId != bytes32(0)) {
            VerificationRecord storage record = verifications[proofId];
            valid = record.verified && block.timestamp <= record.expiryTime;
        } else {
            valid = false;
        }
        
        return (valid, proofId);
    }
    
    /**
     * @dev Get verification details for a proof
     * @param proofId ID of the proof
     * @return user Address of the user
     * @return proofType Type of proof
     * @return verified Whether the proof is verified
     * @return timestamp Timestamp of the verification
     * @return expiryTime Expiry time of the proof
     */
    function getVerificationDetails(bytes32 proofId) 
        external 
        view 
        returns (
            address user,
            uint256 proofType,
            bool verified,
            uint256 timestamp,
            uint256 expiryTime
        ) 
    {
        VerificationRecord storage record = verifications[proofId];
        require(record.proofId == proofId, "Proof not found");
        
        return (
            record.user,
            uint256(record.proofType),
            record.verified,
            record.timestamp,
            record.expiryTime
        );
    }
    
    /**
     * @dev Revoke a proof
     * @param proofId ID of the proof to revoke
     */
    function revokeProof(bytes32 proofId) 
        external 
        nonReentrant 
    {
        VerificationRecord storage record = verifications[proofId];
        
        require(record.proofId == proofId, "Proof not found");
        require(
            record.user == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        // Clear the active proof reference if this is the active one
        if (userActiveProofs[record.user][uint256(record.proofType)] == proofId) {
            userActiveProofs[record.user][uint256(record.proofType)] = bytes32(0);
        }
        
        // Mark as expired
        record.expiryTime = block.timestamp;
    }
    
    /**
     * @dev Internal function to verify a proof
     * @param proofId ID of the proof
     * @param proof The zero-knowledge proof
     * @param publicInputHash Hash of the public inputs
     * @param proofType Type of proof
     * @return success Whether verification was successful
     */
    function _verifyProof(
        bytes32 proofId,
        bytes memory proof,
        bytes32 publicInputHash,
        uint256 proofType
    ) 
        internal 
        returns (bool success) 
    {
        VerificationRecord storage record = verifications[proofId];
        
        // In a real implementation, we would use a proper ZK verification library
        // like Groth16 or PLONK to verify the proof against the verification key
        
        // For this demo, we'll simulate verification
        success = _simulateVerification(proof, publicInputHash, proofType);
        
        if (success) {
            // Update the verification record
            record.verified = true;
            record.verifier = msg.sender;
            
            // Update the user's active proof for this type
            userActiveProofs[record.user][proofType] = proofId;
            
            emit ProofVerified(
                proofId,
                record.user,
                proofType,
                true,
                msg.sender,
                block.timestamp
            );
        }
        
        return success;
    }
    
    /**
     * @dev Simulate ZK proof verification (for demo purposes)
     * @param proof The zero-knowledge proof
     * @param publicInputHash Hash of the public inputs
     * @param proofType Type of proof
     * @return Whether verification was successful
     */
    function _simulateVerification(
        bytes memory proof,
        bytes32 publicInputHash,
        uint256 proofType
    ) 
        internal 
        pure 
        returns (bool) 
    {
        // For the demo, we'll just check if the proof has a valid length
        // In a real implementation, this would use proper ZK verification
        uint256 minLength = 0;
        
        if (proofType == uint256(ProofType.CREDIT_SCORE)) {
            minLength = 64;
        } else if (proofType == uint256(ProofType.IDENTITY)) {
            minLength = 128;
        } else if (proofType == uint256(ProofType.INCOME_VERIFICATION)) {
            minLength = 96;
        } else if (proofType == uint256(ProofType.ASSET_OWNERSHIP)) {
            minLength = 112;
        } else if (proofType == uint256(ProofType.REPUTATION)) {
            minLength = 80;
        }
        
        return proof.length >= minLength;
    }
    
    /**
     * @dev Verify a credit score proof (specialized function)
     * @param proofId ID of the proof
     * @param scoreRange Range of the score (e.g., "above 700")
     * @return Whether the credit score is in the specified range
     */
    function verifyCreditScoreProof(bytes32 proofId, string calldata scoreRange) 
        external 
        view 
        returns (bool) 
    {
        VerificationRecord storage record = verifications[proofId];
        
        require(record.proofId == proofId, "Proof not found");
        require(record.verified, "Proof not verified");
        require(block.timestamp <= record.expiryTime, "Proof expired");
        require(record.proofType == ProofType.CREDIT_SCORE, "Wrong proof type");
        
        // In a real implementation, we would verify that the score is in the
        // specified range using a range proof verification
        
        // For the demo, we'll just check if the score range hash matches
        bytes32 rangeHash = keccak256(abi.encodePacked(scoreRange));
        
        // The public input hash should encode information about the range
        return rangeHash == record.publicInputHash;
    }
    
    /**
     * @dev Verify an identity proof
     * @param proofId ID of the proof
     * @return Whether the identity has been verified
     */
    function verifyIdentityProof(bytes32 proofId) 
        external 
        view 
        returns (bool) 
    {
        VerificationRecord storage record = verifications[proofId];
        
        require(record.proofId == proofId, "Proof not found");
        require(record.verified, "Proof not verified");
        require(block.timestamp <= record.expiryTime, "Proof expired");
        require(record.proofType == ProofType.IDENTITY, "Wrong proof type");
        
        return true;
    }
}
