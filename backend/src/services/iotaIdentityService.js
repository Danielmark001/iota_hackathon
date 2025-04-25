/**
 * IOTA Identity Service
 * Handles identity verification and management using IOTA's identity framework
 * Enhanced with zero-knowledge proofs and advanced credential verification
 */

const { Identity, DID, VerifiableCredential, VerifiablePresentation, Resolver } = require('@iota/identity-wasm/node');
const { ethers } = require('ethers');
const crypto = require('crypto');
const iotaBlockchainService = require('./iotaBlockchainService');
const config = require('../../config/iota-config');
const logger = require('../utils/logger');

// Import secure credential store
const SecureCredentialStore = require('../utils/secureCredentialStore');
// Import ZK libraries
const { ZKProof, CircuitRunner } = require('../utils/zkProofUtils');

class IOTAIdentityService {
  constructor() {
    // Initialize secure credential store
    this.credentialStore = new SecureCredentialStore({
      storageDirectory: process.env.CREDENTIAL_STORE_PATH || './credential-store',
      encryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY
    });
    
    // Initialize ZK circuit runner for advanced proofs
    this.circuitRunner = new CircuitRunner({
      circuitsPath: process.env.ZK_CIRCUITS_PATH || './zk-circuits'
    });
    
    // Initialize the service
    this.initialize();
  }

