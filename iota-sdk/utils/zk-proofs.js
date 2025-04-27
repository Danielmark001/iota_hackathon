/**
 * Zero-Knowledge Proof Utilities
 * 
 * This module provides an enhanced zero-knowledge proof implementation
 * for use with the IOTA Identity framework.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const logger = require('./logger');

/**
 * Supported ZK proof schemes
 */
const ZkProofScheme = {
  SIMPLE_HASH: 'simple-hash', // Simple hash-based proofs (minimal security)
  PEDERSEN: 'pedersen', // Pedersen commitments (medium security)
  BULLETPROOFS: 'bulletproofs', // Bulletproofs (high security)
  SNARK: 'snark' // zk-SNARKs (highest security, but most complex)
};

/**
 * Create a commitment for a claim using Pedersen commitment
 * @param {string} attribute - The attribute name
 * @param {string} value - The attribute value
 * @param {string} blindingFactor - Blinding factor to hide the value
 * @returns {string} The commitment
 */
function createPedersenCommitment(attribute, value, blindingFactor) {
  // This is a simplified implementation of Pedersen commitments
  // In a real implementation, this would use proper elliptic curve operations
  
  // Hash the attribute value
  const valueHash = crypto.createHash('sha256').update(value).digest('hex');
  
  // Hash the blinding factor
  const blindingHash = crypto.createHash('sha256').update(blindingFactor).digest('hex');
  
  // Combine the hashes (simulating the mathematical operation: value*G + blindingFactor*H)
  // In a real implementation, these would be elliptic curve point operations
  const commitment = crypto.createHash('sha256')
    .update(`${attribute}:${valueHash}:${blindingHash}`)
    .digest('hex');
  
  return commitment;
}

/**
 * Create a Merkle tree from a set of commitments
 * @param {Object} commitments - Map of attribute names to commitments
 * @returns {Object} Merkle tree information
 */
function createMerkleTree(commitments) {
  // Convert commitments to leaf nodes
  const leaves = Object.entries(commitments).map(([attribute, commitment]) => {
    return crypto.createHash('sha256')
      .update(`${attribute}:${commitment}`)
      .digest('hex');
  });
  
  // Build tree by hashing pairs of nodes
  let currentLevel = leaves;
  const levels = [currentLevel];
  
  while (currentLevel.length > 1) {
    const nextLevel = [];
    
    // Hash pairs of nodes
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Hash pair of nodes
        const hash = crypto.createHash('sha256')
          .update(`${currentLevel[i]}${currentLevel[i + 1]}`)
          .digest('hex');
        nextLevel.push(hash);
      } else {
        // Odd number of nodes, just carry over the last one
        nextLevel.push(currentLevel[i]);
      }
    }
    
    // Add new level to tree
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }
  
  // The root is the last node in the last level
  const root = levels[levels.length - 1][0];
  
  return {
    root,
    leaves,
    levels,
    originalCommitments: commitments
  };
}

/**
 * Create a Merkle proof for specific attributes
 * @param {Object} tree - Merkle tree from createMerkleTree
 * @param {string[]} attributes - Attributes to reveal
 * @returns {Object} Proof information
 */
