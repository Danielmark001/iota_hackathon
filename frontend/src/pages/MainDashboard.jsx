import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';

// Component imports
import RiskScoreVisualizer from '../components/risk/RiskScoreVisualizer';
import CrossChainLiquidityPanel from '../components/dashboard/CrossChainLiquidityPanel';
import PrivacyPreservingVerification from '../components/identity/PrivacyPreservingVerification';

// Contract ABIs and addresses
import LendingPoolABI from '../abis/LendingPool.json';
import AIRiskAssessmentABI from '../abis/AIRiskAssessment.json';
import CrossChainLiquidityABI from '../abis/CrossChainLiquidity.json';
import PrivacyPreservingIdentityABI from '../abis/PrivacyPreservingIdentity.json';

// Contract addresses (will be set in the config)
import {
  LENDING_POOL_ADDRESS,
  AI_RISK_ASSESSMENT_ADDRESS,
  CROSS_CHAIN_LIQUIDITY_ADDRESS,
  PRIVACY_PRESERVING_IDENTITY_ADDRESS,
} from '../config';

/**
 * Main dashboard page that integrates all components of IntelliLend
 */
const MainDashboard = ({ account, provider }) => {
  const navigate = useNavigate();
  
  // State for tab navigation
  const [activeTab, setActiveTab] = useState('overview');
  
  // Contract instances
  const [contracts, setContracts] = useState({
    lendingPool: null,
    riskAssessment: null,
    crossChainLiquidity: null,
    privacyPreservingIdentity: null,
  });
  
  // User data
  const [userData, setUserData] = useState({
    deposits: 0,
    borrows: 0,
    collateral: 0,
    availableLiquidity: 0,
    healthFactor: 0,
    isVerified: false,
    riskScore: null,
    creditScore: null,
  });
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Initialize contracts when provider changes
  useEffect(() => {
    const initializeContracts = async () => {
      if (!provider) return;
      
      try {
        const signer = provider.getSigner();
        
        // Initialize contract instances
        const lendingPoolContract = new ethers.Contract(
          LENDING_POOL_ADDRESS,
          LendingPoolABI,
          signer
        );
        
        const riskAssessmentContract = new ethers.Contract(
          AI_RISK_ASSESSMENT_ADDRESS,
          AIRiskAssessmentABI,
          signer
        );
        
        const crossChainLiquidityContract = new ethers.Contract(
          CROSS_CHAIN_LIQUIDITY_ADDRESS,
          CrossChainLiquidityABI,
          signer
        );
        
        const privacyPreservingIdentityContract = new ethers.Contract(
          PRIVACY_PRESERVING_IDENTITY_ADDRESS,
          PrivacyPreservingIdentityABI,
          signer
        );
        
        setContracts({
          lendingPool: lendingPoolContract,
          riskAssessment: riskAssessmentContract,
          crossChainLiquidity: crossChainLiquidityContract,
          privacyPreservingIdentity: privacyPreservingIdentityContract,
        });
      } catch (err) {
        console.error('Failed to initialize contracts:', err);
        setError('Failed to initialize contracts. Please check your connection and try again.');
      }
    };
    
    initializeContracts();
  }, [provider]);
  
  // Fetch user data when account or contracts change
  useEffect(() => {
    const fetchUserData = async () => {
      if (!account || !contracts.lendingPool || !contracts.riskAssessment) {
        // Mock data for development
        setUserData({
          deposits: 5000,
          borrows: 3000,
          collateral: 10000,
          availableLiquidity: 2000,
          healthFactor: 1.67,
          isVerified: Math.random() > 0.3, // 70% chance of being verified
          riskScore: Math.floor(30 + Math.random() * 70), // 30-100 range
          creditScore: Math.floor(50 + Math.random() * 50), // 50-100 range
        });
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        // Fetch data from lending pool
        const deposits = await contracts.lendingPool.deposits(account);
        const borrows = await contracts.lendingPool.borrows(account);
        const collateral = await contracts.lendingPool.collaterals(account);
        const healthFactor = await contracts.lendingPool.getHealthFactor(account);
        
        // Fetch risk score
        const riskScore = await contracts.riskAssessment.getUserRiskScore(account);
        
        // Check verification status (simplified for the hackathon)
        const identityHash = await contracts.privacyPreservingIdentity.addressToIdentityHash(account);
        let isVerified = false;
        let creditScore = null;
        
        try {
          const identity = await contracts.privacyPreservingIdentity.identities(identityHash);
          isVerified = identity.verified;
          
          if (isVerified) {
            const creditScoreData = await contracts.privacyPreservingIdentity.getCreditScore(identityHash);
            creditScore = creditScoreData.score.toNumber();
          }
        } catch (err) {
          // Identity not registered
          isVerified = false;
        }
        
        setUserData({
          deposits: parseFloat(ethers.utils.formatEther(deposits)),
          borrows: parseFloat(ethers.utils.formatEther(borrows)),
          collateral: parseFloat(ethers.utils.formatEther(collateral)),
          availableLiquidity: parseFloat(ethers.utils.formatEther(deposits.sub(borrows))),
          healthFactor: parseFloat(ethers.utils.formatUnits(healthFactor, 2)),
          isVerified,
          riskScore: riskScore.toNumber(),
          creditScore,
        });
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError('Failed to fetch user data. Please try again later.');
        
        // Set mock data if error occurs
        setUserData({
          deposits: 5000,
          borrows: 3000,
          collateral: 10000,
          availableLiquidity: 2000,
          healthFactor: 1.67,
          isVerified: Math.random() > 0.3, // 70% chance of being verified
          riskScore: Math.floor(30 + Math.random() * 70), // 30-100 range
          creditScore: Math.floor(50 + Math.random() * 50), // 50-100 range
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [account, contracts]);
  
  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  // Handle verification completion
  const handleVerificationComplete = (data) => {
    setUserData({
      ...userData,
      isVerified: true,
      creditScore: data.creditScore,
    });
    
    // Switch to overview tab
    setActiveTab('overview');
  };
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  // Render loading state
  if (loading && !userData.riskScore) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading IntelliLend Dashboard...</p>
      </div>
    );
  }
  
  return (
    <div className="main-dashboard">
      <header className="dashboard-header">
        <h1>IntelliLend Dashboard</h1>
        <div className="user-info">
          <div className="account-info">
            <span className="account-label">Account:</span>
            <span className="account-address">
              {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Not connected'}
            </span>
          </div>
          <div className="connection-status">
            <div className={`status-indicator ${account ? 'connected' : 'disconnected'}`}></div>
            <span>{account ? 'Connected to IOTA' : 'Disconnected'}</span>
          </div>
        </div>
      </header>
      
      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Deposits</h3>
          <p className="stat-value">{formatCurrency(userData.deposits)}</p>
        </div>
        <div className="stat-card">
          <h3>Borrows</h3>
          <p className="stat-value">{formatCurrency(userData.borrows)}</p>
        </div>
        <div className="stat-card">
          <h3>Collateral</h3>
          <p className="stat-value">{formatCurrency(userData.collateral)}</p>
        </div>
        <div className="stat-card">
          <h3>Health Factor</h3>
          <p className={`stat-value ${userData.healthFactor < 1.1 ? 'danger' : userData.healthFactor < 1.5 ? 'warning' : 'good'}`}>
            {userData.healthFactor.toFixed(2)}
          </p>
        </div>
        <div className="stat-card">
          <h3>Risk Score</h3>
          <p className={`stat-value ${userData.riskScore > 70 ? 'danger' : userData.riskScore > 40 ? 'warning' : 'good'}`}>
            {userData.riskScore}
          </p>
        </div>
      </div>
      
      <div className="dashboard-actions">
        <button className="action-button" onClick={() => navigate('/deposit')}>Deposit</button>
        <button className="action-button" onClick={() => navigate('/borrow')}>Borrow</button>
        <button className="action-button" onClick={() => navigate('/repay')}>Repay</button>
        <button className="action-button" onClick={() => navigate('/withdraw')}>Withdraw</button>
        {!userData.isVerified && (
          <button 
            className="action-button verify-button" 
            onClick={() => setActiveTab('identity')}
          >
            Verify Identity
          </button>
        )}
      </div>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'risk' ? 'active' : ''}`}
          onClick={() => handleTabChange('risk')}
        >
          Risk Assessment
        </button>
        <button 
          className={`tab-button ${activeTab === 'liquidity' ? 'active' : ''}`}
          onClick={() => handleTabChange('liquidity')}
        >
          Cross-Chain Liquidity
        </button>
        <button 
          className={`tab-button ${activeTab === 'identity' ? 'active' : ''}`}
          onClick={() => handleTabChange('identity')}
        >
          Identity & Privacy
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-section">
              <h2>Account Overview</h2>
              <div className="overview-grid">
                <div className="overview-card">
                  <h3>Current Position</h3>
                  <div className="position-details">
                    <div className="position-item">
                      <span className="item-label">Total Supplied:</span>
                      <span className="item-value">{formatCurrency(userData.deposits)}</span>
                    </div>
                    <div className="position-item">
                      <span className="item-label">Total Borrowed:</span>
                      <span className="item-value">{formatCurrency(userData.borrows)}</span>
                    </div>
                    <div className="position-item">
                      <span className="item-label">Available Liquidity:</span>
                      <span className="item-value">{formatCurrency(userData.availableLiquidity)}</span>
                    </div>
                    <div className="position-item">
                      <span className="item-label">Loan-to-Value:</span>
                      <span className="item-value">
                        {userData.collateral > 0 ? 
                          `${((userData.borrows / userData.collateral) * 100).toFixed(2)}%` : 
                          'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="overview-card">
                  <h3>Risk Profile</h3>
                  <div className="risk-snapshot">
                    <div className="risk-meter">
                      <div className="meter-label">Risk Score</div>
                      <div className="meter-bar">
                        <div 
                          className="meter-fill" 
                          style={{ 
                            width: `${userData.riskScore}%`,
                            backgroundColor: userData.riskScore > 70 ? '#f44336' : 
                                            userData.riskScore > 40 ? '#ff9800' : '#4caf50'
                          }}
                        ></div>
                      </div>
                      <div className="meter-value">{userData.riskScore}/100</div>
                    </div>
                    
                    <div className="health-meter">
                      <div className="meter-label">Health Factor</div>
                      <div className="meter-bar">
                        <div 
                          className="meter-fill" 
                          style={{ 
                            width: `${Math.min(userData.healthFactor / 2 * 100, 100)}%`,
                            backgroundColor: userData.healthFactor < 1.1 ? '#f44336' : 
                                            userData.healthFactor < 1.5 ? '#ff9800' : '#4caf50'
                          }}
                        ></div>
                      </div>
                      <div className="meter-value">{userData.healthFactor.toFixed(2)}</div>
                      <div className="health-info">
                        {userData.healthFactor < 1.1 ? (
                          <span className="warning-text">Risk of liquidation! Add more collateral.</span>
                        ) : userData.healthFactor < 1.5 ? (
                          <span className="caution-text">Position is safe but close to risk threshold.</span>
                        ) : (
                          <span className="safe-text">Your position is well-collateralized.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="overview-card">
                  <h3>Identity Status</h3>
                  <div className="identity-status">
                    <div className="status-indicator">
                      <span className={`status-icon ${userData.isVerified ? 'verified' : 'unverified'}`}>
                        {userData.isVerified ? '✓' : '!'}
                      </span>
                      <span className="status-text">
                        {userData.isVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                    
                    {userData.isVerified ? (
                      <div className="credit-score">
                        <span className="score-label">Credit Score:</span>
                        <span className="score-value">{userData.creditScore}</span>
                        <div className="score-bar">
                          <div 
                            className="score-fill"
                            style={{ 
                              width: `${userData.creditScore}%`,
                              backgroundColor: userData.creditScore < 60 ? '#f44336' : 
                                              userData.creditScore < 80 ? '#ff9800' : '#4caf50'
                            }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <div className="verify-prompt">
                        <p>Verify your identity to access better rates and higher borrow limits.</p>
                        <button 
                          className="verify-now-button"
                          onClick={() => setActiveTab('identity')}
                        >
                          Verify Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="overview-card">
                  <h3>Optimization Opportunities</h3>
                  <div className="opportunities">
                    <div className="opportunity-item">
                      <div className="opportunity-icon rate-icon">%</div>
                      <div className="opportunity-details">
                        <h4>Lower Your Interest Rate</h4>
                        <p>Improve your risk score to reduce your borrowing costs.</p>
                        <button 
                          className="opportunity-button"
                          onClick={() => setActiveTab('risk')}
                        >
                          View Recommendations
                        </button>
                      </div>
                    </div>
                    
                    <div className="opportunity-item">
                      <div className="opportunity-icon yield-icon">$</div>
                      <div className="opportunity-details">
                        <h4>Increase Your Yield</h4>
                        <p>Optimize your liquidity across multiple chains.</p>
                        <button 
                          className="opportunity-button"
                          onClick={() => setActiveTab('liquidity')}
                        >
                          View Strategies
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'risk' && (
          <div className="risk-tab">
            <RiskScoreVisualizer 
              userAddress={account} 
              riskAssessmentContract={contracts.riskAssessment} 
              overallScore={userData.riskScore}
              detailedMetrics={{
                overall: userData.riskScore,
                repayment: 75,
                collateral: 60,
                volatility: 40,
                activity: 55
              }}
            />
          </div>
        )}
        
        {activeTab === 'liquidity' && (
          <div className="liquidity-tab">
            <CrossChainLiquidityPanel 
              userAddress={account}
              crossChainContract={contracts.crossChainLiquidity}
            />
          </div>
        )}
        
        {activeTab === 'identity' && (
          <div className="identity-tab">
            <PrivacyPreservingVerification 
              userAddress={account}
              identityContract={contracts.privacyPreservingIdentity}
              onVerificationComplete={handleVerificationComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MainDashboard;
