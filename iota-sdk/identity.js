/**
 * IOTA Identity Module
 * 
 * This module provides integration with IOTA Identity for decentralized identity management,
 * including DIDs (Decentralized Identifiers) and Verifiable Credentials.
 */

const { Identity, VerifiableCredential, VerifiablePresentation, Resolver } = require('@iota/identity-wasm');
const crypto = require('crypto');
const { submitBlock, getAddressTransactions } = require('./client');
const logger = require('./utils/logger');
const config = require('./config');

class IOTAIdentity {
  /**
   * Initialize the IOTA Identity module
   * @param {Object} client - IOTA client instance
   * @param {Object} account - IOTA account for wallet operations (optional)
   */
  constructor(client, account = null) {
    this.client = client;
    this.account = account;
    this.identityCache = new Map();
    this.didDocCache = new Map();
    this.resolverCache = new Map();
    
    // The network we're connecting to (from config)
    const network = process.env.IOTA_NETWORK || config.DEFAULT_NETWORK;
    this.network = network;
    
    // Get network configuration
    const networkConfig = config.NETWORKS[network];
    if (!networkConfig) {
      throw new Error(`Network '${network}' not found in configuration.`);
    }
    
    // Set up DID configuration
    this.didConfig = {
      network: networkConfig.protocol?.networkName || network,
      method: 'iota',
      node: networkConfig.nodes[0]
    };
    
    // Initialize the Identity client with proper configuration
    this.identity = new Identity({
      ...this.didConfig,
      config: {
        permanodes: networkConfig.nodes,
        node: networkConfig.nodes[0]
      }
    });
    
    logger.info(`IOTA Identity module initialized for network: ${this.didConfig.network}`);
  }
  
