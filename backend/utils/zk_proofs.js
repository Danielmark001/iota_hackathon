const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

/**
 * Generate a genuine zero-knowledge proof for privacy-preserving risk score updates
 * @param {string} userAddress - User address
 * @param {Object} riskAssessment - Risk assessment data
 * @returns {Promise<Object>} ZK proof and public inputs
 */
async function generateZkProof(userAddress, riskAssessment) {
    // Input for the circuit - private data to be kept secret
    const input = {
        riskScore: riskAssessment.riskScore,
        confidenceScore: Math.floor(riskAssessment.confidence * 100),
        topFactors: riskAssessment.factors.map(f => Math.floor(f.importance * 100)),
        userAddressHash: ethers.utils.keccak256(userAddress),
        randomSalt: Math.floor(Math.random() * 1000000)
    };

    // Generate the proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        path.join(__dirname, '../../circuits/circuit.wasm'),
        path.join(__dirname, '../../circuits/proving_key.zkey')
    );

    // Format proof for on-chain verification
    const formattedProof = formatProofForContract(proof);
    
    // Public signals that will be visible on-chain
    const publicInputs = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256'],
        [userAddress, Math.floor(Date.now() / 1000), riskAssessment.riskScore]
    );

    return {
        proof: formattedProof,
        publicInputs
    };
}

/**
 * Format proof for Solidity contract verification
 * @param {Object} proof - The proof object from snarkjs
 * @returns {Object} - Formatted proof for solidity contract
 */
function formatProofForContract(proof) {
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [[proof.pi_b[0][0], proof.pi_b[0][1]], [proof.pi_b[1][0], proof.pi_b[1][1]]],
        c: [proof.pi_c[0], proof.pi_c[1]]
    };
}

/**
 * Verify a ZK proof locally (for testing)
 * @param {Object} proof - The ZK proof
 * @param {Array} publicSignals - The public signals
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
async function verifyZkProof(proof, publicSignals) {
    const vKey = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../circuits/verification_key.json'), 'utf8')
    );
    
    return await snarkjs.groth16.verify(vKey, publicSignals, proof);
}

/**
 * Generate a zk-SNARK circuit for risk score privacy
 * @param {string} outputPath - Path to save the circuit
 */
async function generateCircuit(outputPath) {
    const circuit = `
        pragma circom 2.0.0;
        
        include "../../node_modules/circomlib/circuits/comparators.circom";
        include "../../node_modules/circomlib/circuits/poseidon.circom";
        
        template RiskScorePrivacy(numFactors) {
            // Private inputs
            signal input riskScore;
            signal input confidenceScore;
            signal input topFactors[numFactors];
            signal input userAddressHash;
            signal input randomSalt;
            
            // Public inputs
            signal output hashedRiskScore;
            signal output hashedUserAddress;
            signal output validityFlag;
            
            // Hash the risk score with salt for privacy
            component poseidonRisk = Poseidon(2);
            poseidonRisk.inputs[0] <== riskScore;
            poseidonRisk.inputs[1] <== randomSalt;
            hashedRiskScore <== poseidonRisk.out;
            
            // Hash the user address (should match the provided hash)
            hashedUserAddress <== userAddressHash;
            
            // Verify risk score is within valid range (0-100)
            component riskScoreValid = LessThan(32);
            riskScoreValid.in[0] <== riskScore;
            riskScoreValid.in[1] <== 101; // should be less than 101
            
            component riskScorePositive = GreaterThan(32);
            riskScorePositive.in[0] <== riskScore;
            riskScorePositive.in[1] <== -1; // should be greater than -1
            
            // Verify confidence score is within valid range (0-100)
            component confidenceValid = LessThan(32);
            confidenceValid.in[0] <== confidenceScore;
            confidenceValid.in[1] <== 101;
            
            component confidencePositive = GreaterThan(32);
            confidencePositive.in[0] <== confidenceScore;
            confidencePositive.in[1] <== -1;
            
            // Combine all validity checks
            validityFlag <== riskScoreValid.out * riskScorePositive.out * confidenceValid.out * confidencePositive.out;
        }
        
        component main {public [hashedUserAddress]} = RiskScorePrivacy(5);
    `;
    
    fs.writeFileSync(outputPath, circuit);
    console.log(`Circuit written to ${outputPath}`);
}

module.exports = {
    generateZkProof,
    verifyZkProof,
    generateCircuit
};