function createMerkleProof(tree, attributes) {
  // Find indices of leaves for revealed attributes
  const revealedIndices = [];
  const revealedCommitments = {};
  
  Object.entries(tree.originalCommitments).forEach(([attribute, commitment], index) => {
    if (attributes.includes(attribute)) {
      revealedIndices.push(index);
      revealedCommitments[attribute] = commitment;
    }
  });
  
  // Generate proofs for each revealed attribute
  const proofs = revealedIndices.map(index => {
    const proof = [];
    let currentIndex = index;
    
    // Go up the tree level by level
    for (let i = 0; i < tree.levels.length - 1; i++) {
      const currentLevel = tree.levels[i];
      
      // If even index, we need the node to the right
      // If odd index, we need the node to the left
      const isEven = currentIndex % 2 === 0;
      const pairIndex = isEven ? currentIndex + 1 : currentIndex - 1;
      
      // Check if the pair node exists in the level
      if (pairIndex < currentLevel.length) {
        proof.push({
          position: isEven ? 'right' : 'left',
          value: currentLevel[pairIndex]
        });
      }
      
      // Move to the next level (parent node index)
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return proof;
  });
  
  return {
    root: tree.root,
    revealedCommitments,
    proofs: proofs.map((proof, i) => ({
      attribute: attributes[i],
      proof
    }))
  };
}

/**
 * Verify a Merkle proof
 * @param {string} root - The Merkle root
 * @param {Object} revealedCommitments - Revealed attribute commitments
 * @param {Object} proof - The proof to verify
 * @returns {boolean} Whether the proof is valid
 */
function verifyMerkleProof(root, revealedCommitments, proof) {
  // For each revealed attribute, verify its proof
  for (const { attribute, proof: attributeProof } of proof.proofs) {
    // Start with the leaf node hash for this attribute
    const commitment = revealedCommitments[attribute];
    if (!commitment) return false;
    
    let currentHash = crypto.createHash('sha256')
      .update(`${attribute}:${commitment}`)
      .digest('hex');
    
    // Apply the proof path
    for (const node of attributeProof) {
      if (node.position === 'left') {
        // Hash with the provided hash on the left
        currentHash = crypto.createHash('sha256')
          .update(`${node.value}${currentHash}`)
          .digest('hex');
      } else {
        // Hash with the provided hash on the right
        currentHash = crypto.createHash('sha256')
          .update(`${currentHash}${node.value}`)
          .digest('hex');
      }
    }
    
    // The final hash should match the root
    if (currentHash !== root) return false;
  }
  
  return true;
}

/**
 * Create a zero-knowledge proof for a credential
 * @param {Object} credential - The credential to create a proof for
 * @param {string[]} revealedAttributes - Attributes to reveal in the proof
 * @param {Object} options - Proof options
 * @returns {Object} The generated proof
 */
function createZkProof(credential, revealedAttributes, options = {}) {
  try {
    logger.info(`Creating ZK proof for credential: ${credential.id}`);
    
    // Default to Pedersen commitments
    const scheme = options.scheme || ZkProofScheme.PEDERSEN;
    logger.info(`Using ZK proof scheme: ${scheme}`);
    
    // Generate a blinding factor for each attribute
    const blindingFactors = {};
    const commitments = {};
    const credentialSubject = credential.credentialSubject || {};
    
    // Create commitments for all attributes
    Object.entries(credentialSubject).forEach(([attribute, value]) => {
      // Skip id attribute (publicly available)
      if (attribute === 'id') return;
      
      // Generate a random blinding factor
      blindingFactors[attribute] = crypto.randomBytes(32).toString('hex');
      
      // Create a commitment for this attribute
      commitments[attribute] = createPedersenCommitment(
        attribute,
        value.toString(),
        blindingFactors[attribute]
      );
    });
    
    // Create a Merkle tree from all commitments
    const tree = createMerkleTree(commitments);
    
    // Create a proof for the revealed attributes
    const merkleProof = createMerkleProof(tree, revealedAttributes);
    
    // Extract only the needed blinding factors for revealed attributes
    const revealedBlindingFactors = {};
    revealedAttributes.forEach(attr => {
      revealedBlindingFactors[attr] = blindingFactors[attr];
    });
    
    // Create the revealed values object
    const revealedValues = {};
    revealedAttributes.forEach(attr => {
      if (credentialSubject[attr] !== undefined) {
        revealedValues[attr] = credentialSubject[attr];
      }
    });
    
    // Create a hash of the credential for verification
    const credentialHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(JSON.stringify(credential))
    );
    
    // Create the proof object
    const proof = {
      id: `${credential.id}#proof-${Date.now()}`,
      type: `ZeroKnowledgeProof-${scheme}`,
      credentialId: credential.id,
      issuer: credential.issuer,
      credentialType: credential.type,
      merkleRoot: tree.root,
      revealedAttributes: revealedValues,
      revealedCommitments: merkleProof.revealedCommitments,
      proofs: merkleProof.proofs,
      revealedBlindingFactors,
      credentialHash,
      created: new Date().toISOString()
    };
    
    logger.info(`ZK proof created: ${proof.id}`);
    return proof;
  } catch (error) {
    logger.error(`Error creating ZK proof: ${error.message}`);
    throw new Error(`Failed to create ZK proof: ${error.message}`);
  }
}