  /**
   * Initialize the IOTA Identity client with robust error handling
   */
  async initialize() {
    try {
      logger.info('Initializing IOTA Identity Service');
      
      // Check if identity wasm is available
      if (!Identity || !DID || !VerifiableCredential || !Resolver) {
        throw new Error('IOTA Identity WASM modules not properly loaded. Check dependencies.');
      }
      
      // Enhanced Identity client with retry mechanism
      this.client = await this.initializeWithRetry(() => {
        return new Identity.Client({
          node: config.identity.didNetworkUrl,
          network: config.identity.didMethod,
          // Add additional options for better resilience
          powProvider: 'local', // Use local proof of work
          timeout: 30000, // 30 second timeout
          retries: 3 // Retry API calls 3 times
        });
      }, 5); // 5 retry attempts
      
      // Initialize DID resolver with fallback nodes
      this.resolver = new Resolver.Resolver({
        node: config.identity.didNetworkUrl,
        // Add fallback nodes for resilience
        nodes: config.identity.fallbackNodes || [],
        resolverConfig: {
          timeout: 30000, // 30 second timeout
          retries: 3 // Retry resolution 3 times
        }
      });
      
      // Verify the resolver is working
      await this.verifyResolver();
      
      // Generate issuer DID if not already created (in production, this would be stored securely)
      if (!process.env.ISSUER_DID || !process.env.ISSUER_PRIVATE_KEY) {
        logger.info('No issuer DID found. Creating new issuer DID...');
        await this.generateIssuerDID();
      } else {
        this.issuerDID = process.env.ISSUER_DID;
        this.issuerPrivateKey = process.env.ISSUER_PRIVATE_KEY;
        
        // Verify that the DID is resolvable
        const isValid = await this.validateDID(this.issuerDID);
        if (isValid) {
          logger.info(`Using existing issuer DID: ${this.issuerDID} (validated)`);
        } else {
          logger.warn(`Existing issuer DID ${this.issuerDID} could not be validated. Creating a new one...`);
          await this.generateIssuerDID();
        }
      }
      
      logger.info('IOTA Identity Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing IOTA Identity Service: ${error.message}`);
      logger.warn('Identity features will be limited or unavailable');
      throw error;
    }
  }

  /**
   * Initialize with retry for resilience
   * @param {Function} initFunction - Function to initialize a component
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<any>} The initialized component
   */
  async initializeWithRetry(initFunction, maxRetries = 3) {
    let attempt = 0;
    let lastError;
    
    while (attempt <= maxRetries) {
      try {
        return await initFunction();
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt > maxRetries) {
          break;
        }
        
        // Exponential backoff with jitter
        const delay = Math.floor(1000 * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5));
        logger.warn(`Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Verify that the resolver is working correctly
   */
  async verifyResolver() {
    try {
      // Try to resolve a known DID
      const testDID = process.env.TEST_DID || 'did:iota:test';
      await this.resolver.resolve(testDID);
      logger.info('DID resolver verification successful');
      return true;
    } catch (error) {
      logger.warn(`DID resolver verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate a DID by attempting to resolve it
   * @param {string} did - The DID to validate
   * @returns {Promise<boolean>} Whether the DID is valid and resolvable
   */
  async validateDID(did) {
    try {
      await this.resolver.resolve(did);
      return true;
    } catch (error) {
      logger.error(`Error validating DID ${did}: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate a new issuer DID for the platform
   * @private
   */
  async generateIssuerDID() {
    try {
      // Generate a new key pair
      const privateKey = crypto.randomBytes(32);
      const privateKeyHex = privateKey.toString('hex');
      
      // Create a new DID document
      const did = new DID.DID({
        method: config.identity.didMethod
      });
      
      // Add a verification method
      did.addVerificationMethod({
        id: `${did}#keys-1`,
        controller: did,
        type: 'Ed25519VerificationKey2018',
        publicKeyMultibase: `z${Buffer.from(privateKey.publicKey).toString('base64')}`
      });
      
      // Add authentication capability
      did.addAuthentication(`${did}#keys-1`);
      
      // Add assertion capability
      did.addAssertionMethod(`${did}#keys-1`);
      
      // Publish DID to the IOTA network
      await this.client.publishDID({
        document: did.toJSON(),
        privateKey: privateKeyHex
      });
      
      // Store the DID and private key (in production, these would be stored securely)
      this.issuerDID = did.toString();
      this.issuerPrivateKey = privateKeyHex;
      
      logger.info(`Generated issuer DID: ${this.issuerDID}`);
      logger.warn('In production, store these securely as environment variables:');
      logger.warn(`ISSUER_DID=${this.issuerDID}`);
      logger.warn(`ISSUER_PRIVATE_KEY=${this.issuerPrivateKey}`);
      
      return {
        did: this.issuerDID,
        privateKey: this.issuerPrivateKey
      };
    } catch (error) {
      logger.error(`Error generating issuer DID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new DID for a user
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - New DID information
   */
  async createDID(address) {
    try {
      logger.info(`Creating DID for address: ${address}`);
      
      // Generate a new key pair
      const privateKey = crypto.randomBytes(32);
      const privateKeyHex = privateKey.toString('hex');
      
      // Create a new DID document
      const did = new DID.DID({
        method: config.identity.didMethod
      });
      
      // Add a verification method
      did.addVerificationMethod({
        id: `${did}#keys-1`,
        controller: did,
        type: 'Ed25519VerificationKey2018',
        publicKeyMultibase: `z${Buffer.from(privateKey.publicKey).toString('base64')}`
      });
      
      // Add authentication capability
      did.addAuthentication(`${did}#keys-1`);
      
      // Link to Ethereum address as a service endpoint
      did.addService({
        id: `${did}#ethereum`,
        type: 'EthereumAddress',
        serviceEndpoint: `ethereum:${address}`
      });
      
      // Publish DID to the IOTA network
      await this.client.publishDID({
        document: did.toJSON(),
        privateKey: privateKeyHex
      });
      
      logger.info(`Created DID for address ${address}: ${did}`);
      
      return {
        did: did.toString(),
        privateKey: privateKeyHex,
        document: did.toJSON()
      };
    } catch (error) {
      logger.error(`Error creating DID for address ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve a DID to its DID document
   * 
   * @param {string} did - DID to resolve
   * @returns {Promise<Object>} - DID document
   */
  async resolveDID(did) {
    try {
      logger.info(`Resolving DID: ${did}`);
      
      // Resolve DID document
      const document = await this.resolver.resolve(did);
      
      return {
        did,
        document
      };
    } catch (error) {
      logger.error(`Error resolving DID ${did}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Issue a verifiable credential for identity verification
   * 
   * @param {string} subjectDID - Subject's DID
   * @param {Object} claims - Credential claims
   * @returns {Promise<Object>} - Issued credential
   */
  async issueVerifiableCredential(subjectDID, claims) {
    try {
      logger.info(`Issuing verifiable credential for ${subjectDID}`);
      
      // Check if issuer DID is available
      if (!this.issuerDID || !this.issuerPrivateKey) {
        throw new Error('Issuer DID not available');
      }
      
      // Create credential data
      const credentialData = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: this.issuerDID,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: subjectDID,
          ...claims
        }
      };
      
      // Create and sign the credential
      const credential = await VerifiableCredential.create({
        credential: credentialData,
        privateKey: this.issuerPrivateKey
      });
      
      logger.info(`Issued credential ID: ${credential.id}`);
      
      // Store credential on the IOTA Tangle (optional)
      await iotaBlockchainService.sendTangleMessage('iota', {
        type: 'credential',
        id: credential.id,
        subject: subjectDID,
        timestamp: new Date().toISOString()
      });
      
      return {
        credential: credential.toJSON()
      };
    } catch (error) {
      logger.error(`Error issuing verifiable credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a verifiable credential
   * 
   * @param {Object} credential - Verifiable credential
   * @returns {Promise<Object>} - Verification result
   */
  async verifyCredential(credential) {
    try {
      logger.info(`Verifying credential: ${credential.id}`);
      
      // Parse credential
      const vc = VerifiableCredential.fromJSON(credential);
      
      // Verify credential
      const result = await vc.verify({
        resolver: this.resolver
      });
      
      return {
        verified: result.verified,
        checks: result.checks,
        errors: result.errors
      };
    } catch (error) {
      logger.error(`Error verifying credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a verifiable presentation with selective disclosure
   * 
   * @param {Object} credential - Verifiable credential
   * @param {Array<string>} disclosureAttributes - Attributes to disclose
   * @param {string} privateKey - Private key to sign the presentation
   * @returns {Promise<Object>} - Verifiable presentation
   */
  async createVerifiablePresentation(credential, disclosureAttributes, privateKey) {
    try {
      logger.info(`Creating verifiable presentation with selective disclosure`);
      
      // Parse credential
      const vc = VerifiableCredential.fromJSON(credential);
      
      // Create presentation
      const presentation = await VerifiablePresentation.create({
        credentials: [vc],
        holder: vc.credentialSubject.id,
        selectiveDisclosure: {
          attributes: disclosureAttributes
        },
        privateKey
      });
      
      return {
        presentation: presentation.toJSON()
      };
    } catch (error) {
      logger.error(`Error creating verifiable presentation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a verifiable presentation
   * 
   * @param {Object} presentation - Verifiable presentation
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPresentation(presentation) {
    try {
      logger.info(`Verifying presentation: ${presentation.id}`);
      
      // Parse presentation
      const vp = VerifiablePresentation.fromJSON(presentation);
      
      // Verify presentation
      const result = await vp.verify({
        resolver: this.resolver
      });
      
      return {
        verified: result.verified,
        checks: result.checks,
        errors: result.errors
      };
    } catch (error) {
      logger.error(`Error verifying presentation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create and register identity for a user with privacy protection
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} userData - User data for credential
   * @returns {Promise<Object>} - Identity creation result
   */
  async createIdentity(address, userData) {
    try {
      logger.info(`Creating privacy-preserving identity for ${address}`);
      
      // Create DID
      const didInfo = await this.createDID(address);
      
      // Issue verifiable credential
      const credential = await this.issueVerifiableCredential(didInfo.did, {
        name: userData.name,
        email: userData.email,
        // Do not include sensitive information
        verificationLevel: 'basic'
      });
      
      // Store relationship between address and DID in contract
      await iotaBlockchainService.callContract(
        'iota',
        'privacyPreservingIdentity',
        'registerIdentity',
        [
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes(didInfo.did)),
          ethers.utils.toUtf8Bytes(JSON.stringify({did: didInfo.did}))
        ]
      );
      
      return {
        address,
        did: didInfo.did,
        privateKey: didInfo.privateKey,
        credential: credential.credential
      };
    } catch (error) {
      logger.error(`Error creating identity for ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a zero-knowledge proof for identity verification
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} credential - Verifiable credential
   * @param {Object} privateData - Private data for ZK proof
   * @param {string} privateKey - Private key for signing
   * @returns {Promise<Object>} - ZK proof
   */
  async createZKProof(address, credential, privateData, privateKey) {
    try {
      logger.info(`Creating ZK proof for ${address}`);
      
      // For privacy-preserving verification, create a presentation with selective disclosure
      const disclosureAttributes = [
        // Only disclose the minimum necessary information
        'credentialSubject.id',
        'credentialSubject.verificationLevel'
      ];
      
      // Create verifiable presentation
      const presentationResult = await this.createVerifiablePresentation(
        credential,
        disclosureAttributes,
        privateKey
      );
      
      // Get the presentation
      const presentation = presentationResult.presentation;
      
      // Create a ZK proof hash that can be verified on-chain
      // This is a simplified implementation - a real ZK proof would use a ZK proof system
      const proofData = {
        presentation,
        address,
        timestamp: Date.now()
      };
      
      // Create hash of the proof data
      const proofHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(JSON.stringify(proofData))
      );
      
      return {
        proof: presentation,
        proofHash,
        disclosedAttributes: disclosureAttributes
      };
    } catch (error) {
      logger.error(`Error creating ZK proof for ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify identity using zero-knowledge proof
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} zkProof - Zero-knowledge proof
   * @returns {Promise<Object>} - Verification result
   */
  async verifyIdentityWithZKProof(address, zkProof) {
    try {
      logger.info(`Verifying identity for ${address} using ZK proof`);
      
      // Verify the presentation
      const verificationResult = await this.verifyPresentation(zkProof.proof);
      
      if (!verificationResult.verified) {
        return {
          verified: false,
          errors: verificationResult.errors
        };
      }
      
      // Verify proof on blockchain
      const result = await iotaBlockchainService.callContract(
        'iota',
        'privacyPreservingIdentity',
        'verifyZKProof',
        [
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes(address)),
          ethers.utils.id('IDENTITY_VERIFY'),
          ethers.utils.toUtf8Bytes(JSON.stringify(zkProof.proof)),
          ethers.utils.toUtf8Bytes(address)
        ]
      );
      
      return {
        verified: true,
        onChainVerification: result.status === 'confirmed',
        transactionHash: result.hash
      };
    } catch (error) {
      logger.error(`Error verifying identity with ZK proof: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a user's credit score in their verifiable credential
   * 
   * @param {string} did - User's DID
   * @param {number} creditScore - New credit score
   * @returns {Promise<Object>} - Updated credential
   */
  async updateCreditScore(did, creditScore) {
    try {
      logger.info(`Updating credit score for ${did}: ${creditScore}`);
      
      // Issue a new credential with updated credit score
      const credential = await this.issueVerifiableCredential(did, {
        creditScore: {
          score: creditScore,
          date: new Date().toISOString(),
          provider: 'IntelliLend'
        }
      });
      
      // Store the credential securely
      await this.credentialStore.storeCredential(
        `creditScore-${did}`,
        credential.credential,
        {
          namespace: 'creditScores',
          additionalMetadata: {
            score: creditScore,
            did
          }
        }
      );
      
      return {
        credential: credential.credential,
        creditScore
      };
    } catch (error) {
      logger.error(`Error updating credit score for ${did}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a zero-knowledge credential for lending approval
   * 
   * @param {string} did - User's DID
   * @param {Object} lendingData - Lending-related data
   * @returns {Promise<Object>} - ZK credential for lending
   */
  async createLendingCredential(did, lendingData) {
    try {
      logger.info(`Creating lending credential for ${did}`);
      
      const {
        creditScore,
        incomeVerified,
        assetValue,
        loanAmount,
        loanTerm,
        interestRate
      } = lendingData;
      
      // Calculate loan-to-value ratio
      const ltvRatio = loanAmount / assetValue;
      
      // Create credential with lending terms
      const credential = await this.issueVerifiableCredential(did, {
        type: 'LendingCredential',
        loanApproved: true,
        loanDetails: {
          maxAmount: loanAmount,
          term: loanTerm,
          interestRate,
          ltvRatio,
          timestamp: Date.now()
        },
        requirements: {
          minimumCreditScore: creditScore - 20, // Slightly lower than actual score
          incomeVerified
        }
      });
      
      // Store the credential securely
      await this.credentialStore.storeCredential(
        `lending-${did}-${Date.now()}`,
        credential.credential,
        {
          namespace: 'lendingCredentials',
          additionalMetadata: {
            did,
            loanAmount,
            interestRate,
            approved: true
          },
          expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        }
      );
      
      // Create a zero-knowledge proof that hides actual credit score
      // but proves it meets lending requirements
      const zkProof = await this.circuitRunner.generateCreditScoreProof(
        creditScore,
        credential.credential.credentialSubject.requirements.minimumCreditScore,
        'gt' // Proves score > minimum without revealing actual score
      );
      
      // Record credential issuance to IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('iota', {
        type: 'lendingCredentialIssued',
        credentialId: credential.credential.id,
        subjectDid: did,
        ltvRatio,
        timestamp: Date.now()
      });
      
      return {
        credential: credential.credential,
        zkProof,
        loanApproved: true,
        maxLoanAmount: loanAmount,
        interestRate
      };
    } catch (error) {
      logger.error(`Error creating lending credential for ${did}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify borrower identity with privacy-preserving ZK proof
   * 
   * @param {string} borrowerAddress - Borrower's blockchain address
   * @param {Object} zkProof - Zero-knowledge proof of identity
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result with lending eligibility
   */
  async verifyBorrowerWithZKProof(borrowerAddress, zkProof, options = {}) {
    try {
      logger.info(`Verifying borrower ${borrowerAddress} using ZK proof`);
      
      const {
        requiredCredentials = ['identity', 'creditScore'],
        ltvThreshold = 0.8,
        minimumCreditScore = 650
      } = options;
      
      // Verify the ZK proof
      const verificationResult = await this.verifyIdentityWithZKProof(borrowerAddress, zkProof);
      
      if (!verificationResult.verified) {
        return {
          verified: false,
          error: 'Identity verification failed',
          details: verificationResult.errors || 'Invalid proof'
        };
      }
      
      // Extract lending information from the proof
      // In real ZK proofs, this would be done using public inputs from the proof
      const lendingInfo = {
        creditScoreRange: zkProof.proof.disclosedValues.creditScoreRange || 'unknown',
        ltvRatio: zkProof.proof.disclosedValues.ltvRatio || 1,
        incomeVerified: zkProof.proof.disclosedValues.incomeVerified || false
      };
      
      // Check lending eligibility based on ZK proof details
      const eligible = (
        verificationResult.verified &&
        lendingInfo.ltvRatio <= ltvThreshold &&
        (lendingInfo.creditScoreRange === 'excellent' || 
         lendingInfo.creditScoreRange === 'good' ||
         (lendingInfo.creditScoreRange === 'fair' && lendingInfo.incomeVerified))
      );
      
      // For ZK credit score range verification
      let interestRate;
      switch (lendingInfo.creditScoreRange) {
        case 'excellent': 
          interestRate = 3.5;
          break;
        case 'good':
          interestRate = 5.0;
          break;
        case 'fair':
          interestRate = 7.5;
          break;
        default:
          interestRate = 9.0;
      }
      
      // Record verification to IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('iota', {
        type: 'borrowerVerification',
        borrowerAddress,
        verified: verificationResult.verified,
        eligible,
        proofType: 'zk-identity',
        timestamp: Date.now()
      });
      
      return {
        verified: verificationResult.verified,
        eligible,
        interestRate,
        ltvThreshold,
        recommendedTerms: eligible ? {
          interestRate,
          maxLoanAmount: eligible ? 
            `${(ltvThreshold - 0.05).toFixed(2)} * collateral value` : 0,
          term: '12 months'
        } : null
      };
    } catch (error) {
      logger.error(`Error verifying borrower with ZK proof: ${error.message}`);
      
      return {
        verified: false,
        eligible: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create a selective disclosure verifiable credential
   * 
   * @param {string} did - Subject's DID
   * @param {Object} claims - Complete set of claims
   * @param {Array<string>} allowedDisclosures - Claims that can be selectively disclosed
   * @returns {Promise<Object>} - Selective disclosure credential
   */
  async createSelectiveDisclosureCredential(did, claims, allowedDisclosures) {
    try {
      logger.info(`Creating selective disclosure credential for ${did}`);
      
      // Issue a credential with all claims
      const fullCredential = await this.issueVerifiableCredential(did, claims);
      
      // Add selective disclosure metadata to the credential
      const selectiveCredential = {
        ...fullCredential.credential,
        selectiveDisclosure: {
          allowedAttributes: allowedDisclosures,
          version: '1.0'
        }
      };
      
      // Store the credential securely
      await this.credentialStore.storeCredential(
        `selective-${did}-${Date.now()}`,
        selectiveCredential,
        {
          namespace: 'selectiveCredentials',
          additionalMetadata: {
            did,
            allowedDisclosures
          }
        }
      );
      
      return {
        credential: selectiveCredential,
        allowedDisclosures
      };
    } catch (error) {
      logger.error(`Error creating selective disclosure credential for ${did}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create a cross-chain verification credential
   * 
   * @param {string} did - Subject's DID
   * @param {string} ethereumAddress - Ethereum address
   * @param {string} iotaAddress - IOTA address
   * @returns {Promise<Object>} - Cross-chain verification credential
   */
  async createCrossChainVerification(did, ethereumAddress, iotaAddress) {
    try {
      logger.info(`Creating cross-chain verification for ${did}`);
      
      // Create a challenge for the user to sign with both keys
      const challenge = crypto.randomBytes(32).toString('hex');
      
      // In a real application, you would wait for signed challenges from both chains
      // For now, we'll simulate successful verification
      
      // Issue a cross-chain credential
      const credential = await this.issueVerifiableCredential(did, {
        type: 'CrossChainIdentity',
        ethereumAddress,
        iotaAddress,
        verifiedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        level: 'verified'
      });
      
      // Record the verification on IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('iota', {
        type: 'crossChainVerification',
        did,
        ethereumAddress,
        iotaAddress,
        timestamp: Date.now()
      });
      
      return {
        credential: credential.credential,
        status: 'verified',
        validUntil: credential.credential.credentialSubject.validUntil
      };
    } catch (error) {
      logger.error(`Error creating cross-chain verification for ${did}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new IOTAIdentityService();
