// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title ZKIdentityVerifier
 * @dev Advanced privacy-preserving identity verification system using zero-knowledge proofs
 * for the IntelliLend platform on IOTA EVM
 */
contract ZKIdentityVerifier is AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    
    // Verification levels
    enum VerificationLevel {
        None,       // 0: Not verified
        Basic,      // 1: Email + phone
        Advanced,   // 2: ID document
        Biometric   // 3: Biometric verification
    }
    
    // Identity claim schemas
    enum ClaimSchema {
        EmailVerification,
        PhoneVerification,
        GovernmentID,
        ProofOfAddress,
        AgeVerification,
        KYC,
        AML,
        BiometricHash,
        SocialVerification,
        CreditScore
    }
    
    // Identity structures
    struct IdentityClaim {
        ClaimSchema schema;
        bytes32 hashOfClaim;
        address verifier;
        uint256 issuanceTime;
        uint256 expirationTime;
        bytes32 zkProofHash;
        bool revoked;
    }
    
    struct VerifiedIdentity {
        VerificationLevel level;
        mapping(uint256 => IdentityClaim) claims; // ClaimSchema => IdentityClaim
        uint256 claimCount;
        address owner;
        uint256 lastUpdated;
        bytes32 merkleRoot; // Merkle root of all claims
        bytes32 metadataHash; // Additional metadata (IPFS hash, etc.)
        uint256 score; // Identity quality score (0-100)
        bool active;
    }
    
    // ZK verification schemes
    struct VerificationScheme {
        bytes32 schemeId;
        string name;
        string version;
        address verificationKey; // Contract address holding verification key
        bool active;
        string schemaURI; // URI to the proof schema
    }
    
    // State variables
    mapping(address => uint256) public identityIds;
    mapping(uint256 => VerifiedIdentity) private identities;
    mapping(bytes32 => VerificationScheme) public verificationSchemes;
    mapping(bytes32 => bool) public usedProofs; // Prevent proof reuse
    mapping(bytes32 => bool) public revokedProofs;
    
    uint256 public nextIdentityId = 1;
    bytes32[] public supportedSchemes;
    
    // Events
    event IdentityCreated(uint256 indexed identityId, address indexed owner, VerificationLevel level);
    event ClaimAdded(uint256 indexed identityId, ClaimSchema schema, bytes32 claimHash);
    event ClaimRevoked(uint256 indexed identityId, ClaimSchema schema, bytes32 claimHash);
    event VerificationLevelChanged(uint256 indexed identityId, VerificationLevel newLevel);
    event SchemeAdded(bytes32 indexed schemeId, string name, string version);
    event SchemeDeactivated(bytes32 indexed schemeId);
    event VerificationPerformed(uint256 indexed identityId, ClaimSchema schema, bool success);
    event IdentityScoreUpdated(uint256 indexed identityId, uint256 newScore);
    
    // Constructor
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(VERIFIER_ROLE, msg.sender);
        _setupRole(AUDITOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new identity for the caller
     * @param _metadataHash Hash of additional metadata (IPFS hash, etc.)
     * @return identityId ID of the created identity
     */
    function createIdentity(bytes32 _metadataHash) external nonReentrant returns (uint256) {
        require(identityIds[msg.sender] == 0, "Identity already exists");
        
        uint256 identityId = nextIdentityId++;
        identityIds[msg.sender] = identityId;
        
        VerifiedIdentity storage identity = identities[identityId];
        identity.level = VerificationLevel.None;
        identity.owner = msg.sender;
        identity.lastUpdated = block.timestamp;
        identity.metadataHash = _metadataHash;
        identity.active = true;
        identity.score = 10; // Initial score
        
        emit IdentityCreated(identityId, msg.sender, VerificationLevel.None);
        
        return identityId;
    }
    
    /**
     * @dev Add a verification scheme
     * @param _name Scheme name
     * @param _version Scheme version
     * @param _verificationKey Contract address holding verification key
     * @param _schemaURI URI to the proof schema
     * @return schemeId ID of the created scheme
     */
    function addVerificationScheme(
        string calldata _name,
        string calldata _version,
        address _verificationKey,
        string calldata _schemaURI
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        returns (bytes32) 
    {
        bytes32 schemeId = keccak256(abi.encodePacked(_name, _version));
        require(verificationSchemes[schemeId].verificationKey == address(0), "Scheme already exists");
        
        verificationSchemes[schemeId] = VerificationScheme({
            schemeId: schemeId,
            name: _name,
            version: _version,
            verificationKey: _verificationKey,
            active: true,
            schemaURI: _schemaURI
        });
        
        supportedSchemes.push(schemeId);
        
        emit SchemeAdded(schemeId, _name, _version);
        
        return schemeId;
    }
    
    /**
     * @dev Deactivate a verification scheme
     * @param _schemeId ID of the scheme to deactivate
     */
    function deactivateScheme(bytes32 _schemeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(verificationSchemes[_schemeId].active, "Scheme not active");
        
        verificationSchemes[_schemeId].active = false;
        
        emit SchemeDeactivated(_schemeId);
    }
    
    /**
     * @dev Add a claim to an identity using ZK proof
     * @param _identityId ID of the identity
     * @param _schema Claim schema
     * @param _hashOfClaim Hash of the claim data
     * @param _expirationTime Expiration time of the claim
     * @param _zkProof Zero-knowledge proof of the claim
     * @param _schemeId ID of the verification scheme
     */
    function addClaim(
        uint256 _identityId,
        ClaimSchema _schema,
        bytes32 _hashOfClaim,
        uint256 _expirationTime,
        bytes calldata _zkProof,
        bytes32 _schemeId
    ) 
        external 
        onlyRole(VERIFIER_ROLE) 
        nonReentrant 
    {
        require(identities[_identityId].active, "Identity not active");
        require(verificationSchemes[_schemeId].active, "Verification scheme not active");
        
        // Hash the proof to prevent reuse
        bytes32 proofHash = keccak256(_zkProof);
        require(!usedProofs[proofHash], "Proof already used");
        
        // Verify the proof (in a real implementation this would use a ZK verifier)
        require(_verifyZKProof(_zkProof, _hashOfClaim, _schema, _schemeId), "Invalid proof");
        
        // Add the claim
        VerifiedIdentity storage identity = identities[_identityId];
        
        identity.claims[uint256(_schema)] = IdentityClaim({
            schema: _schema,
            hashOfClaim: _hashOfClaim,
            verifier: msg.sender,
            issuanceTime: block.timestamp,
            expirationTime: _expirationTime,
            zkProofHash: proofHash,
            revoked: false
        });
        
        identity.claimCount++;
        identity.lastUpdated = block.timestamp;
        
        // Update the Merkle root
        identity.merkleRoot = _calculateMerkleRoot(_identityId);
        
        // Update verification level if needed
        _updateVerificationLevel(_identityId);
        
        // Update identity score
        _updateIdentityScore(_identityId);
        
        // Mark proof as used
        usedProofs[proofHash] = true;
        
        emit ClaimAdded(_identityId, _schema, _hashOfClaim);
        emit VerificationPerformed(_identityId, _schema, true);
    }
    
    /**
     * @dev Revoke a claim
     * @param _identityId ID of the identity
     * @param _schema Claim schema to revoke
     */
    function revokeClaim(uint256 _identityId, ClaimSchema _schema) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        VerifiedIdentity storage identity = identities[_identityId];
        require(identity.active, "Identity not active");
        
        IdentityClaim storage claim = identity.claims[uint256(_schema)];
        require(!claim.revoked, "Claim already revoked");
        require(claim.verifier == msg.sender, "Not the claim verifier");
        
        // Revoke the claim
        claim.revoked = true;
        identity.lastUpdated = block.timestamp;
        
        // Update verification level
        _updateVerificationLevel(_identityId);
        
        // Update identity score
        _updateIdentityScore(_identityId);
        
        // Mark the proof as revoked
        revokedProofs[claim.zkProofHash] = true;
        
        emit ClaimRevoked(_identityId, _schema, claim.hashOfClaim);
    }
    
    /**
     * @dev Verify a claim using Merkle proof
     * @param _identityId ID of the identity
     * @param _schema Claim schema to verify
     * @param _claimHash Hash of the claim to verify
     * @param _merkleProof Merkle proof for the claim
     * @return isValid Whether the claim is valid
     */
    function verifyClaim(
        uint256 _identityId,
        ClaimSchema _schema,
        bytes32 _claimHash,
        bytes32[] calldata _merkleProof
    ) 
        external 
        view 
        returns (bool isValid) 
    {
        VerifiedIdentity storage identity = identities[_identityId];
        if (!identity.active) return false;
        
        // Check if the claim exists and is not revoked
        IdentityClaim storage claim = identity.claims[uint256(_schema)];
        if (claim.hashOfClaim != _claimHash || claim.revoked) return false;
        
        // Check if the claim is expired
        if (claim.expirationTime > 0 && claim.expirationTime < block.timestamp) return false;
        
        // Verify the claim is in the Merkle tree
        bytes32 leaf = keccak256(abi.encodePacked(_schema, _claimHash));
        return MerkleProof.verify(_merkleProof, identity.merkleRoot, leaf);
    }
    
    /**
     * @dev Generate a zero-knowledge proof of identity for external use
     * @param _identityId ID of the identity
     * @param _schema Claim schema to prove
     * @param _challenge Challenge to include in the proof (for freshness)
     * @return zkProof Zero-knowledge proof of the claim
     */
    function generateIdentityProof(
        uint256 _identityId,
        ClaimSchema _schema,
        bytes32 _challenge
    ) 
        external 
        view 
        returns (bytes memory zkProof) 
    {
        require(identities[_identityId].owner == msg.sender, "Not identity owner");
        require(identities[_identityId].active, "Identity not active");
        
        IdentityClaim storage claim = identities[_identityId].claims[uint256(_schema)];
        require(!claim.revoked, "Claim revoked");
        require(claim.expirationTime == 0 || claim.expirationTime > block.timestamp, "Claim expired");
        
        // In a real implementation, this would generate a ZK proof
        // Here we simulate the proof with a simple structure
        
        // Create a minimal proof structure (this is just a placeholder)
        zkProof = abi.encode(
            _identityId,
            _schema,
            claim.zkProofHash,
            _challenge,
            block.timestamp
        );
        
        return zkProof;
    }
    
    /**
     * @dev Verify a generated identity proof
     * @param _proof Zero-knowledge proof to verify
     * @param _challenge Challenge that should be included in the proof
     * @return isValid Whether the proof is valid
     * @return schema The claim schema that was proven
     * @return verificationLevel The verification level of the identity
     */
    function verifyIdentityProof(
        bytes calldata _proof,
        bytes32 _challenge
    ) 
        external 
        view 
        returns (bool isValid, ClaimSchema schema, VerificationLevel verificationLevel) 
    {
        // Decode the proof (in a real implementation, this would be a proper ZK verification)
        (
            uint256 identityId,
            ClaimSchema claimSchema,
            bytes32 zkProofHash,
            bytes32 challenge,
            uint256 timestamp
        ) = abi.decode(_proof, (uint256, ClaimSchema, bytes32, bytes32, uint256));
        
        // Check challenge matches
        if (challenge != _challenge) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // Check timestamp is recent (within 5 minutes)
        if (block.timestamp > timestamp + 5 minutes) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // Check if proof is revoked
        if (revokedProofs[zkProofHash]) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // Check if identity exists and is active
        if (!identities[identityId].active) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // Check if claim exists and is valid
        IdentityClaim storage claim = identities[identityId].claims[uint256(claimSchema)];
        if (claim.zkProofHash != zkProofHash || claim.revoked) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // Check if claim is expired
        if (claim.expirationTime > 0 && claim.expirationTime < block.timestamp) return (false, ClaimSchema.EmailVerification, VerificationLevel.None);
        
        // All checks passed
        return (true, claimSchema, identities[identityId].level);
    }
    
    /**
     * @dev Get identity verification level
     * @param _user Address of the user
     * @return level The verification level
     */
    function getVerificationLevel(address _user) external view returns (VerificationLevel) {
        uint256 identityId = identityIds[_user];
        if (identityId == 0) return VerificationLevel.None;
        
        return identities[identityId].level;
    }
    
    /**
     * @dev Get identity score
     * @param _user Address of the user
     * @return score The identity score (0-100)
     */
    function getIdentityScore(address _user) external view returns (uint256) {
        uint256 identityId = identityIds[_user];
        if (identityId == 0) return 0;
        
        return identities[identityId].score;
    }
    
    /**
     * @dev Check if a claim exists and is valid
     * @param _user Address of the user
     * @param _schema Claim schema to check
     * @return isValid Whether the claim is valid
     */
    function hasValidClaim(address _user, ClaimSchema _schema) external view returns (bool) {
        uint256 identityId = identityIds[_user];
        if (identityId == 0) return false;
        
        IdentityClaim storage claim = identities[identityId].claims[uint256(_schema)];
        
        // Check if claim exists, is not revoked, and not expired
        return (
            claim.hashOfClaim != bytes32(0) && 
            !claim.revoked && 
            (claim.expirationTime == 0 || claim.expirationTime > block.timestamp)
        );
    }
    
    /**
     * @dev Get the count of verification schemes
     * @return count The number of supported schemes
     */
    function getSchemeCount() external view returns (uint256) {
        return supportedSchemes.length;
    }
    
    // Internal functions
    
    /**
     * @dev Verify a zero-knowledge proof
     * @param _zkProof Zero-knowledge proof
     * @param _hashOfClaim Hash of the claim
     * @param _schema Claim schema
     * @param _schemeId Verification scheme ID
     * @return isValid Whether the proof is valid
     */
    function _verifyZKProof(
        bytes calldata _zkProof,
        bytes32 _hashOfClaim,
        ClaimSchema _schema,
        bytes32 _schemeId
    ) 
        internal 
        view 
        returns (bool) 
    {
        // In a real implementation, this would use a ZK verifier contract
        // For this example, we'll just perform a basic check
        
        // Check if the scheme is active
        if (!verificationSchemes[_schemeId].active) return false;
        
        // Check if the proof is the right length (arbitrary check for example)
        if (_zkProof.length < 64) return false;
        
        // In a real implementation, we would call the verification key contract
        // For now, we'll just return true
        return true;
    }
    
    /**
     * @dev Update verification level based on claims
     * @param _identityId ID of the identity
     */
    function _updateVerificationLevel(uint256 _identityId) internal {
        VerifiedIdentity storage identity = identities[_identityId];
        
        // Check for biometric verification
        if (
            _hasValidClaim(identity, ClaimSchema.BiometricHash) &&
            _hasValidClaim(identity, ClaimSchema.GovernmentID) &&
            _hasValidClaim(identity, ClaimSchema.KYC)
        ) {
            if (identity.level != VerificationLevel.Biometric) {
                identity.level = VerificationLevel.Biometric;
                emit VerificationLevelChanged(_identityId, VerificationLevel.Biometric);
            }
            return;
        }
        
        // Check for advanced verification
        if (
            _hasValidClaim(identity, ClaimSchema.GovernmentID) &&
            _hasValidClaim(identity, ClaimSchema.ProofOfAddress)
        ) {
            if (identity.level != VerificationLevel.Advanced) {
                identity.level = VerificationLevel.Advanced;
                emit VerificationLevelChanged(_identityId, VerificationLevel.Advanced);
            }
            return;
        }
        
        // Check for basic verification
        if (
            _hasValidClaim(identity, ClaimSchema.EmailVerification) ||
            _hasValidClaim(identity, ClaimSchema.PhoneVerification)
        ) {
            if (identity.level != VerificationLevel.Basic) {
                identity.level = VerificationLevel.Basic;
                emit VerificationLevelChanged(_identityId, VerificationLevel.Basic);
            }
            return;
        }
        
        // No valid claims for verification levels
        if (identity.level != VerificationLevel.None) {
            identity.level = VerificationLevel.None;
            emit VerificationLevelChanged(_identityId, VerificationLevel.None);
        }
    }
    
    /**
     * @dev Check if an identity has a valid claim
     * @param _identity Identity to check
     * @param _schema Claim schema to check
     * @return isValid Whether the claim is valid
     */
    function _hasValidClaim(VerifiedIdentity storage _identity, ClaimSchema _schema) internal view returns (bool) {
        IdentityClaim storage claim = _identity.claims[uint256(_schema)];
        
        // Check if claim exists, is not revoked, and not expired
        return (
            claim.hashOfClaim != bytes32(0) && 
            !claim.revoked && 
            (claim.expirationTime == 0 || claim.expirationTime > block.timestamp)
        );
    }
    
    /**
     * @dev Calculate Merkle root for all claims
     * @param _identityId ID of the identity
     * @return merkleRoot Merkle root of all claims
     */
    function _calculateMerkleRoot(uint256 _identityId) internal view returns (bytes32) {
        VerifiedIdentity storage identity = identities[_identityId];
        
        // Collect all valid claims as leaves
        bytes32[] memory leaves = new bytes32[](identity.claimCount);
        uint256 leafCount = 0;
        
        for (uint256 i = 0; i < 10; i++) { // 10 = enum size (all claim schemas)
            IdentityClaim storage claim = identity.claims[i];
            if (claim.hashOfClaim != bytes32(0) && !claim.revoked) {
                // Create leaf as hash(schema, claimHash)
                leaves[leafCount++] = keccak256(abi.encodePacked(ClaimSchema(i), claim.hashOfClaim));
            }
        }
        
        // If no claims, return empty hash
        if (leafCount == 0) return bytes32(0);
        
        // Build Merkle tree (simple implementation for example)
        while (leafCount > 1) {
            for (uint256 i = 0; i < leafCount / 2; i++) {
                leaves[i] = keccak256(abi.encodePacked(leaves[i * 2], leaves[i * 2 + 1]));
            }
            
            if (leafCount % 2 == 1) {
                leaves[leafCount / 2] = leaves[leafCount - 1];
                leafCount = leafCount / 2 + 1;
            } else {
                leafCount = leafCount / 2;
            }
        }
        
        return leaves[0];
    }
    
    /**
     * @dev Update identity score based on claims
     * @param _identityId ID of the identity
     */
    function _updateIdentityScore(uint256 _identityId) internal {
        VerifiedIdentity storage identity = identities[_identityId];
        
        // Base score is 10
        uint256 score = 10;
        
        // Add points for each verification level
        if (identity.level == VerificationLevel.Basic) {
            score += 20;
        } else if (identity.level == VerificationLevel.Advanced) {
            score += 40;
        } else if (identity.level == VerificationLevel.Biometric) {
            score += 60;
        }
        
        // Add points for specific claims
        if (_hasValidClaim(identity, ClaimSchema.KYC)) score += 10;
        if (_hasValidClaim(identity, ClaimSchema.AML)) score += 10;
        if (_hasValidClaim(identity, ClaimSchema.CreditScore)) score += 5;
        if (_hasValidClaim(identity, ClaimSchema.SocialVerification)) score += 5;
        
        // Cap score at 100
        if (score > 100) score = 100;
        
        // Update score if changed
        if (identity.score != score) {
            identity.score = score;
            emit IdentityScoreUpdated(_identityId, score);
        }
    }
}