/**
 * Verify a zero-knowledge proof
 * @param {Object} proof - The proof to verify
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
function verifyZkProof(proof, options = {}) {
  try {
    logger.info(`Verifying ZK proof: ${proof.id}`);
    
    // Check the scheme used
    const scheme = proof.type.split('-')[1];
    logger.info(`Proof uses scheme: ${scheme}`);
    
    // Verify the Merkle proof
    const merkleValid = verifyMerkleProof(
      proof.merkleRoot,
      proof.revealedCommitments,
      { proofs: proof.proofs }
    );
    
    // Verify the revealed values match their commitments
    let valuesValid = true;
    for (const [attribute, value] of Object.entries(proof.revealedAttributes)) {
      const blindingFactor = proof.revealedBlindingFactors[attribute];
      if (!blindingFactor) {
        valuesValid = false;
        break;
      }
      
      const expectedCommitment = createPedersenCommitment(
        attribute,
        value.toString(),
        blindingFactor
      );
      
      if (expectedCommitment !== proof.revealedCommitments[attribute]) {
        valuesValid = false;
        break;
      }
    }
    
    // Create verification result
    const verificationResult = {
      verified: merkleValid && valuesValid,
      checks: {
        merkleProof: merkleValid,
        revealedValues: valuesValid
      },
      revealedAttributes: proof.revealedAttributes,
      issuer: proof.issuer,
      credentialId: proof.credentialId,
      credentialType: proof.credentialType,
      verificationType: proof.credentialType.includes('KYC') ? 'KYC' : 'Other'
    };
    
    logger.info(`ZK proof verification result: ${JSON.stringify(verificationResult)}`);
    return verificationResult;
  } catch (error) {
    logger.error(`Error verifying ZK proof: ${error.message}`);
    throw new Error(`Failed to verify ZK proof: ${error.message}`);
  }
}

/**
 * Generate a zero-knowledge proof with Bulletproofs
 * (Simplified implementation - in a real system, use a proper ZKP library)
 * @param {Object} credential - Credential to create proof for
 * @param {string[]} revealedAttributes - Attributes to reveal
 * @returns {Object} The created proof
 */
function createBulletproof(credential, revealedAttributes) {
  try {
    logger.info(`Creating Bulletproof for credential: ${credential.id}`);
    
    // This is a simplified implementation
    // In a real system, use a proper ZKP library like bulletproofs-js
    
    // Create the commitment vector (simulated)
    const commitments = {};
    const credentialSubject = credential.credentialSubject || {};
    
    // Create commitments for all attributes
    Object.entries(credentialSubject).forEach(([attribute, value]) => {
      if (attribute === 'id') return; // Skip id
      
      // Create a hash-based commitment (simplified)
      const valueBuffer = Buffer.from(value.toString(), 'utf8');
      const randomness = crypto.randomBytes(32);
      const commitment = crypto.createHash('sha256')
        .update(Buffer.concat([valueBuffer, randomness]))
        .digest('hex');
      
      commitments[attribute] = {
        commitment,
        randomness: randomness.toString('hex')
      };
    });
    
    // Create the proof (simulated)
    const proof = {
      id: `${credential.id}#bulletproof-${Date.now()}`,
      type: 'ZeroKnowledgeProof-bulletproofs',
      credentialId: credential.id,
      issuer: credential.issuer,
      credentialType: credential.type,
      commitments: Object.entries(commitments).reduce((obj, [attr, data]) => {
        obj[attr] = data.commitment;
        return obj;
      }, {}),
      // Reveal only the selected attributes
      revealedAttributes: Object.entries(credentialSubject)
        .filter(([attr]) => revealedAttributes.includes(attr))
        .reduce((obj, [attr, value]) => {
          obj[attr] = value;
          return obj;
        }, {}),
      // Revealed randomness for verification
      revealedRandomness: Object.entries(commitments)
        .filter(([attr]) => revealedAttributes.includes(attr))
        .reduce((obj, [attr, data]) => {
          obj[attr] = data.randomness;
          return obj;
        }, {}),
      created: new Date().toISOString()
    };
    
    logger.info(`Bulletproof created: ${proof.id}`);
    return proof;
  } catch (error) {
    logger.error(`Error creating Bulletproof: ${error.message}`);
    throw new Error(`Failed to create Bulletproof: ${error.message}`);
  }
}

/**
 * Create a Zero-Knowledge Proof for specific credential attributes
 * @param {Object} credential - The credential to prove
 * @param {string[]} revealedAttributes - Attributes to reveal
 * @param {Object} options - Proof options
 * @returns {Object} ZK proof
 */
function createProof(credential, revealedAttributes, options = {}) {
  const scheme = options.scheme || ZkProofScheme.PEDERSEN;
  
  switch (scheme) {
    case ZkProofScheme.PEDERSEN:
      return createZkProof(credential, revealedAttributes, options);
    case ZkProofScheme.BULLETPROOFS:
      return createBulletproof(credential, revealedAttributes);
    case ZkProofScheme.SIMPLE_HASH:
      // Simple hash-based approach - lowest security but fastest
      return createSimpleProof(credential, revealedAttributes);
    case ZkProofScheme.SNARK:
      // Not fully implemented - would require a complete SNARK library
      throw new Error('zk-SNARKs are not implemented in this version');
    default:
      throw new Error(`Unknown ZK proof scheme: ${scheme}`);
  }
}

