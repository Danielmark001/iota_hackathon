// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Interface to IOTA Identity Bridge
interface IIOTAIdentityBridge {
    function verifyDID(bytes32 did, bytes calldata proof) external view returns (bool);
    function getVerificationMethod(bytes32 did, bytes32 methodId) external view returns (bytes memory);
    function resolveCredential(bytes32 credentialId) external view returns (bytes memory);
}

// Interface to the lending pool
interface ILendingPool {
    function riskScores(address user) external view returns (uint256);
    function updateRiskScore(address user, uint256 score) external;
}

/**
 * @title IntelliLend Zero-Knowledge Verifier
 * @dev Contract to verify zero-knowledge proofs for privacy-preserving credit scoring
 */
contract ZKVerifier is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Interface to the lending pool
    ILendingPool public lendingPool;
    
    // Interface to IOTA Identity Bridge
    IIOTAIdentityBridge public iotaIdentityBridge;
    
    // Supported verification schemes
    enum VerificationScheme {
        Groth16,
        Plonk,
        Stark,
        Custom
    }
    
    // Verification keys for different proof types
    struct VerificationKey {
        bytes key;
        VerificationScheme scheme;
        bool active;
    }
    
    // Proof type => Verification key
    mapping(bytes32 => VerificationKey) public verificationKeys;
    
    // User => Proof type => Verified status
    mapping(address => mapping(bytes32 => bool)) public verifiedProofs;
    
    // User => Proof type => Timestamp of verification
    mapping(address => mapping(bytes32 => uint256)) public verificationTimestamps;
    
    // User => DID mapping
    mapping(address => bytes32) public userDIDs;
    
    // Trusted oracles that can verify proofs off-chain
    mapping(address => bool) public trustedOracles;
    
    // Registration of proof types
    bytes32[] public supportedProofTypes;
    mapping(bytes32 => string) public proofTypeNames;
    
    // Identity verification service integration
    struct IdentityService {
        address serviceAddress;
        string serviceName;
        bool active;
    }
    
    // Service ID => Identity service
    mapping(bytes32 => IdentityService) public identityServices;
    bytes32[] public supportedIdentityServices;
    
    // User => Service ID => Verification level (0: None, 1: Basic, 2: Advanced, 3: Full)
    mapping(address => mapping(bytes32 => uint8)) public identityVerificationLevels;
    
    // Events
    event ProofVerified(
        address indexed user,
        bytes32 indexed proofType,
        bool success,
        uint256 timestamp
    );
    
    event VerificationKeyUpdated(
        bytes32 indexed proofType,
        VerificationScheme scheme,
        bool active
    );
    
    event ProofTypeAdded(
        bytes32 indexed proofType,
        string name,
        VerificationScheme scheme
    );
    
    event OracleStatusUpdated(
        address indexed oracle,
        bool active
    );
    
    event IdentityServiceAdded(
        bytes32 indexed serviceId,
        address serviceAddress,
        string serviceName
    );
    
    event IdentityVerified(
        address indexed user,
        bytes32 indexed serviceId,
        uint8 verificationLevel,
        uint256 timestamp
    );
    
    event DIDRegistered(
        address indexed user,
        bytes32 did,
        uint256 timestamp
    );
    
    // Errors
    error InvalidProof();
    error ProofTypeNotSupported();
    error VerificationFailed();
    error Unauthorized();
    error InvalidVerificationKey();
    error IdentityServiceNotFound();
    error ProofExpired();
    
    /**
     * @dev Constructor to initialize the ZK verifier
     * @param _lendingPoolAddress Address of the lending pool contract
     * @param _iotaIdentityBridge Address of the IOTA Identity Bridge
     */
    constructor(address _lendingPoolAddress, address _iotaIdentityBridge) {
        lendingPool = ILendingPool(_lendingPoolAddress);
        iotaIdentityBridge = IIOTAIdentityBridge(_iotaIdentityBridge);
        
        // Add self as trusted oracle for development (remove in production)
        trustedOracles[msg.sender] = true;
    }
    
    /**
     * @dev Add a new proof type
     * @param proofType Type identifier
     * @param name Human-readable name
     * @param scheme Verification scheme
     * @param verificationKey Verification key bytes
     */
    function addProofType(
        bytes32 proofType,
        string calldata name,
        VerificationScheme scheme,
        bytes calldata verificationKey
    ) external onlyOwner {
        require(verificationKeys[proofType].key.length == 0, "Proof type already exists");
        
        verificationKeys[proofType] = VerificationKey({
            key: verificationKey,
            scheme: scheme,
            active: true
        });
        
        supportedProofTypes.push(proofType);
        proofTypeNames[proofType] = name;
        
        emit ProofTypeAdded(proofType, name, scheme);
        emit VerificationKeyUpdated(proofType, scheme, true);
    }
    
    /**
     * @dev Update verification key for a proof type
     * @param proofType Type identifier
     * @param verificationKey New verification key
     * @param active Whether the proof type is active
     */
    function updateVerificationKey(
        bytes32 proofType,
        bytes calldata verificationKey,
        bool active
    ) external onlyOwner {
        if (verificationKeys[proofType].key.length == 0) revert ProofTypeNotSupported();
        
        VerificationScheme scheme = verificationKeys[proofType].scheme;
        
        verificationKeys[proofType] = VerificationKey({
            key: verificationKey,
            scheme: scheme,
            active: active
        });
        
        emit VerificationKeyUpdated(proofType, scheme, active);
    }
    
    /**
     * @dev Add or update a trusted oracle
     * @param oracle Oracle address
     * @param active Whether the oracle is active
     */
    function setTrustedOracle(address oracle, bool active) external onlyOwner {
        trustedOracles[oracle] = active;
        
        emit OracleStatusUpdated(oracle, active);
    }
    
    /**
     * @dev Add a new identity verification service
     * @param serviceId Service identifier
     * @param serviceAddress Service contract address
     * @param serviceName Human-readable service name
     */
    function addIdentityService(
        bytes32 serviceId,
        address serviceAddress,
        string calldata serviceName
    ) external onlyOwner {
        require(identityServices[serviceId].serviceAddress == address(0), "Service already exists");
        
        identityServices[serviceId] = IdentityService({
            serviceAddress: serviceAddress,
            serviceName: serviceName,
            active: true
        });
        
        supportedIdentityServices.push(serviceId);
        
        emit IdentityServiceAdded(serviceId, serviceAddress, serviceName);
    }
    
    /**
     * @dev Update identity service status
     * @param serviceId Service identifier
     * @param active Whether the service is active
     */
    function setIdentityServiceStatus(bytes32 serviceId, bool active) external onlyOwner {
        if (identityServices[serviceId].serviceAddress == address(0)) revert IdentityServiceNotFound();
        
        identityServices[serviceId].active = active;
    }
    
    /**
     * @dev Register a DID for a user
     * @param user User address
     * @param did Decentralized Identifier (DID)
     * @param proof Proof of DID ownership
     * @return success Whether registration was successful
     */
    function registerDID(
        address user,
        bytes32 did,
        bytes calldata proof
    ) external nonReentrant returns (bool success) {
        // Ensure only the user themselves or a trusted oracle can register
        require(msg.sender == user || trustedOracles[msg.sender], "Unauthorized");
        
        // Verify DID using IOTA Identity Bridge
        bool verificationResult = iotaIdentityBridge.verifyDID(did, proof);
        require(verificationResult, "DID verification failed");
        
        // Register DID for user
        userDIDs[user] = did;
        
        // Emit event
        emit DIDRegistered(user, did, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify a zero-knowledge proof on-chain using IOTA
     * @param proofType Type of proof
     * @param proof The ZK proof bytes
     * @param publicInputs Public inputs to the proof
     * @param user User address
     * @return success Whether verification was successful
     */
    function verifyProof(
        bytes32 proofType,
        bytes calldata proof,
        bytes calldata publicInputs,
        address user
    ) public nonReentrant returns (bool success) {
        // Check if proof type is supported and active
        VerificationKey storage vk = verificationKeys[proofType];
        if (vk.key.length == 0 || !vk.active) revert ProofTypeNotSupported();
        
        // Perform appropriate verification based on scheme
        if (vk.scheme == VerificationScheme.Groth16) {
            success = verifyGroth16(vk.key, proof, publicInputs);
        } else if (vk.scheme == VerificationScheme.Plonk) {
            success = verifyPlonk(vk.key, proof, publicInputs);
        } else if (vk.scheme == VerificationScheme.Stark) {
            success = verifyStark(vk.key, proof, publicInputs);
        } else if (vk.scheme == VerificationScheme.Custom) {
            success = verifyCustom(vk.key, proof, publicInputs);
        } else {
            revert InvalidVerificationKey();
        }
        
        // Update verification status if successful
        if (success) {
            verifiedProofs[user][proofType] = true;
            verificationTimestamps[user][proofType] = block.timestamp;
            
            // Update risk score in lending pool based on proof type
            updateUserRiskScore(user, proofType);
        }
        
        emit ProofVerified(user, proofType, success, block.timestamp);
        
        return success;
    }
    
    /**
     * @dev Verify a proof via IOTA Identity (DID-based verification)
     * @param proofType Type of proof
     * @param user User address
     * @param proof DID-signed proof
     * @return success Whether verification was successful
     */
    function verifyProofViaDID(
        bytes32 proofType,
        address user,
        bytes calldata proof
    ) external nonReentrant returns (bool success) {
        // Check if proof type is supported and active
        if (verificationKeys[proofType].key.length == 0 || !verificationKeys[proofType].active) 
            revert ProofTypeNotSupported();
        
        // Get user's DID
        bytes32 did = userDIDs[user];
        require(did != bytes32(0), "User has no registered DID");
        
        // Verify proof using IOTA Identity Bridge
        bool verificationResult = iotaIdentityBridge.verifyDID(did, proof);
        require(verificationResult, "DID verification failed");
        
        // Update verification status
        verifiedProofs[user][proofType] = true;
        verificationTimestamps[user][proofType] = block.timestamp;
        
        // Update risk score in lending pool based on proof type
        updateUserRiskScore(user, proofType);
        
        emit ProofVerified(user, proofType, true, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify a proof via a trusted oracle (off-chain verification)
     * @param proofType Type of proof
     * @param user User address
     * @param signature Oracle signature
     * @return success Whether verification was successful
     */
    function verifyProofViaOracle(
        bytes32 proofType,
        address user,
        bytes calldata signature
    ) external nonReentrant returns (bool success) {
        // Check if proof type is supported and active
        if (verificationKeys[proofType].key.length == 0 || !verificationKeys[proofType].active) 
            revert ProofTypeNotSupported();
        
        // Create message hash that the oracle signed
        bytes32 messageHash = keccak256(abi.encode(
            proofType,
            user,
            block.chainid,
            "PROOF_VERIFICATION"
        ));
        
        // Recover signer from signature
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        
        // Check if signer is a trusted oracle
        if (!trustedOracles[signer]) revert Unauthorized();
        
        // Update verification status
        verifiedProofs[user][proofType] = true;
        verificationTimestamps[user][proofType] = block.timestamp;
        
        // Update risk score in lending pool based on proof type
        updateUserRiskScore(user, proofType);
        
        emit ProofVerified(user, proofType, true, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Register identity verification from IOTA Identity service
     * @param serviceId Service identifier
     * @param user User address
     * @param did User's DID
     * @param verificationLevel Verification level achieved
     * @param credential Verifiable credential from IOTA Identity
     * @return success Whether registration was successful
     */
    function registerIdentityVerification(
        bytes32 serviceId,
        address user,
        bytes32 did,
        uint8 verificationLevel,
        bytes calldata credential
    ) external nonReentrant returns (bool success) {
        // Check if service exists and is active
        IdentityService storage service = identityServices[serviceId];
        if (service.serviceAddress == address(0) || !service.active) 
            revert IdentityServiceNotFound();
        
        // Verify that the DID matches the registered one for the user
        require(userDIDs[user] == did || userDIDs[user] == bytes32(0), "DID mismatch");
        
        // If user has no DID yet, register this one
        if (userDIDs[user] == bytes32(0)) {
            userDIDs[user] = did;
            emit DIDRegistered(user, did, block.timestamp);
        }
        
        // Verify the credential using IOTA Identity Bridge
        bytes memory resolvedCredential = iotaIdentityBridge.resolveCredential(bytes32(uint256(keccak256(credential))));
        require(resolvedCredential.length > 0, "Invalid credential");
        
        // Update verification level
        identityVerificationLevels[user][serviceId] = verificationLevel;
        
        // Update risk score in lending pool based on verification level
        updateRiskScoreBasedOnIdentity(user, serviceId, verificationLevel);
        
        emit IdentityVerified(user, serviceId, verificationLevel, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Check if a proof is verified for a user
     * @param proofType Type of proof
     * @param user User address
     * @return isVerified Whether the proof is verified
     * @return timestamp When the proof was verified
     */
    function isProofVerified(bytes32 proofType, address user) external view returns (bool isVerified, uint256 timestamp) {
        return (verifiedProofs[user][proofType], verificationTimestamps[user][proofType]);
    }
    
    /**
     * @dev Get identity verification level for a user
     * @param serviceId Service identifier
     * @param user User address
     * @return level Verification level
     */
    function getIdentityVerificationLevel(bytes32 serviceId, address user) external view returns (uint8) {
        return identityVerificationLevels[user][serviceId];
    }
    
    /**
     * @dev Get user's DID
     * @param user User address
     * @return did The user's DID
     */
    function getUserDID(address user) external view returns (bytes32) {
        return userDIDs[user];
    }
    
    /**
     * @dev Get all supported proof types
     * @return proofTypes Array of proof type identifiers
     * @return names Array of proof type names
     */
    function getSupportedProofTypes() external view returns (bytes32[] memory proofTypes, string[] memory names) {
        proofTypes = supportedProofTypes;
        names = new string[](proofTypes.length);
        
        for (uint256 i = 0; i < proofTypes.length; i++) {
            names[i] = proofTypeNames[proofTypes[i]];
        }
    }
    
    /**
     * @dev Get all supported identity services
     * @return serviceIds Array of service identifiers
     * @return serviceNames Array of service names
     */
    function getSupportedIdentityServices() external view returns (bytes32[] memory serviceIds, string[] memory serviceNames) {
        serviceIds = supportedIdentityServices;
        serviceNames = new string[](serviceIds.length);
        
        for (uint256 i = 0; i < serviceIds.length; i++) {
            serviceNames[i] = identityServices[serviceIds[i]].serviceName;
        }
    }
    
    /**
     * @dev Implementation of Groth16 verification
     * @param vk Verification key
     * @param proof The ZK proof
     * @param publicInputs Public inputs
     * @return success Whether verification was successful
     */
    function verifyGroth16(
        bytes memory vk,
        bytes calldata proof,
        bytes calldata publicInputs
    ) internal pure returns (bool) {
        // This is a placeholder for a real Groth16 verification implementation
        // In a production environment, we would implement the full verification algorithm
        
        // Groth16 verification process:
        // 1. Extract verification key parameters (alpha1, beta2, gamma2, delta2, IC)
        // 2. Extract proof parameters (A, B, C)
        // 3. Parse public inputs
        // 4. Perform pairing operations to verify the proof
        
        // For demo purposes, implement basic checks to simulate verification
        if (proof.length < 192 || publicInputs.length == 0 || vk.length < 32) {
            return false;
        }
        
        // Simulate the computation of pairing checks
        // In a real implementation, we would perform elliptic curve pairings here
        
        // The following is just an example of parsing some components
        // but not actually performing cryptographic verification
        
        // Extract a simulated check value from the proof (not actual Groth16 logic)
        bytes32 checkValue = keccak256(abi.encodePacked(proof, publicInputs, vk));
        
        // Simulate a "passing" verification by checking if the hash ends with a specific pattern
        // This is NOT secure and is only for demonstration purposes
        return uint256(checkValue) % 10 != 0; // 90% chance of "success"
    }
    
    /**
     * @dev Implementation of PLONK verification
     * @param vk Verification key
     * @param proof The ZK proof
     * @param publicInputs Public inputs
     * @return success Whether verification was successful
     */
    function verifyPlonk(
        bytes memory vk,
        bytes calldata proof,
        bytes calldata publicInputs
    ) internal pure returns (bool) {
        // In a real implementation, this would use an actual PLONK verifier
        return proof.length > 0 && publicInputs.length > 0 && vk.length > 0;
    }
    
    /**
     * @dev Implementation of STARK verification
     * @param vk Verification key
     * @param proof The ZK proof
     * @param publicInputs Public inputs
     * @return success Whether verification was successful
     */
    function verifyStark(
        bytes memory vk,
        bytes calldata proof,
        bytes calldata publicInputs
    ) internal pure returns (bool) {
        // In a real implementation, this would use an actual STARK verifier
        return proof.length > 0 && publicInputs.length > 0 && vk.length > 0;
    }
    
    /**
     * @dev Implementation of custom verification scheme
     * @param vk Verification key
     * @param proof The ZK proof
     * @param publicInputs Public inputs
     * @return success Whether verification was successful
     */
    function verifyCustom(
        bytes memory vk,
        bytes calldata proof,
        bytes calldata publicInputs
    ) internal pure returns (bool) {
        // In a real implementation, this would use a custom verifier
        return proof.length > 0 && publicInputs.length > 0 && vk.length > 0;
    }
    
    /**
     * @dev Update user risk score in the lending pool based on proof type
     * @param user User address
     * @param proofType Type of proof
     */
    function updateUserRiskScore(address user, bytes32 proofType) internal {
        // Get current risk score
        uint256 currentScore = lendingPool.riskScores(user);
        
        // Apply adjustment based on proof type
        // This is a simplified example - in reality, the adjustment would depend on the specific proof
        
        // Income verification proof - reduce risk (better score)
        if (proofType == keccak256("INCOME_VERIFICATION")) {
            if (currentScore > 10) {
                lendingPool.updateRiskScore(user, currentScore - 10);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
        // Credit history proof - reduce risk significantly
        else if (proofType == keccak256("CREDIT_HISTORY")) {
            if (currentScore > 15) {
                lendingPool.updateRiskScore(user, currentScore - 15);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
        // Collateral ownership proof - reduce risk moderately
        else if (proofType == keccak256("COLLATERAL_OWNERSHIP")) {
            if (currentScore > 8) {
                lendingPool.updateRiskScore(user, currentScore - 8);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
        // Debt obligations proof - might increase risk
        else if (proofType == keccak256("DEBT_OBLIGATIONS")) {
            // This depends on the content of the proof, but we'll assume it's neutral
            // In a real implementation, we'd parse the public inputs to decide
        }
        // Default case - slight risk reduction for any valid proof
        else {
            if (currentScore > 5) {
                lendingPool.updateRiskScore(user, currentScore - 5);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
    }
    
    /**
     * @dev Update risk score based on identity verification level
     * @param user User address
     * @param serviceId Service identifier
     * @param verificationLevel Verification level
     */
    function updateRiskScoreBasedOnIdentity(
        address user,
        bytes32 serviceId,
        uint8 verificationLevel
    ) internal {
        // Get current risk score
        uint256 currentScore = lendingPool.riskScores(user);
        
        // Apply adjustment based on verification level and service
        // Higher verification levels lead to more significant risk reduction
        
        if (verificationLevel == 1) { // Basic verification
            if (currentScore > 5) {
                lendingPool.updateRiskScore(user, currentScore - 5);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        } else if (verificationLevel == 2) { // Advanced verification
            if (currentScore > 10) {
                lendingPool.updateRiskScore(user, currentScore - 10);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        } else if (verificationLevel == 3) { // Full verification
            if (currentScore > 20) {
                lendingPool.updateRiskScore(user, currentScore - 20);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
        
        // Special case for IOTA Identity Framework
        if (serviceId == keccak256("IOTA_IDENTITY_FRAMEWORK") && verificationLevel >= 2) {
            if (currentScore > 25) {
                lendingPool.updateRiskScore(user, currentScore - 25);
            } else {
                lendingPool.updateRiskScore(user, 0);
            }
        }
    }
}
