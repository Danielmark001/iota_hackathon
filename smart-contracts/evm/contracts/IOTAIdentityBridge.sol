// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title IOTA Identity Bridge
 * @dev Bridge for verifying IOTA Identity DIDs and credentials on EVM
 */
contract IOTAIdentityBridge is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    
    // Interface to the ZK verifier
    address public zkVerifier;
    
    // Trusted oracles that can relay identity information from IOTA
    mapping(address => bool) public authorizedOracles;
    address[] public oracleList;
    
    // User => DID mapping
    mapping(address => bytes32) public userDIDs;
    
    // DID => Verification method mapping
    mapping(bytes32 => mapping(bytes32 => bytes)) public verificationMethods;
    
    // Credential ID => Credential data
    mapping(bytes32 => bytes) public credentials;
    
    // Events
    event DIDRegistered(
        address indexed user,
        bytes32 indexed did,
        uint256 timestamp
    );
    
    event CredentialVerified(
        address indexed user,
        bytes32 indexed credentialId,
        bool success,
        uint256 timestamp
    );
    
    event ZKProofVerified(
        address indexed user,
        bytes32 indexed proofId,
        bool success,
        uint256 timestamp
    );
    
    event OracleAdded(
        address indexed oracle,
        uint256 timestamp
    );
    
    event OracleRemoved(
        address indexed oracle,
        uint256 timestamp
    );
    
    /**
     * @dev Constructor to initialize the bridge
     * @param _zkVerifier Address of the ZK verifier contract
     */
    constructor(address _zkVerifier) {
        zkVerifier = _zkVerifier;
        
        // Add deployer as trusted oracle
        authorizedOracles[msg.sender] = true;
        oracleList.push(msg.sender);
        
        emit OracleAdded(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Modifier to restrict access to authorized oracles
     */
    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }
    
    /**
     * @dev Add an oracle (only callable by owner)
     * @param oracle Address of the oracle to add
     */
    function addOracle(address oracle) external onlyOwner {
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
     * @dev Register a DID for a user (callable by user or oracle)
     * @param user User address
     * @param did The DID to register
     * @param proof Proof of DID ownership
     * @return success Whether registration was successful
     */
    function registerDID(
        address user,
        bytes32 did,
        bytes calldata proof
    ) external nonReentrant returns (bool success) {
        // Check if caller is user or oracle
        require(msg.sender == user || authorizedOracles[msg.sender], "Unauthorized");
        
        // Verify DID proof
        require(verifyDID(did, proof), "DID verification failed");
        
        // Register DID for user
        userDIDs[user] = did;
        
        // Emit event
        emit DIDRegistered(user, did, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Register a verification method for a DID (only callable by oracles)
     * @param did The DID
     * @param methodId Verification method ID
     * @param method Verification method data
     * @return success Whether registration was successful
     */
    function registerVerificationMethod(
        bytes32 did,
        bytes32 methodId,
        bytes calldata method
    ) external onlyOracle returns (bool success) {
        // Store verification method
        verificationMethods[did][methodId] = method;
        
        return true;
    }
    
    /**
     * @dev Register a credential (only callable by oracles)
     * @param credentialId Credential ID
     * @param credential Credential data
     * @return success Whether registration was successful
     */
    function registerCredential(
        bytes32 credentialId,
        bytes calldata credential
    ) external onlyOracle returns (bool success) {
        // Store credential
        credentials[credentialId] = credential;
        
        return true;
    }
    
    /**
     * @dev Verify a DID
     * @param did The DID to verify
     * @param proof Proof of DID ownership
     * @return success Whether verification was successful
     */
    function verifyDID(
        bytes32 did,
        bytes calldata proof
    ) public view returns (bool success) {
        // In a production implementation, this would verify the proof using IOTA Identity techniques
        // For simplicity in this implementation, we'll use a basic check
        
        // Check if proof is valid (not empty)
        if (proof.length == 0) {
            return false;
        }
        
        // If caller is an oracle, trust the verification
        if (authorizedOracles[msg.sender]) {
            return true;
        }
        
        // In other cases, implement a verification algorithm
        // For this example, we'll check if proof contains did as a substring
        bool foundDid = false;
        bytes32 didHash = keccak256(abi.encodePacked(did));
        
        for (uint i = 0; i <= proof.length - 32; i++) {
            bytes32 chunk;
            assembly {
                chunk := mload(add(add(proof, 32), i))
            }
            
            if (keccak256(abi.encodePacked(chunk)) == didHash) {
                foundDid = true;
                break;
            }
        }
        
        return foundDid;
    }
    
    /**
     * @dev Get a verification method for a DID
     * @param did The DID
     * @param methodId Verification method ID
     * @return method Verification method data
     */
    function getVerificationMethod(
        bytes32 did,
        bytes32 methodId
    ) external view returns (bytes memory) {
        return verificationMethods[did][methodId];
    }
    
    /**
     * @dev Resolve a credential
     * @param credentialId Credential ID
     * @return credential Credential data
     */
    function resolveCredential(
        bytes32 credentialId
    ) external view returns (bytes memory) {
        return credentials[credentialId];
    }
    
    /**
     * @dev Verify a credential
     * @param credential Credential data
     * @return success Whether verification was successful
     */
    function verifyCredential(
        bytes calldata credential
    ) external view returns (bool success) {
        // In a production implementation, this would verify the credential using IOTA Identity techniques
        // For simplicity in this implementation, we'll use a basic check
        
        // Check if credential is valid (not empty)
        if (credential.length == 0) {
            return false;
        }
        
        // If caller is an oracle, trust the verification
        if (authorizedOracles[msg.sender]) {
            return true;
        }
        
        // In other cases, implement a verification algorithm
        // For this example, we'll check if credential has a valid structure
        
        // Parse the credential to check its structure
        // This is a simplified check
        bool hasValidStructure = false;
        
        // Look for "@context" field which should be present in all verifiable credentials
        bytes memory contextCheck = bytes("@context");
        for (uint i = 0; i <= credential.length - contextCheck.length; i++) {
            bool found = true;
            for (uint j = 0; j < contextCheck.length; j++) {
                if (credential[i + j] != contextCheck[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                hasValidStructure = true;
                break;
            }
        }
        
        return hasValidStructure;
    }
    
    /**
     * @dev Verify a zero-knowledge proof
     * @param proof Zero-knowledge proof data
     * @return success Whether verification was successful
     */
    function verifyZKProof(
        bytes calldata proof
    ) external view returns (bool success) {
        // In a production implementation, this would verify the ZK proof using appropriate techniques
        // For simplicity in this implementation, we'll use a basic check
        
        // Check if proof is valid (not empty)
        if (proof.length == 0) {
            return false;
        }
        
        // If caller is an oracle, trust the verification
        if (authorizedOracles[msg.sender]) {
            return true;
        }
        
        // In a real implementation, this would delegate to a specialized ZK verifier
        // For this example, we'll check if the proof has a valid structure
        
        // This is a simplified check
        return proof.length >= 64;
    }
    
    /**
     * @dev Get a user's DID
     * @param user User address
     * @return did The user's DID
     */
    function getUserDID(
        address user
    ) external view returns (bytes32) {
        return userDIDs[user];
    }
    
    /**
     * @dev Update the ZK verifier address (only callable by owner)
     * @param _zkVerifier New ZK verifier address
     */
    function updateZKVerifier(
        address _zkVerifier
    ) external onlyOwner {
        require(_zkVerifier != address(0), "Invalid ZK verifier address");
        zkVerifier = _zkVerifier;
    }
    
    /**
     * @dev Get all oracle addresses
     * @return _oracles Array of oracle addresses
     */
    function getOracles() external view returns (address[] memory) {
        return oracleList;
    }
}