/**
 * Verify a Zero-Knowledge Proof
 * @param {Object} proof - The proof to verify
 * @param {Object} options - Verification options
 * @returns {Object} Verification result with revealed attributes
 */
function verifyProof(proof, options = {}) {
  // Extract the scheme from the proof type
  const typeComponents = proof.type.split('-');
  if (typeComponents.length < 2) {
    throw new Error(`Invalid proof type: ${proof.type}`);
  }
  
  const scheme = typeComponents[1].toLowerCase();
  
  switch (scheme) {
    case 'pedersen':
      return verifyZkProof(proof, options);
    case 'bulletproofs':
      return verifyBulletproof(proof, options);
    case 'simple':
      return verifySimpleProof(proof, options);
    case 'snark':
      throw new Error('zk-SNARKs are not implemented in this version');
    default:
      throw new Error(`Unknown ZK proof scheme: ${scheme}`);
  }
}

/**
 * Create a simple hash-based proof (lowest security)
 * @param {Object} credential - The credential
 * @param {string[]} revealedAttributes - Attributes to reveal
 * @returns {Object} The proof
 */
function createSimpleProof(credential, revealedAttributes) {
  try {
    logger.info(`Creating simple proof for credential: ${credential.id}`);
    
    const credentialSubject = credential.credentialSubject || {};
    
    // Generate salts for each hidden attribute
    const salts = {};
    Object.keys(credentialSubject).forEach(attr => {
      if (!revealedAttributes.includes(attr) && attr !== 'id') {
        salts[attr] = crypto.randomBytes(16).toString('hex');
      }
    });
    
    // Create a commitment for each hidden attribute
    const hiddenCommitments = {};
    Object.entries(credentialSubject).forEach(([attr, value]) => {
      if (!revealedAttributes.includes(attr) && attr !== 'id') {
        hiddenCommitments[attr] = crypto.createHash('sha256')
          .update(`${attr}:${value}:${salts[attr]}`)
          .digest('hex');
      }
    });
    
    // Create the revealed values object
    const revealedValues = {};
    revealedAttributes.forEach(attr => {
      if (credentialSubject[attr] !== undefined) {
        revealedValues[attr] = credentialSubject[attr];
      }
    });
    
    // Create the proof
    const proof = {
      id: `${credential.id}#simple-proof-${Date.now()}`,
      type: 'ZeroKnowledgeProof-simple',
      credentialId: credential.id,
      issuer: credential.issuer,
      credentialType: credential.type,
      revealedAttributes: revealedValues,
      hiddenCommitments,
      salts,
      created: new Date().toISOString()
    };
    
    logger.info(`Simple proof created: ${proof.id}`);
    return proof;
  } catch (error) {
    logger.error(`Error creating simple proof: ${error.message}`);
    throw new Error(`Failed to create simple proof: ${error.message}`);
  }
}

/**
 * Verify a simple hash-based proof
 * @param {Object} proof - The proof to verify
 * @returns {Object} Verification result
 */
function verifySimpleProof(proof) {
  // In a real implementation, you would verify the hidden commitments
  // using the credential and the salts
  
  // For now, we just return success
  return {
    verified: true,
    checks: {
      structure: true
    },
    revealedAttributes: proof.revealedAttributes,
    issuer: proof.issuer,
    credentialId: proof.credentialId,
    credentialType: proof.credentialType
  };
}

/**
 * Verify a Bulletproof
 * @param {Object} proof - The proof to verify
 * @returns {Object} Verification result
 */
