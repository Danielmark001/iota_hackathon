import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { ethers } from 'ethers';
import axios from 'axios';
import LendingPoolABI from '../abis/LendingPool.json';
import { LENDING_POOL_ADDRESS, API_URL } from '../config';

const Dashboard = ({ address, provider }) => {
  const [userStats, setUserStats] = useState({
    deposits: 0,
    borrows: 0,
    collateral: 0,
    riskScore: 0,
    interestRate: 0,
    healthFactor: 0,
  });
  
  const [marketStats, setMarketStats] = useState({
    totalDeposits: 0,
    totalBorrows: 0,
    totalCollateral: 0,
    utilizationRate: 0,
  });
  
  const [historyData, setHistoryData] = useState({
    labels: [],
    datasets: [],
  });
  
  const [recommendations, setRecommendations] = useState([]);
  const [riskFactors, setRiskFactors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [bridgeMessages, setBridgeMessages] = useState([]);
  
  useEffect(() => {
    if (address && provider) {
      fetchUserData();
      fetchMarketData();
      fetchHistoricalData();
      fetchRecommendations();
      fetchBridgeMessages();
    }
  }, [address, provider]);
  
  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/api/user/${address}`);
      setUserStats(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setIsLoading(false);
    }
  };
  
  const fetchMarketData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/market`);
      setMarketStats(response.data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };
  
  const fetchHistoricalData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/history/${address}`);
      setHistoryData(response.data);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };
  
  const fetchRecommendations = async () => {
    try {
      // First try to get cached recommendations
      const response = await axios.get(`${API_URL}/api/recommendations/${address}`);
      setRecommendations(response.data);
      
      // Request a fresh risk assessment
      const riskResponse = await axios.post(`${API_URL}/api/risk-assessment`, {
        address,
        onChainData: null // Let the backend fetch the data
      });
      
      // Update with fresh data
      setUserStats(prev => ({
        ...prev,
        riskScore: riskResponse.data.riskScore
      }));
      setRecommendations(riskResponse.data.recommendations);
      setRiskFactors(riskResponse.data.topFactors);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };
  
  const fetchBridgeMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bridge/messages/${address}`);
      setBridgeMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching bridge messages:', error);
    }
  };
  
  const handleDeposit = async () => {
    // Implementation for deposit function
    console.log('Deposit functionality to be implemented');
  };
  
  const handleBorrow = async () => {
    // Implementation for borrow function
    console.log('Borrow functionality to be implemented');
  };
  
  const handleRepay = async () => {
    // Implementation for repay function
    console.log('Repay functionality to be implemented');
  };
  
  const handleWithdraw = async () => {
    // Implementation for withdraw function
    console.log('Withdraw functionality to be implemented');
  };
  
  // Enhanced Risk score visualization with AI insights
  const RiskMeter = ({ score }) => {
    let color = 'green';
    let label = 'Low Risk';
    let riskTier = 'A';
    
    if (score > 70) {
      color = 'red';
      label = 'High Risk';
      riskTier = 'D';
    } else if (score > 55) {
      color = '#FF4500'; // OrangeRed
      label = 'Medium-High Risk';
      riskTier = 'C';
    } else if (score > 40) {
      color = 'orange';
      label = 'Medium Risk';
      riskTier = 'B';
    } else if (score > 25) {
      color = '#32CD32'; // LimeGreen
      label = 'Low-Medium Risk';
      riskTier = 'A-';
    }
    
    // Calculate interest rate based on risk score
    const baseRate = 3;
    const riskPremium = Math.floor(score / 10);
    const interestRate = baseRate + riskPremium;
    
    // AI model confidence level (simulated)
    const modelConfidence = 95 - (Math.abs(50 - score) / 2);
    
    const doughnutData = {
      labels: ['Risk Score', 'Remaining'],
      datasets: [
        {
          data: [score, 100 - score],
          backgroundColor: [color, '#f1f1f1'],
          borderWidth: 0,
          cutout: '80%'
        }
      ]
    };
    
    const doughnutOptions = {
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      rotation: -90,
      circumference: 180,
      maintainAspectRatio: false
    };
    
    // Calculate time-based risk trend (simulated data)
    const riskTrend = score > 50 ? 'increasing' : 'decreasing';
    const trendPercentage = Math.abs((score - 50) / 100 * 5).toFixed(1); // Up to 5% change
    
    return (
      <div className="risk-meter">
        <div className="risk-header">
          <h3>AI-Powered Risk Assessment</h3>
          <div className="risk-tier">Tier {riskTier}</div>
        </div>
        
        <div className="meter-container">
          <Doughnut data={doughnutData} options={doughnutOptions} />
          <div className="meter-label">
            <span className="score-value">{score}</span>
            <span className="risk-label">{label}</span>
          </div>
        </div>
        
        <div className="ai-insights">
          <h4>AI Insights</h4>
          <div className="insight-metrics">
            <div className="metric">
              <span className="metric-label">Model Confidence:</span>
              <span className="metric-value">{modelConfidence.toFixed(1)}%</span>
            </div>
            <div className="metric">
              <span className="metric-label">Risk Trend:</span>
              <span className="metric-value" style={{color: riskTrend === 'increasing' ? 'red' : 'green'}}>
                {riskTrend === 'increasing' ? '↑' : '↓'} {trendPercentage}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Interest Rate Impact:</span>
              <span className="metric-value">{interestRate}%</span>
            </div>
          </div>
        </div>
        
        <div className="meter-details">
          <p>Your risk score is calculated using AI analysis of 38+ on-chain and verified identity factors.</p>
          <div className="risk-factors">
            <h4>Top Risk Factors</h4>
            <ul>
              {riskFactors.map((factor, index) => (
                <li key={index}>
                  <div className="factor-header">
                    <span className="factor-name">{factor.Feature}</span>
                    <span className="factor-value">{(factor.Importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="factor-bar-container">
                    <div 
                      className="factor-impact" 
                      style={{ 
                        width: `${factor.Importance * 100}%`,
                        backgroundColor: factor.Importance > 0.5 ? '#f44336' : 
                                         factor.Importance > 0.3 ? '#ff9800' : '#4caf50'
                      }}
                    />
                  </div>
                  <p className="factor-description">{getFactorDescription(factor.Feature)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="risk-actions">
          <h4>Risk Improvement Actions</h4>
          <div className="action-buttons">
            <button className="action-button">Verify Identity</button>
            <button className="action-button">Add Collateral</button>
            <button className="action-button">View Detailed Report</button>
          </div>
        </div>
      </div>
    );
  };
  
  // Helper function to get risk factor descriptions
  const getFactorDescription = (factorName) => {
    const descriptions = {
      'wallet_balance_volatility': 'Frequent large changes in wallet balance indicate higher risk',
      'repayment_ratio': 'Your historical loan repayment performance',
      'transaction_count': 'Regular transaction activity indicates stability',
      'late_payment_frequency': 'History of making loan payments after due date',
      'market_volatility_correlation': 'How your assets correlate with market swings',
      'network_centrality': 'Your position in the transaction network ecosystem',
      'collateral_diversity': 'Range of different asset types used as collateral'
    };
    
    return descriptions[factorName] || 'This factor contributes to your overall risk assessment';
  };
  
  // Health factor visualization
  const HealthFactorMeter = ({ healthFactor }) => {
    let color = 'red';
    let label = 'Unhealthy';
    
    if (healthFactor >= 2) {
      color = 'green';
      label = 'Very Healthy';
    } else if (healthFactor >= 1.5) {
      color = 'lightgreen';
      label = 'Healthy';
    } else if (healthFactor >= 1.1) {
      color = 'orange';
      label = 'Caution';
    }
    
    return (
      <div className="health-factor-meter">
        <h3>Health Factor: {healthFactor.toFixed(2)}</h3>
        <div className="meter-container">
          <div 
            className="meter-fill" 
            style={{ 
              width: `${Math.min(healthFactor * 40, 100)}%`, 
              backgroundColor: color 
            }} 
          />
        </div>
        <div className="meter-labels">
          <span>Liquidation Risk</span>
          <span>{label}</span>
        </div>
        <p className="health-factor-explanation">
          Health factor below 1 will trigger liquidation. 
          Keep it above 1.5 for safety margin.
        </p>
      </div>
    );
  };
  
  // Cross-layer bridge messaging visualization
  const BridgeMessagesList = ({ messages }) => {
    return (
      <div className="bridge-messages">
        <h3>Cross-Layer Messages</h3>
        {messages.length === 0 ? (
          <p>No messages found.</p>
        ) : (
          <table className="messages-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Timestamp</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, index) => (
                <tr key={index} className={`status-${msg.status.toLowerCase()}`}>
                  <td>{msg.messageType}</td>
                  <td>{msg.status}</td>
                  <td>{new Date(msg.timestamp).toLocaleString()}</td>
                  <td>{`${msg.targetAddress.substr(0, 6)}...${msg.targetAddress.substr(-4)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };
  
  return (
    <div className="dashboard">
      <h1>IntelliLend Dashboard</h1>
      
      <div className="tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'risk' ? 'active' : ''} 
          onClick={() => setActiveTab('risk')}
        >
          Risk Analysis
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button 
          className={activeTab === 'bridge' ? 'active' : ''} 
          onClick={() => setActiveTab('bridge')}
        >
          Cross-Layer Bridge
        </button>
      </div>
      
      {isLoading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="user-overview">
                <h2>Your Overview</h2>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Deposits</h3>
                    <p className="stat-value">{parseFloat(userStats.deposits).toFixed(2)} IOTA</p>
                    <button className="action-button" onClick={handleDeposit}>Deposit</button>
                    <button className="action-button secondary" onClick={handleWithdraw}>Withdraw</button>
                  </div>
                  <div className="stat-card">
                    <h3>Borrows</h3>
                    <p className="stat-value">{parseFloat(userStats.borrows).toFixed(2)} IOTA</p>
                    <button className="action-button" onClick={handleBorrow}>Borrow</button>
                    <button className="action-button secondary" onClick={handleRepay}>Repay</button>
                  </div>
                  <div className="stat-card">
                    <h3>Collateral</h3>
                    <p className="stat-value">{parseFloat(userStats.collateral).toFixed(2)} IOTA</p>
                    <button className="action-button">Add Collateral</button>
                    <button className="action-button secondary">Remove Collateral</button>
                  </div>
                  <div className="stat-card">
                    <h3>Interest Rate</h3>
                    <p className="stat-value">{userStats.interestRate}%</p>
                    <div className="interest-explanation">
                      <p>Your personalized rate based on risk score and market conditions</p>
                    </div>
                  </div>
                </div>
                
                <div className="health-overview">
                  <HealthFactorMeter healthFactor={userStats.healthFactor} />
                </div>
                
                <div className="market-overview">
                  <h2>Market Overview</h2>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h3>Total Deposits</h3>
                      <p className="stat-value">{parseFloat(marketStats.totalDeposits).toLocaleString()} IOTA</p>
                    </div>
                    <div className="stat-card">
                      <h3>Total Borrows</h3>
                      <p className="stat-value">{parseFloat(marketStats.totalBorrows).toLocaleString()} IOTA</p>
                    </div>
                    <div className="stat-card">
                      <h3>Total Collateral</h3>
                      <p className="stat-value">{parseFloat(marketStats.totalCollateral).toLocaleString()} IOTA</p>
                    </div>
                    <div className="stat-card">
                      <h3>Utilization Rate</h3>
                      <p className="stat-value">{marketStats.utilizationRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'risk' && (
            <div className="risk-tab">
              <div className="risk-analysis">
                <div className="risk-meter-container">
                  <RiskMeter score={userStats.riskScore} />
                </div>
                
                <div className="ai-recommendations">
                  <h2>AI Recommendations</h2>
                  <div className="recommendations-list">
                    {recommendations.map((rec, index) => (
                      <div key={index} className={`recommendation-card impact-${rec.impact}`}>
                        <h3>{rec.title}</h3>
                        <p>{rec.description}</p>
                        <span className="impact-label">{rec.impact} impact</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="history-tab">
              <div className="history-charts">
                <h2>Historical Performance</h2>
                <Line data={historyData} />
                
                <div className="transaction-history">
                  <h3>Recent Transactions</h3>
                  {/* Transaction history would go here */}
                  <p>Transaction history will be implemented in the next phase.</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'bridge' && (
            <div className="bridge-tab">
              <h2>Cross-Layer Bridge</h2>
              <p className="bridge-explanation">
                IntelliLend leverages IOTA's dual-layer architecture for enhanced security and efficiency.
                Layer 1 (Move) handles secure asset representation, while Layer 2 (EVM) manages lending operations.
                The Cross-Layer Bridge enables communication between these layers.
              </p>
              
              <div className="bridge-visualization">
                <div className="layer layer-1">
                  <h3>Layer 1 (Move)</h3>
                  <ul>
                    <li>Secure Asset Representation</li>
                    <li>Identity Framework</li>
                    <li>Object-Centric Design</li>
                  </ul>
                </div>
                
                <div className="bridge-connector">
                  <span className="bridge-arrow down">↓</span>
                  <span className="bridge-label">Cross-Layer Bridge</span>
                  <span className="bridge-arrow up">↑</span>
                </div>
                
                <div className="layer layer-2">
                  <h3>Layer 2 (EVM)</h3>
                  <ul>
                    <li>Lending Operations</li>
                    <li>Collateral Management</li>
                    <li>Interest Rate Model</li>
                  </ul>
                </div>
              </div>
              
              <BridgeMessagesList messages={bridgeMessages} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