  /**
   * Create a new DID (Decentralized Identifier) for a user
   * @param {string} userAddress - User's address (can be IOTA or Ethereum address)
   * @param {Object} metadata - Additional user metadata
   * @returns {Promise<Object>} The created DID and document
   */
  async createDID(userAddress, metadata = {}) {
    try {
      logger.info(`Creating new DID for user: ${userAddress}`);
      
      // Generate a new key pair for the DID
      const key = await Identity.generateEd25519VerificationKey();
      
      // Create a new DID Document
      const document = await Identity.createIdentity({
        key,
        doc: { 
          authentication: [],
          service: []
        },
        network: this.didConfig.network,
        method: this.didConfig.method
      });
      
      // Add authentication method to the document
      const authMethod = await Identity.createVerificationMethod({
        key,
        controller: document.id,
        fragment: 'auth'
      });
      
      document.authentication.push(authMethod.id);
      
      // Add a service endpoint for KYC verification
      document.service.push({
        id: `${document.id}#kyc`,
        type: 'KYCVerificationService',
        serviceEndpoint: metadata.serviceEndpoint || 'https://intellilend.io/api/verify',
        description: 'KYC/AML verification service'
      });
      
      // Add metadata fields to the document
      if (metadata.name) {
        document.service.push({
          id: `${document.id}#profile`,
          type: 'UserProfile',
          serviceEndpoint: 'https://intellilend.io/profile',
          description: 'User profile information',
          properties: {
            name: metadata.name,
            // Do not include sensitive data in the DID document
            userAddress: userAddress,
            createdAt: new Date().toISOString()
          }
        });
      }
      
      // Sign the document with the key
      const signedDocument = await Identity.signDocument(document, key);
      
      // Publish the DID Document to the Tangle
      const tanglerResult = await this.publishDIDDocument(signedDocument);
      
      // Create a response object with important details
      const didResult = {
        did: document.id,
        document: signedDocument,
        key: {
          publicKey: key.publicKey,
          type: key.type,
          controller: document.id
        },
        tangleExplorerUrl: `${config.getExplorerAddressUrl(tanglerResult.blockId, this.network)}`,
        created: new Date().toISOString()
      };
      
      // Cache the DID document
      this.didDocCache.set(document.id, signedDocument);
      
      // Associate the userAddress with this DID
      this.identityCache.set(userAddress, {
        did: document.id,
        created: new Date().toISOString()
      });
      
      logger.info(`DID created successfully: ${document.id}`);
      return didResult;
    }
    catch (error) {
      logger.error(`Error creating DID for ${userAddress}: ${error.message}`);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }
  
  /**
   * Resolve a DID to its DID Document
   * @param {string} did - The DID to resolve
   * @returns {Promise<Object>} The resolved DID Document
   */
  async resolveDID(did) {
    try {
      logger.info(`Resolving DID: ${did}`);
      
      // Check cache first
      if (this.didDocCache.has(did)) {
        logger.debug(`Using cached DID Document for ${did}`);
        return this.didDocCache.get(did);
      }
      
      // Get resolver for this network
      let resolver;
      if (this.resolverCache.has(this.network)) {
        resolver = this.resolverCache.get(this.network);
      } else {
        resolver = new Resolver({
          network: this.didConfig.network,
          node: this.didConfig.node
        });
        this.resolverCache.set(this.network, resolver);
      }
      
      // Resolve the DID
      const document = await resolver.resolve(did);
      
      if (!document) {
        throw new Error(`DID not found: ${did}`);
      }
      
      // Cache the resolved document
      this.didDocCache.set(did, document);
      
      logger.info(`DID resolved successfully: ${did}`);
      return document;
    }
    catch (error) {
      logger.error(`Error resolving DID ${did}: ${error.message}`);
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }
  
  /**
   * Publish a DID Document to the Tangle
   * @param {Object} document - DID Document to publish
   * @returns {Promise<Object>} Result of the publication
   */
  async publishDIDDocument(document) {
    try {
      logger.info(`Publishing DID Document to Tangle: ${document.id}`);
      
      // Convert DID Document to JSON
      const documentJSON = JSON.stringify(document);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('DID_DOCUMENT').toString('hex'),
          data: Buffer.from(documentJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.info(`DID Document published to Tangle: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error publishing DID Document: ${error.message}`);
      throw new Error(`Failed to publish DID Document: ${error.message}`);
    }
  }
  
  /**
   * Create a Verifiable Credential for KYC/AML verification
   * @param {string} issuerDID - DID of the credential issuer
   * @param {string} issuerKey - Private key of the issuer
   * @param {string} subjectDID - DID of the credential subject
   * @param {Object} claims - Credential claims
   * @returns {Promise<Object>} The created Verifiable Credential
   */
  async createKYCCredential(issuerDID, issuerKey, subjectDID, claims) {
    try {
      logger.info(`Creating KYC Credential for subject: ${subjectDID}`);
      
      // Resolve issuer and subject DIDs
      const issuerDoc = await this.resolveDID(issuerDID);
      const subjectDoc = await this.resolveDID(subjectDID);
      
      if (!issuerDoc || !subjectDoc) {
        throw new Error('Issuer or subject DID cannot be resolved');
      }
      
      // Create credential
      const credential = await VerifiableCredential.create({
        id: `${subjectDID}#kyc-${Date.now()}`,
        type: ['VerifiableCredential', 'KYCVerification'],
        issuer: issuerDID,
        subject: subjectDID,
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        credentialSubject: {
          id: subjectDID,
          ...claims
        },
        // IMPORTANT: Remove any sensitive PII from the credential itself
        // Only include verification status and non-sensitive metadata
        verificationLevel: claims.verificationLevel || 'basic',
        verificationDate: new Date().toISOString()
      });
      
      // Sign the credential
      const signedCredential = await credential.sign(issuerKey);
      
      // Store credential on Tangle
      const result = await this.storeCredential(signedCredential);
      
      // Create a response object with important details
      const credentialResult = {
        id: credential.id,
        credential: signedCredential,
        issuer: issuerDID,
        subject: subjectDID,
        type: credential.type,
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate
      };
      
      logger.info(`KYC Credential created: ${credential.id}`);
      return credentialResult;
    }
    catch (error) {
      logger.error(`Error creating KYC Credential: ${error.message}`);
      throw new Error(`Failed to create KYC Credential: ${error.message}`);
    }
  }
  
  /**
   * Store a Verifiable Credential on the Tangle
   * @param {Object} credential - Verifiable Credential to store
   * @returns {Promise<Object>} Result of the storage operation
   */
  async storeCredential(credential) {
    try {
      logger.info(`Storing Credential on Tangle: ${credential.id}`);
      
      // Convert credential to JSON
      const credentialJSON = JSON.stringify(credential);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('VERIFIABLE_CREDENTIAL').toString('hex'),
          data: Buffer.from(credentialJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.info(`Credential stored on Tangle: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error storing Credential: ${error.message}`);
      throw new Error(`Failed to store Credential: ${error.message}`);
    }
  }
  
  /**
   * Verify a credential
   * @param {Object} credential - Verifiable Credential to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyCredential(credential) {
    try {
      logger.info(`Verifying Credential: ${credential.id}`);
      
      // Resolve the issuer's DID
      const issuerDID = credential.issuer;
      const issuerDoc = await this.resolveDID(issuerDID);
      
      if (!issuerDoc) {
        throw new Error(`Issuer DID cannot be resolved: ${issuerDID}`);
      }
      
      // Verify the credential
      const verification = await VerifiableCredential.verify(credential, {
        resolver: this.resolver
      });
      
      // Perform additional verification checks
      const now = new Date();
      const expirationDate = new Date(credential.expirationDate);
      const isExpired = expirationDate < now;
      
      // Check if credential has been revoked
      const isRevoked = await this.checkCredentialRevocation(credential.id);
      
      // Create verification result
      const verificationResult = {
        verified: verification.verified && !isExpired && !isRevoked,
        checks: {
          signature: verification.verified,
          expiration: !isExpired,
          revocation: !isRevoked
        },
        issuer: issuerDID,
        subject: credential.credentialSubject.id,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate,
        verificationType: credential.type.includes('KYCVerification') ? 'KYC' : 'Other'
      };
      
      logger.info(`Credential verification result: ${JSON.stringify(verificationResult)}`);
      return verificationResult;
    }
    catch (error) {
      logger.error(`Error verifying Credential: ${error.message}`);
      throw new Error(`Failed to verify Credential: ${error.message}`);
    }
  }
  
  /**
   * Check if a credential has been revoked
   * @param {string} credentialId - ID of the credential to check
   * @returns {Promise<boolean>} Whether the credential is revoked
   */
  async checkCredentialRevocation(credentialId) {
    try {
      logger.info(`Checking revocation status for Credential: ${credentialId}`);
      
      // Get all transactions with a specific tag
      const tag = Buffer.from('CREDENTIAL_REVOCATION').toString('hex');
      
      // Query for messages with this tag
      // This is a simplified implementation - a real system would use a proper revocation registry
      const messages = await getAddressTransactions(this.client, tag);
      
      // Check if any of the messages contains this credential ID
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.credentialId === credentialId) {
            logger.info(`Credential is revoked: ${credentialId}`);
            return true;
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      logger.info(`Credential is not revoked: ${credentialId}`);
      return false;
    }
    catch (error) {
      logger.error(`Error checking credential revocation: ${error.message}`);
      // Default to not revoked in case of error
      return false;
    }
  }
  
  /**
   * Create a zero-knowledge proof from a credential
   * @param {Object} credential - Verifiable Credential
   * @param {Array} revealedAttributes - Attributes to reveal
   * @param {Object} options - Proof options
   * @returns {Promise<Object>} Zero-knowledge proof
   */
  async createZKProof(credential, revealedAttributes, options = {}) {
    try {
      logger.info(`Creating ZK proof for credential: ${credential.id}`);
      
      // Import ZK proof utilities
      const zkProofs = require('./utils/zk-proofs');
      
      // Default to Pedersen commitments unless specified
      const scheme = options.scheme || zkProofs.ZkProofScheme.PEDERSEN;
      
      // Create the proof using the enhanced ZK proof implementation
      const proof = zkProofs.createProof(credential, revealedAttributes, {
        scheme,
        ...options
      });
      
      // Store proof on Tangle
      const result = await this.storeZKProof(proof);
      
      // Create a response object with important details
      const zkProofResult = {
        id: proof.id,
        proof: proof,
        credentialId: credential.id,
        issuer: credential.issuer,
        revealedAttributes: Object.keys(proof.revealedAttributes),
        proofType: proof.type,
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`,
        created: proof.created
      };
      
      logger.info(`ZK proof created: ${proof.id} using scheme ${scheme}`);
      return zkProofResult;
    }
    catch (error) {
      logger.error(`Error creating ZK proof: ${error.message}`);
      throw new Error(`Failed to create ZK proof: ${error.message}`);
    }
  }
  
  /**
   * Store a ZK proof on the Tangle
   * @param {Object} proof - ZK proof to store
   * @returns {Promise<Object>} Result of the storage operation
   */
  async storeZKProof(proof) {
    try {
      logger.info(`Storing ZK proof on Tangle: ${proof.id}`);
      
      // Convert proof to JSON
      const proofJSON = JSON.stringify(proof);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('ZK_PROOF').toString('hex'),
          data: Buffer.from(proofJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.info(`ZK proof stored on Tangle: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error storing ZK proof: ${error.message}`);
      throw new Error(`Failed to store ZK proof: ${error.message}`);
    }
  }
  
  /**
   * Verify a zero-knowledge proof
   * @param {Object} proof - Zero-knowledge proof
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result with revealed attributes
   */
  async verifyZKProof(proof, options = {}) {
    try {
      logger.info(`Verifying ZK proof: ${proof.id}`);
      
      // Import ZK proof utilities
      const zkProofs = require('./utils/zk-proofs');
      
      // Resolve the issuer's DID if needed
      let issuerDoc;
      if (options.verifyIssuer !== false) {
        const issuerDID = proof.issuer;
        issuerDoc = await this.resolveDID(issuerDID);
        
        if (!issuerDoc) {
          throw new Error(`Issuer DID cannot be resolved: ${issuerDID}`);
        }
        
        logger.info(`Issuer DID resolved: ${issuerDID}`);
      }
      
      // Verify the proof using the enhanced ZK proof implementation
      const verificationResult = zkProofs.verifyProof(proof, {
        ...options,
        issuerDoc
      });
      
      // Add additional information to the result
      const enhancedResult = {
        ...verificationResult,
        proofId: proof.id,
        proofType: proof.type
      };
      
      logger.info(`ZK proof verification result: ${JSON.stringify({
        verified: enhancedResult.verified,
        proofId: enhancedResult.proofId,
        credentialId: enhancedResult.credentialId
      })}`);
      
      return enhancedResult;
    }
    catch (error) {
      logger.error(`Error verifying ZK proof: ${error.message}`);
      throw new Error(`Failed to verify ZK proof: ${error.message}`);
    }
  }
  
  /**
   * Store verification status on the Tangle
   * @param {string} userDID - User's DID
   * @param {string} verificationType - Type of verification
   * @param {boolean} status - Verification status
   * @returns {Promise<Object>} Result of the storage operation
   */
  async storeVerificationStatus(userDID, verificationType, status) {
    try {
      logger.info(`Storing verification status for ${userDID}: ${verificationType} = ${status}`);
      
      // Create verification status object
      const verificationStatus = {
        did: userDID,
        type: verificationType,
        status: status,
        timestamp: new Date().toISOString(),
        id: `verification-${userDID}-${verificationType}-${Date.now()}`
      };
      
      // Convert to JSON
      const statusJSON = JSON.stringify(verificationStatus);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('VERIFICATION_STATUS').toString('hex'),
          data: Buffer.from(statusJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.info(`Verification status stored on Tangle: ${result.blockId}`);
      
      return {
        ...verificationStatus,
        blockId: result.blockId,
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`
      };
    }
    catch (error) {
      logger.error(`Error storing verification status: ${error.message}`);
      throw new Error(`Failed to store verification status: ${error.message}`);
    }
  }
  
  /**
   * Retrieve verification status from the Tangle
   * @param {string} userDID - User's DID
   * @param {string} verificationType - Type of verification
   * @returns {Promise<Object>} Verification status
   */
  async getVerificationStatus(userDID, verificationType) {
    try {
      logger.info(`Retrieving verification status for ${userDID}: ${verificationType}`);
      
      // Get all transactions with a specific tag
      const tag = Buffer.from('VERIFICATION_STATUS').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.client, tag);
      
      // Filter and sort the messages
      const relevantMessages = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.did === userDID && data.type === verificationType) {
            relevantMessages.push({
              ...data,
              blockId: message.blockId
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      // Sort by timestamp, newest first
      relevantMessages.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Return the latest status or null if not found
      if (relevantMessages.length > 0) {
        const latestStatus = relevantMessages[0];
        logger.info(`Found verification status for ${userDID}: ${verificationType} = ${latestStatus.status}`);
        
        return {
          ...latestStatus,
          tangleExplorerUrl: `${config.getExplorerAddressUrl(latestStatus.blockId, this.network)}`
        };
      } else {
        logger.info(`No verification status found for ${userDID}: ${verificationType}`);
        return null;
      }
    }
    catch (error) {
      logger.error(`Error retrieving verification status: ${error.message}`);
      throw new Error(`Failed to retrieve verification status: ${error.message}`);
    }
  }
  
  /**
   * Create a Verifiable Presentation from Verifiable Credentials
   * @param {Array} credentials - Array of Verifiable Credentials
   * @param {string} holderDID - DID of the holder
   * @param {Object} holderKey - Private key of the holder
   * @returns {Promise<Object>} The created Verifiable Presentation
   */
  async createPresentation(credentials, holderDID, holderKey) {
    try {
      logger.info(`Creating Verifiable Presentation for holder: ${holderDID}`);
      
      // Create presentation
      const presentation = await VerifiablePresentation.create({
        id: `${holderDID}#presentation-${Date.now()}`,
        holder: holderDID,
        verifiableCredential: credentials,
        created: new Date().toISOString()
      });
      
      // Sign the presentation
      const signedPresentation = await presentation.sign(holderKey);
      
      // Store presentation on Tangle
      const result = await this.storePresentation(signedPresentation);
      
      // Create a response object with important details
      const presentationResult = {
        id: presentation.id,
        presentation: signedPresentation,
        holder: holderDID,
        credentials: credentials.map(cred => cred.id),
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`,
        created: presentation.created
      };
      
      logger.info(`Verifiable Presentation created: ${presentation.id}`);
      return presentationResult;
    }
    catch (error) {
      logger.error(`Error creating Verifiable Presentation: ${error.message}`);
      throw new Error(`Failed to create Verifiable Presentation: ${error.message}`);
    }
  }
  
  /**
   * Store a Verifiable Presentation on the Tangle
   * @param {Object} presentation - Verifiable Presentation to store
   * @returns {Promise<Object>} Result of the storage operation
   */
  async storePresentation(presentation) {
    try {
      logger.info(`Storing Presentation on Tangle: ${presentation.id}`);
      
      // Convert presentation to JSON
      const presentationJSON = JSON.stringify(presentation);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('VERIFIABLE_PRESENTATION').toString('hex'),
          data: Buffer.from(presentationJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.info(`Presentation stored on Tangle: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error storing Presentation: ${error.message}`);
      throw new Error(`Failed to store Presentation: ${error.message}`);
    }
  }
  
  /**
   * Verify a Verifiable Presentation
   * @param {Object} presentation - Verifiable Presentation to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyPresentation(presentation) {
    try {
      logger.info(`Verifying Presentation: ${presentation.id}`);
      
      // Verify the presentation
      const verification = await VerifiablePresentation.verify(presentation, {
        resolver: this.resolver
      });
      
      // Verify each credential in the presentation
      const credentialResults = [];
      
      for (const credential of presentation.verifiableCredential) {
        try {
          const credentialVerification = await this.verifyCredential(credential);
          credentialResults.push({
            id: credential.id,
            verified: credentialVerification.verified,
            type: credential.type
          });
        } catch (error) {
          credentialResults.push({
            id: credential.id,
            verified: false,
            error: error.message
          });
        }
      }
      
      // Create verification result
      const allCredentialsVerified = credentialResults.every(result => result.verified);
      
      const verificationResult = {
        verified: verification.verified && allCredentialsVerified,
        presentationVerified: verification.verified,
        allCredentialsVerified,
        holder: presentation.holder,
        credentials: credentialResults,
        created: presentation.created
      };
      
      logger.info(`Presentation verification result: ${JSON.stringify(verificationResult)}`);
      return verificationResult;
    }
    catch (error) {
      logger.error(`Error verifying Presentation: ${error.message}`);
      throw new Error(`Failed to verify Presentation: ${error.message}`);
    }
  }
}

module.exports = IOTAIdentity;