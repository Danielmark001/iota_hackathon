/**
 * Privacy-Preserving Identity Service
 * Manages identity verification and credit scoring with privacy protection
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// Mock ZK proof libraries (in a real application, would use actual ZK libraries)
const mockZkProofLib = {
  generateProof: async (input, circuit) => {
    // Simulate proof generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      pi_a: [
        `0x${crypto.randomBytes(32).toString('hex')}`,
        `0x${crypto.randomBytes(32).toString('hex')}`
      ],
      pi_b: [
        [
          `0x${crypto.randomBytes(32).toString('hex')}`,
          `0x${crypto.randomBytes(32).toString('hex')}`
        ],
        [
          `0x${crypto.randomBytes(32).toString('hex')}`,
          `0x${crypto.randomBytes(32).toString('hex')}`
        ]
      ],
      pi_c: [
        `0x${crypto.randomBytes(32).toString('hex')}`,
        `0x${crypto.randomBytes(32).toString('hex')}`
      ],
      protocol: "groth16",
      curve: "bn128"
    };
  },
  
  verifyProof: async (proof, publicInputs) => {
    // Simulate verification (always returns true in this mock)
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
};

class IdentityService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
    
    // Initialize contracts
    this.contracts = {
      identity: new ethers.Contract(
        config.contracts.privacyPreservingIdentity.address,
        config.contracts.privacyPreservingIdentity.abi,
        this.wallet
      )
    };
  }

  /**
   * Derives an identity hash from a blockchain address
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<string>} - Derived identity hash
   */
  async deriveIdentityHash(address) {
    try {
      logger.info(`Deriving identity hash for ${address}`);
      
      // Call the contract to derive the hash
      const identityHash = await this.contracts.identity.addressToIdentityHash(address);
      
      return identityHash;
    } catch (error) {
      logger.error(`Error deriving identity hash for ${address}: ${error.message}`);
      
      // Fallback to local derivation
      return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string', 'address'],
          ['did:iota:', address]
        )
      );
    }
  }

  /**
   * Checks if an identity is registered and verified
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Identity status
   */
  async checkIdentityStatus(address) {
    try {
      logger.info(`Checking identity status for ${address}`);
      
      const identityHash = await this.deriveIdentityHash(address);
      
      // Check if identity is registered
      let isRegistered = false;
      let isVerified = false;
      let registrationTime = null;
      let verificationTime = null;
      let creditScore = null;
      let lastScoreUpdate = null;
      
      try {
        // Try to get identity details
        const identity = await this.contracts.identity.identities(identityHash);
        
        isRegistered = identity.registrationTime.toNumber() > 0;
        isVerified = identity.verified;
        
        if (isRegistered) {
          registrationTime = new Date(identity.registrationTime.toNumber() * 1000);
        }
        
        if (isVerified) {
          verificationTime = new Date(identity.verificationTime.toNumber() * 1000);
          
          // Get credit score if verified
          const creditScoreData = await this.contracts.identity.getCreditScore(identityHash);
          creditScore = creditScoreData.score.toNumber();
          lastScoreUpdate = new Date(creditScoreData.lastUpdated.toNumber() * 1000);
        }
      } catch (error) {
        logger.warn(`No identity found for ${address}: ${error.message}`);
        
        // Identity not registered
        isRegistered = false;
      }
      
      return {
        address,
        identityHash,
        isRegistered,
        isVerified,
        registrationTime,
        verificationTime,
        creditScore,
        lastScoreUpdate
      };
    } catch (error) {
      logger.error(`Error checking identity status for ${address}: ${error.message}`);
      
      // Return dummy data for hackathon demo
      const identityHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string', 'address'],
          ['did:iota:', address]
        )
      );
      
      return {
        address,
        identityHash,
        isRegistered: false,
        isVerified: false,
        registrationTime: null,
        verificationTime: null,
        creditScore: null,
        lastScoreUpdate: null,
        isBackupData: true
      };
    }
  }

  /**
   * Registers a new identity
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - Registration result
   */
  async registerIdentity(address, userData) {
    try {
      logger.info(`Registering identity for ${address}`);
      
      const identityHash = await this.deriveIdentityHash(address);
      
      // Check if already registered
      const status = await this.checkIdentityStatus(address);
      
      if (status.isRegistered) {
        return {
          address,
          identityHash,
          isRegistered: true,
          isVerified: status.isVerified,
          status: 'already_registered'
        };
      }
      
      // Generate public credential (in a real app, this would be more secure)
      const publicCredential = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'bool', 'bool'],
        [
          userData.name,
          userData.email,
          userData.consentToDataUsage,
          userData.consentToKYC
        ]
      );
      
      // Register identity on-chain
      const tx = await this.contracts.identity.registerIdentity(
        identityHash,
        publicCredential,
        { gasLimit: 300000 }
      );
      
      const receipt = await tx.wait();
      
      logger.info(`Identity registered for ${address}, tx: ${receipt.transactionHash}`);
      
      return {
        address,
        identityHash,
        isRegistered: true,
        isVerified: false,
        txHash: receipt.transactionHash,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error registering identity for ${address}: ${error.message}`);
      throw new Error(`Failed to register identity: ${error.message}`);
    }
  }

  /**
   * Generates a zero-knowledge proof for identity verification
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} proofData - Data to include in the proof
   * @returns {Promise<Object>} - Zero-knowledge proof
   */
  async generateZkProof(address, proofData) {
    try {
      logger.info(`Generating ZK proof for ${address}`);
      
      const { incomeLevel, creditHistory, repaymentHistory } = proofData;
      
      // In a real application, we would use actual ZK libraries
      // For the hackathon, we'll simulate it
      
      // Prepare private inputs (would be kept secret)
      const privateInputs = {
        address,
        incomeAmount: this.getIncomeAmount(incomeLevel),
        creditScore: this.getCreditScore(creditHistory),
        repaymentScore: this.getRepaymentScore(repaymentHistory)
      };
      
      // Prepare public inputs (will be verified on-chain)
      const publicInputs = {
        addressHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(address)),
        incomeAboveThreshold: privateInputs.incomeAmount > 30000,
        creditScoreAboveThreshold: privateInputs.creditScore > 600,
        repaymentScoreAboveThreshold: privateInputs.repaymentScore > 70
      };
      
      // Generate the proof
      const proof = await mockZkProofLib.generateProof(
        privateInputs,
        'identity-verification-circuit'
      );
      
      return {
        address,
        proof,
        publicInputs,
        proofGenerated: true
      };
    } catch (error) {
      logger.error(`Error generating ZK proof for ${address}: ${error.message}`);
      throw new Error(`Failed to generate ZK proof: ${error.message}`);
    }
  }

  /**
   * Verifies identity using zero-knowledge proof
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} verificationData - Verification data including ZK proof
   * @returns {Promise<Object>} - Verification result
   */
  async verifyIdentity(address, verificationData) {
    try {
      logger.info(`Verifying identity for ${address}`);
      
      const { proof, publicInputs } = verificationData;
      
      const identityHash = await this.deriveIdentityHash(address);
      
      // Verify identity on-chain
      const claimType = ethers.utils.id("IDENTITY_VERIFICATION");
      
      // Convert proof to bytes
      const proofBytes = ethers.utils.defaultAbiCoder.encode(
        ['tuple(bytes32[2] pi_a, bytes32[2][2] pi_b, bytes32[2] pi_c, string protocol, string curve)'],
        [proof]
      );
      
      // Encode public inputs
      const publicInputsBytes = ethers.utils.defaultAbiCoder.encode(
        ['address', 'string', 'string'],
        [
          address,
          verificationData.incomeLevel,
          verificationData.creditHistory
        ]
      );
      
      // Verify the proof on-chain
      const tx = await this.contracts.identity.verifyZKProof(
        identityHash,
        claimType,
        proofBytes,
        publicInputsBytes,
        { gasLimit: 500000 }
      );
      
      const receipt = await tx.wait();
      
      logger.info(`ZK proof verified for ${address}, tx: ${receipt.transactionHash}`);
      
      // For the hackathon, we'll simulate the verifier authorizing the identity
      await this.simulateVerifierApproval(address, identityHash);
      
      // Get updated status
      const status = await this.checkIdentityStatus(address);
      
      return {
        address,
        identityHash,
        isRegistered: status.isRegistered,
        isVerified: status.isVerified,
        creditScore: status.creditScore,
        txHash: receipt.transactionHash,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error verifying identity for ${address}: ${error.message}`);
      throw new Error(`Failed to verify identity: ${error.message}`);
    }
  }

  /**
   * Simulates a verifier approving the identity (for hackathon demo)
   * 
   * @param {string} address - User's blockchain address
   * @param {string} identityHash - Identity hash
   * @returns {Promise<void>}
   */
  async simulateVerifierApproval(address, identityHash) {
    try {
      logger.info(`Simulating verifier approval for ${address}`);
      
      // In a real system, this would be done by authorized verifiers
      // For the hackathon, we'll simulate it using our admin wallet
      
      // First check if the admin wallet is an authorized verifier
      const isVerifier = await this.contracts.identity.isAuthorizedVerifier(this.wallet.address);
      
      if (!isVerifier) {
        logger.warn(`Admin wallet is not an authorized verifier, attempting to add`);
        
        // Try to add the admin wallet as a verifier
        try {
          const addTx = await this.contracts.identity.addVerifier(
            this.wallet.address,
            "Admin Verifier"
          );
          await addTx.wait();
          logger.info(`Admin wallet added as verifier`);
        } catch (error) {
          logger.error(`Failed to add admin as verifier: ${error.message}`);
        }
      }
      
      // Verify the identity
      const verifyTx = await this.contracts.identity.verifyIdentity(
        identityHash,
        "0x", // Empty verification data for hackathon
        { gasLimit: 300000 }
      );
      
      await verifyTx.wait();
      
      // Generate a credit score (65-95 range)
      const creditScore = Math.floor(Math.random() * 31) + 65;
      
      // Update credit score
      const updateTx = await this.contracts.identity.updateCreditScore(
        identityHash,
        creditScore,
        ethers.utils.id("initial-score"),
        true, // Verified with ZK proof
        { gasLimit: 300000 }
      );
      
      await updateTx.wait();
      
      logger.info(`Simulated verifier approval complete for ${address}`);
    } catch (error) {
      logger.error(`Error in simulated verifier approval for ${address}: ${error.message}`);
      // Don't throw, as this is just a simulation and not critical
    }
  }

  /**
   * Gets a user's credit score and factors
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Credit score and factors
   */
  async getCreditProfile(address) {
    try {
      logger.info(`Getting credit profile for ${address}`);
      
      const status = await this.checkIdentityStatus(address);
      
      if (!status.isVerified || !status.creditScore) {
        return {
          address,
          verified: false,
          creditScore: null,
          message: 'Identity not verified or no credit score available'
        };
      }
      
      // Generate credit factors (in a real system, these would come from on-chain data)
      const factors = [
        {
          name: 'On-chain Repayment History',
          score: Math.floor(Math.random() * 21) + 80, // 80-100
          impact: 'high'
        },
        {
          name: 'Wallet Activity Duration',
          score: Math.floor(Math.random() * 31) + 60, // 60-90
          impact: 'medium'
        },
        {
          name: 'Collateral Diversity',
          score: Math.floor(Math.random() * 41) + 50, // 50-90
          impact: 'medium'
        },
        {
          name: 'Cross-chain Activity',
          score: Math.floor(Math.random() * 51) + 40, // 40-90
          impact: 'low'
        }
      ];
      
      // Calculate benefits based on credit score
      const benefits = [];
      
      if (status.creditScore >= 80) {
        benefits.push({
          title: 'Premium Interest Rate',
          description: 'Eligible for rates up to 3% lower than base rate',
          value: '-3%'
        });
        benefits.push({
          title: 'Maximum Borrow Limit',
          description: 'Approved for borrowing up to 85% of collateral value',
          value: '85% LTV'
        });
      } else if (status.creditScore >= 70) {
        benefits.push({
          title: 'Reduced Interest Rate',
          description: 'Eligible for rates up to 2% lower than base rate',
          value: '-2%'
        });
        benefits.push({
          title: 'Higher Borrow Limit',
          description: 'Approved for borrowing up to 75% of collateral value',
          value: '75% LTV'
        });
      } else {
        benefits.push({
          title: 'Standard Interest Rate',
          description: 'Eligible for rates up to 1% lower than base rate',
          value: '-1%'
        });
        benefits.push({
          title: 'Standard Borrow Limit',
          description: 'Approved for borrowing up to 65% of collateral value',
          value: '65% LTV'
        });
      }
      
      return {
        address,
        verified: true,
        creditScore: status.creditScore,
        lastUpdated: status.lastScoreUpdate,
        factors,
        benefits,
        riskLevel: this.getCreditRiskLevel(status.creditScore)
      };
    } catch (error) {
      logger.error(`Error getting credit profile for ${address}: ${error.message}`);
      
      // Return dummy data for hackathon demo
      return {
        address,
        verified: true,
        creditScore: 75,
        lastUpdated: new Date(),
        factors: [
          {
            name: 'On-chain Repayment History',
            score: 85,
            impact: 'high'
          },
          {
            name: 'Wallet Activity Duration',
            score: 70,
            impact: 'medium'
          },
          {
            name: 'Collateral Diversity',
            score: 65,
            impact: 'medium'
          },
          {
            name: 'Cross-chain Activity',
            score: 55,
            impact: 'low'
          }
        ],
        benefits: [
          {
            title: 'Reduced Interest Rate',
            description: 'Eligible for rates up to 2% lower than base rate',
            value: '-2%'
          },
          {
            title: 'Higher Borrow Limit',
            description: 'Approved for borrowing up to 75% of collateral value',
            value: '75% LTV'
          }
        ],
        riskLevel: 'Medium Risk',
        isBackupData: true
      };
    }
  }

  /**
   * Helper method to convert income level to amount
   * 
   * @param {string} incomeLevel - Income level category
   * @returns {number} - Income amount
   */
  getIncomeAmount(incomeLevel) {
    switch (incomeLevel) {
      case 'low':
        return 25000;
      case 'medium':
        return 50000;
      case 'high':
        return 100000;
      case 'very_high':
        return 200000;
      default:
        return 0;
    }
  }

  /**
   * Helper method to convert credit history to score
   * 
   * @param {string} creditHistory - Credit history category
   * @returns {number} - Credit score
   */
  getCreditScore(creditHistory) {
    switch (creditHistory) {
      case 'no_history':
        return 550;
      case 'poor':
        return 580;
      case 'fair':
        return 650;
      case 'good':
        return 720;
      case 'excellent':
        return 780;
      default:
        return 600;
    }
  }

  /**
   * Helper method to convert repayment history to score
   * 
   * @param {string} repaymentHistory - Repayment history category
   * @returns {number} - Repayment score
   */
  getRepaymentScore(repaymentHistory) {
    switch (repaymentHistory) {
      case 'no_history':
        return 50;
      case 'missed_payments':
        return 65;
      case 'mostly_ontime':
        return 85;
      case 'perfect':
        return 95;
      default:
        return 70;
    }
  }

  /**
   * Helper method to get risk level from credit score
   * 
   * @param {number} score - Credit score
   * @returns {string} - Risk level
   */
  getCreditRiskLevel(score) {
    if (score < 50) return 'High Risk';
    if (score < 70) return 'Medium Risk';
    return 'Low Risk';
  }
}

module.exports = new IdentityService();
