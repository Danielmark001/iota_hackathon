/**
 * Zero-Knowledge Proof Utilities
 * 
 * Provides utilities for creating and verifying zero-knowledge proofs
 * for privacy-preserving identity verification on IOTA.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const logger = require('./logger');

class ZKProof {
  /**
   * Create a zero-knowledge proof of identity attributes
   * 
   * @param {Object} identity - Identity data
   * @param {Object} options - Proof options
   * @returns {Object} ZK proof
   */
  static createIdentityProof(identity, options = {}) {
    try {
      logger.debug('Creating ZK proof for identity attributes');
      
      const {
        disclosureLevel = 'minimal',
        privateAttributes = [],
        publicAttributes = ['verificationLevel'],
        challenge = crypto.randomBytes(32).toString('hex')
      } = options;
      
      // Determine which attributes to disclose based on disclosure level
      let attributesToDisclose = [];
      
      switch (disclosureLevel) {
        case 'none':
          // Don't disclose any attributes
          attributesToDisclose = [];
          break;
        case 'minimal':
          // Disclose only required attributes
          attributesToDisclose = [...publicAttributes];
          break;
        case 'partial':
          // Disclose all attributes except private ones
          attributesToDisclose = Object.keys(identity).filter(attr => 
            !privateAttributes.includes(attr)
          );
          break;
        case 'full':
          // Disclose all attributes
          attributesToDisclose = Object.keys(identity);
          break;
        default:
          attributesToDisclose = [...publicAttributes];
      }
      
      // Create disclosed values
      const disclosedValues = {};
      attributesToDisclose.forEach(attr => {
        if (identity[attr] !== undefined) {
          disclosedValues[attr] = identity[attr];
        }
      });
      
      // Create hashes of undisclosed values
      const undisclosedHashes = {};
      Object.keys(identity).forEach(attr => {
        if (!attributesToDisclose.includes(attr)) {
          // Create salted hash of the attribute value
          const salt = crypto.randomBytes(16).toString('hex');
          const valueToHash = `${attr}:${identity[attr]}:${salt}`;
          const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(valueToHash));
          
          undisclosedHashes[attr] = {
            hash,
            salt // Store salt for later verification
          };
        }
      });
      
      // Create proof
      const proofData = {
        disclosedValues,
        undisclosedHashes,
        challenge,
        timestamp: Date.now(),
        schemaVersion: '1.0'
      };
      
      // Sign the proof
      const proofHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(JSON.stringify(proofData))
      );
      
      return {
        proof: proofData,
        proofHash
      };
    } catch (error) {
      logger.error(`Error creating ZK proof: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify a zero-knowledge proof of identity attributes
   * 
   * @param {Object} proof - ZK proof
   * @param {Object} options - Verification options
   * @returns {Object} Verification result
   */
  static verifyIdentityProof(proof, options = {}) {
    try {
      logger.debug('Verifying ZK proof for identity attributes');
      
      const {
        requiredAttributes = [],
        challenge = null, // If provided, must match the challenge in the proof
        maxAgeMs = 3600000 // 1 hour by default
      } = options;
      
      // Basic validation
      if (!proof || !proof.proof || !proof.proofHash) {
        return {
          valid: false,
          error: 'Invalid proof format'
        };
      }
      
      // Check proof age
      const proofAge = Date.now() - proof.proof.timestamp;
      if (proofAge > maxAgeMs) {
        return {
          valid: false,
          error: 'Proof has expired',
          age: proofAge
        };
      }
      
      // Check challenge if provided
      if (challenge && proof.proof.challenge !== challenge) {
        return {
          valid: false,
          error: 'Challenge mismatch'
        };
      }
      
      // Verify hash
      const calculatedHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(JSON.stringify(proof.proof))
      );
      
      if (calculatedHash !== proof.proofHash) {
        return {
          valid: false,
          error: 'Proof hash mismatch'
        };
      }
      
      // Check required attributes
      const missingAttributes = requiredAttributes.filter(attr => 
        !proof.proof.disclosedValues[attr]
      );
      
      if (missingAttributes.length > 0) {
        return {
          valid: false,
          error: 'Missing required attributes',
          missingAttributes
        };
      }
      
      return {
        valid: true,
        disclosedAttributes: Object.keys(proof.proof.disclosedValues),
        values: proof.proof.disclosedValues
      };
    } catch (error) {
      logger.error(`Error verifying ZK proof: ${error.message}`);
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create a proof for a specific attribute value without revealing the value
   * 
   * @param {string} attribute - Attribute name
   * @param {any} value - Attribute value
   * @param {string} secret - Secret for proof
   * @returns {Object} Proof of attribute value
   */
  static createAttributeProof(attribute, value, secret) {
    try {
      // Convert value to string
      const valueStr = value.toString();
      
      // Create hash of the value with the secret
      const valueHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${valueStr}:${secret}`)
      );
      
      // Create proof
      return {
        attribute,
        valueHash,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error creating attribute proof: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify a range proof (e.g., creditScore > 700)
   * 
   * @param {string} attribute - Attribute name
   * @param {any} value - Value to check against
   * @param {string} operator - Comparison operator ('gt', 'lt', 'eq', etc.)
   * @param {Object} proof - Proof to verify
   * @param {string} secret - Secret used to create the proof
   * @returns {boolean} Whether the proof is valid
   */
  static verifyRangeProof(attribute, value, operator, proof, secret) {
    try {
      if (proof.attribute !== attribute) {
        return false;
      }
      
      // Convert value to string
      const valueStr = value.toString();
      
      // Create hash of the value with the secret
      const valueHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(`${valueStr}:${secret}`)
      );
      
      // For 'eq' operator, we can directly compare hashes
      if (operator === 'eq') {
        return valueHash === proof.valueHash;
      }
      
      // For other operators, we need a more complex ZKP approach
      // This is a simplified version; real ZK range proofs use more complex cryptography
      logger.warn('Complex range proofs require a full ZK protocol implementation');
      
      return false;
    } catch (error) {
      logger.error(`Error verifying range proof: ${error.message}`);
      return false;
    }
  }
}

