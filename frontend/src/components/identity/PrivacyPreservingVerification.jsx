import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

/**
 * Component for handling privacy-preserving identity verification
 * Uses IOTA's identity framework for secure user verification with zero-knowledge proofs
 */
const PrivacyPreservingVerification = ({ 
  userAddress, 
  identityContract, 
  onVerificationComplete 
}) => {
  // Identity verification states
  const [identityStatus, setIdentityStatus] = useState({
    isRegistered: false,
    isVerified: false,
    registrationTime: null,
    verificationTime: null,
    creditScore: null,
    lastScoreUpdate: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('check');
  
  // Identity hash is derived from user address
  const [identityHash, setIdentityHash] = useState(null);
  
  // Form data for registration
  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
    consentToDataUsage: false,
    consentToKYC: false
  });
  
  // Data for zero-knowledge proof generation
  const [zkProofData, setZkProofData] = useState({
    incomeLevel: '',
    creditHistory: '',
    repaymentHistory: '',
    isGeneratingProof: false,
    proofGenerated: false,
    proof: null
  });
  
  // Check the user's identity verification status
  useEffect(() => {
    const checkIdentityStatus = async () => {
      if (!userAddress || !identityContract) {
        // Mock data for demo or when contract isn't available
        mockIdentityStatus();
        return;
      }
      
      try {
        setLoading(true);
        
        // Derive identity hash from user address
        const hash = await identityContract.addressToIdentityHash(userAddress);
        setIdentityHash(hash);
        
        // Check if identity is registered
        let isRegistered = false;
        let isVerified = false;
        let registrationTime = null;
        let verificationTime = null;
        let creditScore = null;
        let lastScoreUpdate = null;
        
        try {
          // Try to get identity details
          const identity = await identityContract.identities(hash);
          isRegistered = identity.registrationTime > 0;
          isVerified = identity.verified;
          registrationTime = identity.registrationTime > 0 ? 
            new Date(identity.registrationTime.toNumber() * 1000) : null;
          verificationTime = identity.verificationTime > 0 ? 
            new Date(identity.verificationTime.toNumber() * 1000) : null;
            
          // Get credit score if available
          if (isVerified) {
            const creditScoreData = await identityContract.getCreditScore(hash);
            creditScore = creditScoreData.score.toNumber();
            lastScoreUpdate = creditScoreData.lastUpdated > 0 ? 
              new Date(creditScoreData.lastUpdated.toNumber() * 1000) : null;
          }
        } catch (err) {
          // If error, identity is likely not registered
          isRegistered = false;
        }
        
        setIdentityStatus({
          isRegistered,
          isVerified,
          registrationTime,
          verificationTime,
          creditScore,
          lastScoreUpdate
        });
        
        // Set the current step based on status
        if (!isRegistered) {
          setCurrentStep('register');
        } else if (!isVerified) {
          setCurrentStep('verify');
        } else {
          setCurrentStep('verified');
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error checking identity status:", err);
        setError("Failed to check identity status");
        
        // Fallback to mock data
        mockIdentityStatus();
      }
    };
    
    // Mock identity status for development
    const mockIdentityStatus = () => {
      // Generate a deterministic hash from the address
      const addressHash = ethers.utils.id(userAddress || 'default');
      setIdentityHash(addressHash);
      
      // Mock identity data based on the address hash
      const mockRegistered = (parseInt(addressHash.slice(2, 10), 16) % 10) >= 3; // 70% chance to be registered
      const mockVerified = mockRegistered && (parseInt(addressHash.slice(10, 18), 16) % 10) >= 4; // 60% of registered are verified
      
      const now = new Date();
      const mockRegTime = mockRegistered ? new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000)) : null;
      const mockVerTime = mockVerified ? new Date(mockRegTime.getTime() + (Math.random() * 7 * 24 * 60 * 60 * 1000)) : null;
      
      const mockCreditScore = mockVerified ? Math.floor(50 + (parseInt(addressHash.slice(18, 26), 16) % 51)) : null; // 50-100 score
      const mockLastUpdate = mockVerified ? new Date(mockVerTime.getTime() + (Math.random() * 14 * 24 * 60 * 60 * 1000)) : null;
      
      setIdentityStatus({
        isRegistered: mockRegistered,
        isVerified: mockVerified,
        registrationTime: mockRegTime,
        verificationTime: mockVerTime,
        creditScore: mockCreditScore,
        lastScoreUpdate: mockLastUpdate
      });
      
      // Set the current step based on status
      if (!mockRegistered) {
        setCurrentStep('register');
      } else if (!mockVerified) {
        setCurrentStep('verify');
      } else {
        setCurrentStep('verified');
      }
      
      setLoading(false);
    };
    
    checkIdentityStatus();
  }, [userAddress, identityContract]);
  
  // Handle identity registration
  const handleRegistration = async (e) => {
    e.preventDefault();
    
    if (!registrationData.consentToDataUsage || !registrationData.consentToKYC) {
      setError("You must provide consent to continue");
      return;
    }
    
    setLoading(true);
    
    try {
      if (identityContract) {
        // Generate public credential (in a real app, this would be more complex)
        const publicCredential = ethers.utils.defaultAbiCoder.encode(
          ['string', 'string', 'bool', 'bool'],
          [
            registrationData.name,
            registrationData.email,
            registrationData.consentToDataUsage,
            registrationData.consentToKYC
          ]
        );
        
        // Register identity on-chain
        const tx = await identityContract.registerIdentity(identityHash, publicCredential);
        await tx.wait();
        
        // Update status
        setIdentityStatus({
          ...identityStatus,
          isRegistered: true,
          registrationTime: new Date()
        });
        
        setCurrentStep('verify');
      } else {
        // For demo without contract
        setTimeout(() => {
          setIdentityStatus({
            ...identityStatus,
            isRegistered: true,
            registrationTime: new Date()
          });
          
          setCurrentStep('verify');
        }, 2000);
      }
    } catch (err) {
      console.error("Error registering identity:", err);
      setError("Failed to register identity. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Generate zero-knowledge proof
  const generateZkProof = async () => {
    setZkProofData({
      ...zkProofData,
      isGeneratingProof: true,
      proofGenerated: false,
      proof: null
    });
    
    try {
      // Mock ZK proof generation (in a real app, this would use an actual ZK library)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock proof data
      const mockProof = {
        pi_a: [
          "0x2a39c12a3d2e756cd83d3af112af42a2c7bae2a38c3cf6c3b49206a108a3920c",
          "0x18a7a95d4104806f836de2ac4c58219391a5d705651b5142d27dc1dbfbab149e"
        ],
        pi_b: [
          [
            "0x0c73ade6f9c0871264750760d8be0c22a75c8a9881430e0592758c04c9a17d0d",
            "0x2f05a93a3d5820f108a6a3fb0e97f78f3b20c43a301cfd6ee7e06133c5a5cd3c"
          ],
          [
            "0x1e81b63de9ab7466e3ffe9cd4b41d3ab8553de8dfad30debe2ab2a11e6c0eb3c",
            "0x0a7c8192a34f50bb332f54494a437470cd5c4a5d20a47f45c42739ed953be50b"
          ]
        ],
        pi_c: [
          "0x1cdca0a74e91c357c34b787e6c541c3a3de73d6bd418256e7968694971445b39",
          "0x2da4c0ae23c0a7113e825d9e88d13227a289a2066af58cbe41d088ed15f0c67b"
        ],
        protocol: "groth16",
        curve: "bn128"
      };
      
      setZkProofData({
        ...zkProofData,
        isGeneratingProof: false,
        proofGenerated: true,
        proof: mockProof
      });
    } catch (err) {
      console.error("Error generating ZK proof:", err);
      setError("Failed to generate zero-knowledge proof");
      
      setZkProofData({
        ...zkProofData,
        isGeneratingProof: false,
        proofGenerated: false
      });
    }
  };
  
  // Handle verify with ZK proof
  const handleVerify = async () => {
    if (!zkProofData.proofGenerated) {
      setError("Please generate a zero-knowledge proof first");
      return;
    }
    
    setLoading(true);
    
    try {
      if (identityContract && identityHash) {
        // In a real app, we would submit the ZK proof to the contract
        // For simplicity, we're just verifying the identity here
        const claimType = ethers.utils.id("IDENTITY_VERIFICATION");
        
        // Convert proof to bytes
        const proofBytes = ethers.utils.defaultAbiCoder.encode(
          ['tuple(bytes32[2] pi_a, bytes32[2][2] pi_b, bytes32[2] pi_c, string protocol, string curve)'],
          [zkProofData.proof]
        );
        
        // Public inputs
        const publicInputs = ethers.utils.defaultAbiCoder.encode(
          ['address', 'string', 'string'],
          [
            userAddress,
            zkProofData.incomeLevel,
            zkProofData.creditHistory
          ]
        );
        
        // Verify the proof on-chain
        const tx = await identityContract.verifyZKProof(
          identityHash,
          claimType,
          proofBytes,
          publicInputs
        );
        await tx.wait();
        
        // In a real app, the identity would be verified by a verifier
        // For demo purposes, we're just updating our local state
        setIdentityStatus({
          ...identityStatus,
          isVerified: true,
          verificationTime: new Date(),
          creditScore: 75, // Mock credit score
          lastScoreUpdate: new Date()
        });
        
        setCurrentStep('verified');
        
        // Notify parent component
        if (onVerificationComplete) {
          onVerificationComplete({
            identityHash,
            creditScore: 75
          });
        }
      } else {
        // For demo without contract
        setTimeout(() => {
          setIdentityStatus({
            ...identityStatus,
            isVerified: true,
            verificationTime: new Date(),
            creditScore: 75, // Mock credit score
            lastScoreUpdate: new Date()
          });
          
          setCurrentStep('verified');
          
          // Notify parent component
          if (onVerificationComplete) {
            onVerificationComplete({
              identityHash,
              creditScore: 75
            });
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Error verifying identity:", err);
      setError("Failed to verify identity with zero-knowledge proof");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle input changes for registration form
  const handleRegistrationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRegistrationData({
      ...registrationData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Handle input changes for ZK proof form
  const handleZkProofChange = (e) => {
    const { name, value } = e.target;
    setZkProofData({
      ...zkProofData,
      [name]: value
    });
  };
  
  if (loading) {
    return <div className="loading-spinner">Checking identity status...</div>;
  }
  
  return (
    <div className="privacy-preserving-verification">
      <div className="verification-header">
        <h2>Privacy-Preserving Identity Verification</h2>
        <p className="verification-description">
          IntelliLend uses IOTA's identity framework for secure verification while protecting your privacy.
          Your sensitive information is never stored on-chain, and zero-knowledge proofs allow you to share
          only the necessary data without revealing personal details.
        </p>
      </div>
      
      {error && (
        <div className="error-message">
          <button className="close-error" onClick={() => setError(null)}>×</button>
          {error}
        </div>
      )}
      
      <div className="verification-status">
        <div className="status-steps">
          <div className={`status-step ${currentStep === 'register' || currentStep === 'verify' || currentStep === 'verified' ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Registration</div>
            {identityStatus.isRegistered && (
              <div className="step-completed-icon">✓</div>
            )}
          </div>
          <div className="step-connector"></div>
          <div className={`status-step ${currentStep === 'verify' || currentStep === 'verified' ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Verification</div>
            {identityStatus.isVerified && (
              <div className="step-completed-icon">✓</div>
            )}
          </div>
          <div className="step-connector"></div>
          <div className={`status-step ${currentStep === 'verified' ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Credit Scoring</div>
            {identityStatus.creditScore !== null && (
              <div className="step-completed-icon">✓</div>
            )}
          </div>
        </div>
      </div>
      
      {currentStep === 'register' && (
        <div className="registration-form-container">
          <h3>Register Your Identity</h3>
          <form onSubmit={handleRegistration} className="registration-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={registrationData.name}
                onChange={handleRegistrationChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={registrationData.email}
                onChange={handleRegistrationChange}
                required
              />
            </div>
            
            <div className="consent-section">
              <h4>Consent</h4>
              <p className="consent-info">
                Your data is protected using privacy-preserving technology. Only you control access to your information.
              </p>
              
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  id="consentToDataUsage"
                  name="consentToDataUsage"
                  checked={registrationData.consentToDataUsage}
                  onChange={handleRegistrationChange}
                  required
                />
                <label htmlFor="consentToDataUsage">
                  I consent to the use of my data for credit assessment purposes
                </label>
              </div>
              
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  id="consentToKYC"
                  name="consentToKYC"
                  checked={registrationData.consentToKYC}
                  onChange={handleRegistrationChange}
                  required
                />
                <label htmlFor="consentToKYC">
                  I consent to complete KYC verification when required
                </label>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Registering...' : 'Register Identity'}
              </button>
            </div>
          </form>
          
          <div className="registration-info">
            <h4>How Your Privacy is Protected</h4>
            <ul className="privacy-features">
              <li>
                <strong>Zero-Knowledge Proofs:</strong> Share verification without revealing personal details
              </li>
              <li>
                <strong>Decentralized Identity:</strong> You control access to your credentials
              </li>
              <li>
                <strong>Selective Disclosure:</strong> Share only specific information needed for each service
              </li>
              <li>
                <strong>Private Key Control:</strong> Your credentials are secured by cryptographic keys
              </li>
            </ul>
          </div>
        </div>
      )}
      
      {currentStep === 'verify' && (
        <div className="verification-form-container">
          <h3>Verify Your Identity</h3>
          <p className="verification-info">
            Generate a zero-knowledge proof to verify your identity without revealing sensitive information.
            This allows you to prove your creditworthiness while maintaining privacy.
          </p>
          
          <div className="zk-proof-form">
            <div className="form-group">
              <label htmlFor="incomeLevel">Income Level (for demo purposes)</label>
              <select
                id="incomeLevel"
                name="incomeLevel"
                value={zkProofData.incomeLevel}
                onChange={handleZkProofChange}
                required
              >
                <option value="">Select Income Level</option>
                <option value="low">Low (Under $30,000)</option>
                <option value="medium">Medium ($30,000 - $75,000)</option>
                <option value="high">High ($75,000 - $150,000)</option>
                <option value="very_high">Very High (Over $150,000)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="creditHistory">Credit History (for demo purposes)</label>
              <select
                id="creditHistory"
                name="creditHistory"
                value={zkProofData.creditHistory}
                onChange={handleZkProofChange}
                required
              >
                <option value="">Select Credit History</option>
                <option value="no_history">No Credit History</option>
                <option value="poor">Poor Credit History</option>
                <option value="fair">Fair Credit History</option>
                <option value="good">Good Credit History</option>
                <option value="excellent">Excellent Credit History</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="repaymentHistory">Loan Repayment History (for demo purposes)</label>
              <select
                id="repaymentHistory"
                name="repaymentHistory"
                value={zkProofData.repaymentHistory}
                onChange={handleZkProofChange}
                required
              >
                <option value="">Select Repayment History</option>
                <option value="no_history">No Loan History</option>
                <option value="missed_payments">Some Missed Payments</option>
                <option value="mostly_ontime">Mostly On-time Payments</option>
                <option value="perfect">Perfect Payment History</option>
              </select>
            </div>
            
            <div className="zk-proof-actions">
              <button 
                className="generate-proof-button" 
                onClick={generateZkProof}
                disabled={zkProofData.isGeneratingProof || zkProofData.proofGenerated || !zkProofData.incomeLevel || !zkProofData.creditHistory || !zkProofData.repaymentHistory}
              >
                {zkProofData.isGeneratingProof ? 'Generating Proof...' : 'Generate Zero-Knowledge Proof'}
              </button>
              
              {zkProofData.proofGenerated && (
                <div className="proof-generated-message">
                  <span className="proof-icon">✓</span>
                  Zero-knowledge proof generated successfully!
                </div>
              )}
              
              <button 
                className="verify-button" 
                onClick={handleVerify}
                disabled={loading || !zkProofData.proofGenerated}
              >
                {loading ? 'Verifying...' : 'Verify with Zero-Knowledge Proof'}
              </button>
            </div>
          </div>
          
          <div className="zk-proof-explanation">
            <h4>How Zero-Knowledge Proofs Work</h4>
            <p>
              Zero-knowledge proofs allow you to prove facts about your data without revealing the actual data.
              For example, you can prove your income is above a certain threshold without revealing the exact amount.
            </p>
            <div className="zk-benefits">
              <div className="zk-benefit">
                <h5>Privacy-Preserving</h5>
                <p>Your actual data remains private</p>
              </div>
              <div className="zk-benefit">
                <h5>Cryptographically Secure</h5>
                <p>Mathematically proven verification</p>
              </div>
              <div className="zk-benefit">
                <h5>User-Controlled</h5>
                <p>You decide what to share and when</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {currentStep === 'verified' && (
        <div className="verified-container">
          <div className="verification-success">
            <div className="success-icon">✓</div>
            <h3>Identity Verified Successfully</h3>
            <p className="verified-time">
              Verified on: {identityStatus.verificationTime.toLocaleDateString()} at {identityStatus.verificationTime.toLocaleTimeString()}
            </p>
          </div>
          
          <div className="credit-score-card">
            <h3>Your Privacy-Preserved Credit Score</h3>
            <div className="credit-score">
              <div className="score-display">{identityStatus.creditScore}</div>
              <div className="score-scale">
                <span>0</span>
                <div className="scale-bar">
                  <div 
                    className="scale-fill" 
                    style={{ width: `${identityStatus.creditScore}%` }}
                  ></div>
                </div>
                <span>100</span>
              </div>
              <div className="score-label">
                {identityStatus.creditScore < 50 ? 'High Risk' : 
                 identityStatus.creditScore < 70 ? 'Medium Risk' : 'Low Risk'}
              </div>
            </div>
            <p className="score-update-time">
              Last updated: {identityStatus.lastScoreUpdate.toLocaleDateString()}
            </p>
          </div>
          
          <div className="credit-factors">
            <h4>What Affects Your Credit Score</h4>
            <ul className="factors-list">
              <li className="factor">
                <div className="factor-name">On-chain Repayment History</div>
                <div className="factor-bar-container">
                  <div className="factor-bar" style={{ width: '85%' }}></div>
                </div>
                <div className="factor-value">Excellent</div>
              </li>
              <li className="factor">
                <div className="factor-name">Wallet Activity Duration</div>
                <div className="factor-bar-container">
                  <div className="factor-bar" style={{ width: '70%' }}></div>
                </div>
                <div className="factor-value">Good</div>
              </li>
              <li className="factor">
                <div className="factor-name">Collateral Diversity</div>
                <div className="factor-bar-container">
                  <div className="factor-bar" style={{ width: '65%' }}></div>
                </div>
                <div className="factor-value">Good</div>
              </li>
              <li className="factor">
                <div className="factor-name">Cross-chain Activity</div>
                <div className="factor-bar-container">
                  <div className="factor-bar" style={{ width: '55%' }}></div>
                </div>
                <div className="factor-value">Fair</div>
              </li>
            </ul>
          </div>
          
          <div className="benefits-section">
            <h4>Your Available Benefits</h4>
            <div className="benefits-list">
              <div className="benefit-card">
                <h5>Lower Interest Rates</h5>
                <p>Eligible for rates up to 2% lower based on your verified credit score</p>
              </div>
              <div className="benefit-card">
                <h5>Higher Borrow Limits</h5>
                <p>Approved for borrowing up to 75% of your collateral value</p>
              </div>
              <div className="benefit-card">
                <h5>Reduced Collateral</h5>
                <p>Lower collateral requirements for new loans</p>
              </div>
            </div>
          </div>
          
          <div className="next-steps">
            <h4>Next Steps</h4>
            <button className="next-step-button">Apply for a Loan</button>
            <button className="next-step-button secondary">Improve Your Score</button>
          </div>
        </div>
      )}
      
      <div className="verification-footer">
        <p className="privacy-note">
          Your identity and financial data are protected through zero-knowledge proofs and IOTA's identity framework.
          Learn more about <a href="#">how we protect your privacy</a>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPreservingVerification;