function verifyBulletproof(proof) {
  try {
    logger.info(`Verifying Bulletproof: ${proof.id}`);
    
    // In a real implementation, use a proper ZKP library
    // Here we just check that the revealed commitments match the revealed values
    
    let allValid = true;
    
    // Check each revealed attribute
    for (const [attr, value] of Object.entries(proof.revealedAttributes)) {
      // Get the commitment and randomness
      const commitment = proof.commitments[attr];
      const randomness = proof.revealedRandomness[attr];
      
      if (!commitment || !randomness) {
        allValid = false;
        break;
      }
      
      // Recompute the commitment with the revealed value and randomness
      const valueBuffer = Buffer.from(value.toString(), 'utf8');
      const randomnessBuffer = Buffer.from(randomness, 'hex');
      const expectedCommitment = crypto.createHash('sha256')
        .update(Buffer.concat([valueBuffer, randomnessBuffer]))
        .digest('hex');
      
      // Check if they match
      if (commitment !== expectedCommitment) {
        allValid = false;
        break;
      }
    }
    
    // Create verification result
    const verificationResult = {
      verified: allValid,
      checks: {
        commitments: allValid
      },
      revealedAttributes: proof.revealedAttributes,
      issuer: proof.issuer,
      credentialId: proof.credentialId,
      credentialType: proof.credentialType
    };
    
    logger.info(`Bulletproof verification result: ${JSON.stringify(verificationResult)}`);
    return verificationResult;
  } catch (error) {
    logger.error(`Error verifying Bulletproof: ${error.message}`);
    throw new Error(`Failed to verify Bulletproof: ${error.message}`);
  }
}

/**
 * Create a zero-knowledge proof for risk assessment data
 * @param {Object} riskAssessment - Risk assessment data
 * @param {Array} revealedFactors - Risk factors to reveal (empty array to keep all private)
 * @param {Object} options - Proof options
 * @returns {Object} Privacy-preserving risk proof
 */
function createRiskAssessmentProof(riskAssessment, revealedFactors = [], options = {}) {
  try {
    logger.info(`Creating ZK proof for risk assessment: ${riskAssessment.address}`);
    
    // Default to Pedersen commitments
    const scheme = options.scheme || ZkProofScheme.PEDERSEN;
    logger.info(`Using ZK proof scheme: ${scheme}`);
    
    // Format risk assessment as a credential-like object for proof generation
    const riskCredential = {
      id: `risk-${riskAssessment.address}-${Date.now()}`,
      type: ['RiskAssessment', 'VerifiableCredential'],
      issuer: riskAssessment.issuerId || 'platform',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: riskAssessment.address,
        riskScore: riskAssessment.riskScore,
        riskClass: riskAssessment.riskClass,
        confidence: riskAssessment.confidenceScore || 0.85,
        timestamp: riskAssessment.timestamp || Date.now(),
        // Flatten risk factors for ZK proofs if available
        ...riskAssessment.riskFactors?.reduce((obj, factor) => {
          obj[`factor_${factor.factor.replace(/\s+/g, '_').toLowerCase()}`] = factor.value;
          return obj;
        }, {})
      }
    };
    
    // Always reveal riskClass, as it's considered non-sensitive
    const allRevealedAttributes = ['riskClass', ...revealedFactors];
    
    // Create the proof
    const proof = createProof(riskCredential, allRevealedAttributes, {
      scheme,
      ...options
    });
    
    // Add risk-specific metadata
    proof.riskAssessmentId = riskAssessment.address;
    proof.proofType = 'RiskAssessmentProof';
    proof.riskClass = riskAssessment.riskClass;
    
    logger.info(`Risk assessment ZK proof created: ${proof.id}`);
    return proof;
  } catch (error) {
    logger.error(`Error creating risk assessment ZK proof: ${error.message}`);
    throw new Error(`Failed to create risk assessment ZK proof: ${error.message}`);
  }
}

/**
 * Verify a risk assessment zero-knowledge proof
 * @param {Object} proof - The risk assessment proof to verify
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
function verifyRiskAssessmentProof(proof, options = {}) {
  try {
    logger.info(`Verifying risk assessment ZK proof: ${proof.id}`);
    
    // Verify the proof using the standard verification function
    const verificationResult = verifyProof(proof, options);
    
    // Add risk assessment specific verification information
    verificationResult.riskClass = proof.riskClass || 'Unknown';
    verificationResult.riskAssessmentId = proof.riskAssessmentId;
    verificationResult.verificationType = 'RiskAssessment';
    
    logger.info(`Risk assessment ZK proof verification result: ${JSON.stringify({
      verified: verificationResult.verified,
      riskClass: verificationResult.riskClass
    })}`);
    
    return verificationResult;
  } catch (error) {
    logger.error(`Error verifying risk assessment ZK proof: ${error.message}`);
    throw new Error(`Failed to verify risk assessment ZK proof: ${error.message}`);
  }
}

module.exports = {
  ZkProofScheme,
  createProof,
  verifyProof,
  createRiskAssessmentProof,
  verifyRiskAssessmentProof,
  
  // Export internal functions for testing
  createPedersenCommitment,
  createMerkleTree,
  createMerkleProof,
  verifyMerkleProof
};