class CircuitRunner {
  /**
   * Create a new circuit runner
   * 
   * @param {Object} options - Circuit options
   */
  constructor(options = {}) {
    this.options = options;
    logger.debug('Initializing ZK circuit runner');
  }
  
  /**
   * Generate a proof using a predefined circuit
   * 
   * @param {string} circuitType - Type of circuit to use
   * @param {Object} inputs - Circuit inputs
   * @returns {Promise<Object>} Generated proof
   */
  async generateProof(circuitType, inputs) {
    try {
      logger.debug(`Generating proof using ${circuitType} circuit`);
      
      // In a real implementation, this would use a proper ZK-SNARK library
      // such as snarkjs, circom, or zokrates
      
      // For now, we'll simulate proof generation
      const proof = {
        circuitType,
        inputs: Object.keys(inputs),
        proof: crypto.randomBytes(128).toString('hex'),
        publicSignals: [
          crypto.randomBytes(32).toString('hex')
        ],
        timestamp: Date.now()
      };
      
      return proof;
    } catch (error) {
      logger.error(`Error generating ZK proof: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verify a proof against a predefined circuit
   * 
   * @param {string} circuitType - Type of circuit used
   * @param {Object} proof - Proof to verify
   * @param {Object} publicInputs - Public inputs for verification
   * @returns {Promise<boolean>} Whether the proof is valid
   */
  async verifyProof(circuitType, proof, publicInputs) {
    try {
      logger.debug(`Verifying proof for ${circuitType} circuit`);
      
      // In a real implementation, this would use a proper ZK-SNARK verification
      
      // For now, just check proof format and structure
      if (!proof || !proof.circuitType || !proof.proof || !proof.publicSignals) {
        return false;
      }
      
      if (proof.circuitType !== circuitType) {
        return false;
      }
      
      // Simulate verification
      return true;
    } catch (error) {
      logger.error(`Error verifying ZK proof: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Generate a proof for identity verification
   * 
   * @param {Object} identity - Identity data
   * @param {Array<string>} attributesToProve - Attributes to include in the proof
   * @returns {Promise<Object>} Identity proof
   */
  async generateIdentityProof(identity, attributesToProve) {
    try {
      logger.debug('Generating identity verification proof');
      
      // Prepare inputs for the circuit
      const inputs = {};
      
      attributesToProve.forEach(attr => {
        if (identity[attr] !== undefined) {
          inputs[attr] = identity[attr];
        }
      });
      
      // Generate proof
      return this.generateProof('identity', inputs);
    } catch (error) {
      logger.error(`Error generating identity proof: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate a proof for credit score verification
   * 
   * @param {number} creditScore - Credit score value
   * @param {number} threshold - Threshold to prove against
   * @param {string} operator - Comparison operator ('gt', 'lt', 'eq')
   * @returns {Promise<Object>} Credit score proof
   */
  async generateCreditScoreProof(creditScore, threshold, operator = 'gt') {
    try {
      logger.debug(`Generating credit score proof (${operator} ${threshold})`);
      
      // Prepare inputs for the circuit
      const inputs = {
        creditScore,
        threshold,
        operator
      };
      
      // Generate proof
      return this.generateProof('creditScore', inputs);
    } catch (error) {
      logger.error(`Error generating credit score proof: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  ZKProof,
  CircuitRunner
};
