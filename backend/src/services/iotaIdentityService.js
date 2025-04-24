/**
 * IOTA Identity Service
 * Handles identity verification and management using IOTA's identity framework
 */

const { Identity, DID, VerifiableCredential, VerifiablePresentation, Resolver } = require('@iota/identity-wasm/node');
const { ethers } = require('ethers');
const crypto = require('crypto');
const iotaBlockchainService = require('./iotaBlockchainService');
const config = require('../../config/iota-config');
const logger = require('../utils/logger');

class IOTAIdentityService {
  constructor() {
    this.initialize();
  }

  /**
   * Initialize the IOTA Identity client
   */
  async initialize() {
    try {
      // Initialize Identity client
      this.client = new Identity.Client({
        node: config.identity.didNetworkUrl,
        network: config.identity.didMethod
      });
      
      // Initialize DID resolver
      this.resolver = new Resolver.Resolver({
        node: config.identity.didNetworkUrl
      });
      
      // Generate issuer DID if not already created (in production, this would be stored securely)
      if (!process.env.ISSUER_DID || !process.env.ISSUER_PRIVATE_KEY) {
        logger.info('No issuer DID found. Creating new issuer DID...');
        await this.generateIssuerDID();
      } else {
        this.issuerDID = process.env.ISSUER_DID;
        this.issuerPrivateKey = process.env.ISSUER_PRIVATE_KEY;
        logger.info(`Using existing issuer DID: ${this.issuerDID}`);
      }
      
      logger.info('IOTA Identity Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing IOTA Identity Service: ${error.message}`);
      throw error;
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
      
      return {
        credential: credential.credential,
        creditScore
      };
    } catch (error) {
      logger.error(`Error updating credit score for ${did}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new IOTAIdentityService();
