// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title PrivacyPreservingIdentity
 * @dev Manages privacy-preserving identity and credit scoring for IntelliLend
 * @notice Utilizes IOTA's identity framework for secure user verification
 */
contract PrivacyPreservingIdentity is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // Events
    event IdentityRegistered(bytes32 indexed identityHash, uint256 timestamp);
    event IdentityVerified(bytes32 indexed identityHash, uint256 timestamp);
    event CreditScoreUpdated(bytes32 indexed identityHash, uint256 timestamp);
    event ZKProofVerified(bytes32 indexed identityHash, bytes32 claimType, uint256 timestamp);
    event VerifierAdded(address indexed verifier, uint256 timestamp);
    event VerifierRemoved(address indexed verifier, uint256 timestamp);
    event ClaimTypeAdded(bytes32 indexed claimType, string description, uint256 timestamp);
    
    // Structs
    struct Identity {
        bytes32 identityHash;  // Hashed DID (Decentralized Identifier)
        uint256 registrationTime;
        bool verified;
        uint256 verificationTime;
        bytes publicCredential;  // Public part of the user's credential
    }
    
    struct CreditScore {
        uint256 score;  // 0-100
        uint256 lastUpdated;
        bytes32 dataHash;  // Hash of the underlying data used for scoring
        bool zkVerified;   // Whether it was verified using zero-knowledge proofs
    }
    
    struct Verifier {
        address addr;
        string name;
        bool active;
        uint256 addedTime;
    }
    
    struct ClaimType {
        bytes32 typeHash;
        string description;
        bool active;
    }
    
    // Mappings
    mapping(bytes32 => Identity) public identities;  // identityHash => Identity
    mapping(bytes32 => CreditScore) public creditScores;  // identityHash => CreditScore
    mapping(address => bool) public authorizedVerifiers;  // Addresses authorized to verify identities
    mapping(bytes32 => bool) public validClaimTypes;  // Claim types that can be verified
    
    // Arrays for enumeration
    address[] public verifierList;
    bytes32[] public claimTypeList;
    
    // Counters and state variables
    uint256 public totalIdentities;
    uint256 public totalVerifiedIdentities;
    
    /**
     * @dev Constructor to initialize the privacy-preserving identity contract
     * @param initialVerifiers Initial list of authorized verifiers
     */
    constructor(address[] memory initialVerifiers) {
        for (uint256 i = 0; i < initialVerifiers.length; i++) {
            authorizedVerifiers[initialVerifiers[i]] = true;
            verifierList.push(initialVerifiers[i]);
            
            emit VerifierAdded(initialVerifiers[i], block.timestamp);
        }
        
        // Add some default claim types
        _addClaimType(keccak256("CREDIT_HISTORY"), "Credit history verification");
        _addClaimType(keccak256("INCOME_VERIFICATION"), "Income verification");
        _addClaimType(keccak256("IDENTITY_VERIFICATION"), "Identity verification");
        _addClaimType(keccak256("LOAN_HISTORY"), "Loan repayment history");
    }
    
    /**
     * @dev Modifier to restrict access to authorized verifiers
     */
    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender], "Not an authorized verifier");
        _;
    }
    
    /**
     * @dev Register a new identity
     * @param identityHash Hashed DID of the user
     * @param publicCredential Public part of the user's credential
     * @return success Whether the registration was successful
     */
    function registerIdentity(
        bytes32 identityHash,
        bytes calldata publicCredential
    ) external whenNotPaused returns (bool success) {
        require(identityHash != bytes32(0), "Identity hash cannot be zero");
        require(identities[identityHash].registrationTime == 0, "Identity already registered");
        
        identities[identityHash] = Identity({
            identityHash: identityHash,
            registrationTime: block.timestamp,
            verified: false,
            verificationTime: 0,
            publicCredential: publicCredential
        });
        
        totalIdentities++;
        
        emit IdentityRegistered(identityHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify an identity (only callable by authorized verifiers)
     * @param identityHash Hashed DID of the user
     * @param verificationData Additional data used for verification
     * @return success Whether the verification was successful
     */
    function verifyIdentity(
        bytes32 identityHash,
        bytes calldata verificationData
    ) external onlyVerifier whenNotPaused returns (bool success) {
        require(identities[identityHash].registrationTime > 0, "Identity not registered");
        require(!identities[identityHash].verified, "Identity already verified");
        
        // In a real implementation, this would include verification logic
        // For the hackathon, we're just marking it as verified
        
        identities[identityHash].verified = true;
        identities[identityHash].verificationTime = block.timestamp;
        
        totalVerifiedIdentities++;
        
        emit IdentityVerified(identityHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Update a user's credit score (only callable by authorized verifiers)
     * @param identityHash Hashed DID of the user
     * @param score New credit score (0-100)
     * @param dataHash Hash of the underlying data used for scoring
     * @param zkVerified Whether the score was verified using zero-knowledge proofs
     * @return success Whether the update was successful
     */
    function updateCreditScore(
        bytes32 identityHash,
        uint256 score,
        bytes32 dataHash,
        bool zkVerified
    ) external onlyVerifier whenNotPaused returns (bool success) {
        require(identities[identityHash].registrationTime > 0, "Identity not registered");
        require(identities[identityHash].verified, "Identity not verified");
        require(score <= 100, "Score must be between 0 and 100");
        
        creditScores[identityHash] = CreditScore({
            score: score,
            lastUpdated: block.timestamp,
            dataHash: dataHash,
            zkVerified: zkVerified
        });
        
        emit CreditScoreUpdated(identityHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify a zero-knowledge proof for a specific claim
     * @param identityHash Hashed DID of the user
     * @param claimType Type of claim being verified
     * @param proof Zero-knowledge proof data
     * @param publicInputs Public inputs for the proof verification
     * @return valid Whether the proof is valid
     */
    function verifyZKProof(
        bytes32 identityHash,
        bytes32 claimType,
        bytes calldata proof,
        bytes calldata publicInputs
    ) external whenNotPaused returns (bool valid) {
        require(identities[identityHash].registrationTime > 0, "Identity not registered");
        require(validClaimTypes[claimType], "Invalid claim type");
        
        // In a real implementation, this would include ZK proof verification logic
        // For the hackathon, we're just emitting an event
        
        emit ZKProofVerified(identityHash, claimType, block.timestamp);
        
        // Return true for the hackathon, but in a real implementation this would
        // depend on the result of the proof verification
        return true;
    }
    
    /**
     * @dev Get a user's credit score
     * @param identityHash Hashed DID of the user
     * @return score The credit score
     * @return lastUpdated When the score was last updated
     * @return zkVerified Whether the score was verified using zero-knowledge proofs
     */
    function getCreditScore(bytes32 identityHash) external view returns (
        uint256 score,
        uint256 lastUpdated,
        bool zkVerified
    ) {
        CreditScore memory creditScore = creditScores[identityHash];
        
        return (
            creditScore.score,
            creditScore.lastUpdated,
            creditScore.zkVerified
        );
    }
    
    /**
     * @dev Convert an address to an identity hash
     * @param addr The address to convert
     * @return identityHash The resulting identity hash
     */
    function addressToIdentityHash(address addr) external pure returns (bytes32 identityHash) {
        // A simple mapping function - in reality, this would be more sophisticated
        return keccak256(abi.encodePacked("did:iota:", addr));
    }
    
    /**
     * @dev Add a new authorized verifier (only callable by owner)
     * @param verifier Address of the verifier
     * @param name Name of the verifier
     */
    function addVerifier(address verifier, string calldata name) external onlyOwner {
        require(!authorizedVerifiers[verifier], "Verifier already authorized");
        
        authorizedVerifiers[verifier] = true;
        verifierList.push(verifier);
        
        emit VerifierAdded(verifier, block.timestamp);
    }
    
    /**
     * @dev Remove an authorized verifier (only callable by owner)
     * @param verifier Address of the verifier to remove
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(authorizedVerifiers[verifier], "Verifier not authorized");
        
        authorizedVerifiers[verifier] = false;
        
        // Remove from the list
        for (uint256 i = 0; i < verifierList.length; i++) {
            if (verifierList[i] == verifier) {
                verifierList[i] = verifierList[verifierList.length - 1];
                verifierList.pop();
                break;
            }
        }
        
        emit VerifierRemoved(verifier, block.timestamp);
    }
    
    /**
     * @dev Add a new claim type (only callable by owner)
     * @param claimType Hash of the claim type
     * @param description Description of the claim type
     */
    function addClaimType(bytes32 claimType, string calldata description) external onlyOwner {
        _addClaimType(claimType, description);
    }
    
    /**
     * @dev Internal function to add a new claim type
     * @param claimType Hash of the claim type
     * @param description Description of the claim type
     */
    function _addClaimType(bytes32 claimType, string memory description) internal {
        require(!validClaimTypes[claimType], "Claim type already exists");
        
        validClaimTypes[claimType] = true;
        claimTypeList.push(claimType);
        
        emit ClaimTypeAdded(claimType, description, block.timestamp);
    }
    
    /**
     * @dev Get the list of authorized verifiers
     * @return _verifiers List of verifier addresses
     */
    function getVerifiers() external view returns (address[] memory _verifiers) {
        return verifierList;
    }
    
    /**
     * @dev Get the list of valid claim types
     * @return _claimTypes List of claim type hashes
     */
    function getClaimTypes() external view returns (bytes32[] memory _claimTypes) {
        return claimTypeList;
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
}
