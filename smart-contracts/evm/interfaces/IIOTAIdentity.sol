// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IIOTAIdentity
 * @dev Interface for interacting with IOTA Identity framework
 */
interface IIOTAIdentity {
    /**
     * @dev DID Document structure
     */
    struct DIDDocument {
        bytes id;                  // DID identifier
        bytes[] controllers;       // DID controllers
        bytes[] verificationMethods; // Verification methods
        bytes[] services;          // Services attached to the DID
    }
    
    /**
     * @dev Verification Result structure
     */
    struct VerificationResult {
        bool isValid;              // Whether the verification was successful
        bytes verifier;            // Verifier that performed the verification
        uint256 timestamp;         // Timestamp of the verification
    }
    
    /**
     * @dev Create a new DID
     * @param controller Address of the controller
     * @return did DID identifier
     * @return document DID document
     */
    function createDID(
        address controller
    ) external returns (bytes memory did, DIDDocument memory document);
    
    /**
     * @dev Resolve a DID to its DID document
     * @param did DID to resolve
     * @return document DID document
     */
    function resolveDID(
        bytes memory did
    ) external view returns (DIDDocument memory document);
    
    /**
     * @dev Verify a signature using a DID
     * @param did DID that signed the message
     * @param message Message that was signed
     * @param signature Signature to verify
     * @return result Verification result
     */
    function verifySignature(
        bytes memory did,
        bytes memory message,
        bytes memory signature
    ) external view returns (VerificationResult memory result);
    
    /**
     * @dev Issue a verifiable credential
     * @param issuerDID DID of the issuer
     * @param subjectDID DID of the subject
     * @param claims Claims to include in the credential
     * @param expirationTime Expiration time of the credential
     * @return credentialId ID of the issued credential
     */
    function issueCredential(
        bytes memory issuerDID,
        bytes memory subjectDID,
        bytes memory claims,
        uint256 expirationTime
    ) external returns (bytes32 credentialId);
    
    /**
     * @dev Verify a credential
     * @param credentialId ID of the credential to verify
     * @return isValid Whether the credential is valid
     * @return issuerDID DID of the issuer
     * @return subjectDID DID of the subject
     */
    function verifyCredential(
        bytes32 credentialId
    ) external view returns (bool isValid, bytes memory issuerDID, bytes memory subjectDID);
    
    /**
     * @dev Revoke a credential
     * @param credentialId ID of the credential to revoke
     * @param issuerDID DID of the issuer
     */
    function revokeCredential(
        bytes32 credentialId,
        bytes memory issuerDID
    ) external;
}