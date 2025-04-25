import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import ZKVerifierABI from '../abis/ZKVerifier.json';
import { ZK_VERIFIER_ADDRESS, API_URL } from '../config';

/**
 * Component for privacy-preserving identity verification
 * Allows users to verify their identity without exposing sensitive information
 */
const PrivacyPreservingIdentity = ({ address, provider }) => {
  const [identityStatus, setIdentityStatus] = useState({
    verified: false,
    level: 0,
    timestamp: null,
    proofType: null
  });
  
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);
  const [proofData, setProofData] = useState(null);
  const [error, setError] = useState(null);
  const [zkContract, setZkContract] = useState(null);
  
  // Load ZK Verifier contract
  useEffect(() => {
    if (address && provider) {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZKVerifierABI, signer);
      setZkContract(contract);
      
      // Get identity status
      fetchIdentityStatus();
      
      // Get available identity services
      fetchAvailableServices();
    }
  }, [address, provider]);
  
  const fetchIdentityStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/identity/${address}`);
      setIdentityStatus(response.data);
    } catch (error) {
      console.error('Error fetching identity status:', error);
      // Set default status
      setIdentityStatus({
        verified: false,
        level: 0,
        timestamp: null,
        proofType: null
      });
    }
  };
  
  const fetchAvailableServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/identity/services`);
      setAvailableServices(response.data);
      if (response.data.length > 0) {
        setSelectedService(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching identity services:', error);
      // Set some default services
      const defaultServices = [
        { id: 'zkId', name: 'IOTA Zero-Knowledge Identity', description: 'Verify identity using zero-knowledge proofs' },
        { id: 'dltId', name: 'DLT Identity Verification', description: 'Identity verification through the IOTA Identity Framework' }
      ];
      setAvailableServices(defaultServices);
      setSelectedService(defaultServices[0].id);
    }
  };
  
  const startVerification = async () => {
    setIsVerifying(true);
    setVerificationStep(1);
    setError(null);
    
    try {
      // Request verification session
      const response = await axios.post(`${API_URL}/identity/start-verification`, {
        address,
        serviceId: selectedService
      });
      
      // Store session data
      setProofData({
        sessionId: response.data.sessionId,
        challenge: response.data.challenge,
        serviceData: response.data.serviceData
      });
      
      setVerificationStep(2);
    } catch (error) {
      console.error('Error starting verification:', error);
      setError('Failed to start verification process. Please try again.');
      setIsVerifying(false);
    }
  };
  
  const generateProof = async () => {
    setVerificationStep(3);
    
    try {
      // Simulate proof generation
      // In a real implementation, this would involve cryptographic operations
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
      
      // Generate mock proof
      const mockProof = {
        proof: ethers.utils.randomBytes(128),
        publicInputs: ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes32'],
          [address, Date.now(), proofData.challenge]
        ),
        proofType: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('IDENTITY_VERIFICATION'))
      };
      
      // Update proof data
      setProofData({
        ...proofData,
        proof: mockProof.proof,
        publicInputs: mockProof.publicInputs,
        proofType: mockProof.proofType
      });
      
      setVerificationStep(4);
    } catch (error) {
      console.error('Error generating proof:', error);
      setError('Failed to generate zero-knowledge proof. Please try again.');
      setVerificationStep(2);
    }
  };
  
  const submitProof = async () => {
    setVerificationStep(5);
    
    try {
      if (!zkContract) {
        throw new Error('ZK Verifier contract not initialized');
      }
      
      // Submit proof to the contract
      const tx = await zkContract.verifyProof(
        proofData.proofType,
        proofData.proof,
        proofData.publicInputs,
        address
      );
      
      // Wait for confirmation
      await tx.wait();
      
      // Fetch updated status
      await fetchIdentityStatus();
      
      setVerificationStep(6);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setIsVerifying(false);
        setVerificationStep(0);
        setProofData(null);
      }, 3000);
    } catch (error) {
      console.error('Error submitting proof:', error);
      setError('Failed to verify proof on-chain. Please try again.');
      setVerificationStep(4);
    }
  };
  
  const cancelVerification = () => {
    setIsVerifying(false);
    setVerificationStep(0);
    setProofData(null);
    setError(null);
  };
  
  // Render identity status badge
  const renderStatusBadge = () => {
    const levelNames = ['Not Verified', 'Basic', 'Advanced', 'Full'];
    const levelColors = ['#dc3545', '#ffc107', '#17a2b8', '#28a745'];
    
    return (
      <div className="identity-status-badge" style={{ backgroundColor: levelColors[identityStatus.level] }}>
        <div className="status-icon">
          {identityStatus.verified ? (
            <i className="fas fa-check-circle"></i>
          ) : (
            <i className="fas fa-times-circle"></i>
          )}
        </div>
        <div className="status-info">
          <div className="status-level">{levelNames[identityStatus.level]}</div>
          {identityStatus.timestamp && (
            <div className="status-time">
              Verified: {new Date(identityStatus.timestamp).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render verification steps
  const renderVerificationSteps = () => {
    const steps = [
      { name: 'Start', description: 'Begin verification' },
      { name: 'Init', description: 'Initialize verification session' },
      { name: 'Generate', description: 'Generate zero-knowledge proof' },
      { name: 'Processing', description: 'Processing proof' },
      { name: 'Submit', description: 'Submit proof to blockchain' },
      { name: 'Verify', description: 'Verifying proof on-chain' },
      { name: 'Complete', description: 'Verification complete' }
    ];
    
    return (
      <div className="verification-steps">
        {steps.map((step, index) => (
          <div 
            key={index} 
            className={`step ${verificationStep >= index ? 'active' : ''} ${verificationStep === index ? 'current' : ''}`}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-info">
              <div className="step-name">{step.name}</div>
              <div className="step-description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="privacy-preserving-identity">
      <h2>Privacy-Preserving Identity Verification</h2>
      <p className="feature-description">
        Verify your identity using zero-knowledge proofs without revealing sensitive information.
        Higher verification levels can improve your risk score and borrowing terms.
      </p>
      
      <div className="identity-panel">
        <div className="identity-status">
          <h3>Current Identity Status</h3>
          {renderStatusBadge()}
          
          {!identityStatus.verified && !isVerifying && (
            <div className="verification-prompt">
              <p>Verifying your identity can reduce your risk score by up to 20 points.</p>
              <button className="action-button" onClick={() => setIsVerifying(true)}>
                Verify Your Identity
              </button>
            </div>
          )}
        </div>
        
        {isVerifying && (
          <div className="verification-process">
            <h3>Identity Verification Process</h3>
            
            {verificationStep === 0 && (
              <div className="verification-services">
                <p>Select an identity verification service:</p>
                <div className="services-list">
                  {availableServices.map(service => (
                    <div 
                      key={service.id}
                      className={`service-card ${selectedService === service.id ? 'selected' : ''}`}
                      onClick={() => setSelectedService(service.id)}
                    >
                      <div className="service-name">{service.name}</div>
                      <div className="service-description">{service.description}</div>
                    </div>
                  ))}
                </div>
                
                <div className="verification-actions">
                  <button className="action-button" onClick={startVerification}>
                    Start Verification
                  </button>
                  <button className="action-button secondary" onClick={cancelVerification}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {verificationStep > 0 && (
              <>
                {renderVerificationSteps()}
                
                {verificationStep === 2 && (
                  <div className="verification-actions">
                    <p>Generate a zero-knowledge proof to verify your identity without revealing sensitive information.</p>
                    <button className="action-button" onClick={generateProof}>
                      Generate Proof
                    </button>
                    <button className="action-button secondary" onClick={cancelVerification}>
                      Cancel
                    </button>
                  </div>
                )}
                
                {verificationStep === 4 && (
                  <div className="verification-actions">
                    <p>Your zero-knowledge proof has been generated. Submit it to the blockchain for verification.</p>
                    <button className="action-button" onClick={submitProof}>
                      Submit Proof
                    </button>
                    <button className="action-button secondary" onClick={cancelVerification}>
                      Cancel
                    </button>
                  </div>
                )}
                
                {verificationStep === 6 && (
                  <div className="verification-success">
                    <div className="success-icon">✓</div>
                    <h3>Verification Successful!</h3>
                    <p>Your identity has been verified. Your risk score will be updated shortly.</p>
                  </div>
                )}
                
                {error && (
                  <div className="verification-error">
                    <p>{error}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="verification-benefits">
        <h3>Benefits of Identity Verification</h3>
        <div className="benefits-list">
          <div className="benefit-item">
            <i className="fas fa-shield-alt"></i>
            <div className="benefit-info">
              <h4>Improved Risk Score</h4>
              <p>Reduce your risk score by up to 20 points</p>
            </div>
          </div>
          <div className="benefit-item">
            <i className="fas fa-percentage"></i>
            <div className="benefit-info">
              <h4>Lower Interest Rates</h4>
              <p>Access better interest rates on loans</p>
            </div>
          </div>
          <div className="benefit-item">
            <i className="fas fa-lock"></i>
            <div className="benefit-info">
              <h4>Privacy Protection</h4>
              <p>Verify without exposing sensitive information</p>
            </div>
          </div>
          <div className="benefit-item">
            <i className="fas fa-money-bill-wave"></i>
            <div className="benefit-info">
              <h4>Higher Borrowing Capacity</h4>
              <p>Unlock higher lending limits</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPreservingIdentity;
