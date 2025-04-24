import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { ethers } from 'ethers';
import LendingPoolABI from '../abis/LendingPool.json';
import { LENDING_POOL_ADDRESS } from '../config';

const Dashboard = ({ address, provider }) => {
  const [userStats, setUserStats] = useState({
    deposits: 0,
    borrows: 0,
    collateral: 0,
    riskScore: 0,
    interestRate: 0,
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
  
  useEffect(() => {
    if (address && provider) {
      fetchUserData();
      fetchMarketData();
      fetchHistoricalData();
      fetchRecommendations();
    }
  }, [address, provider]);
  
  const fetchUserData = async () => {
    try {
      const contract = new ethers.Contract(
        LENDING_POOL_ADDRESS,
        LendingPoolABI,
        provider
      );
      
      const deposits = await contract.deposits(address);
      const borrows = await contract.borrows(address);
      const collateral = await contract.collaterals(address);
      const riskScore = await contract.riskScores(address);
      const interestRate = await contract.calculateInterestRate(address);
      
      setUserStats({
        deposits: ethers.utils.formatEther(deposits),
        borrows: ethers.utils.formatEther(borrows),
        collateral: ethers.utils.formatEther(collateral),
        riskScore: riskScore.toNumber(),
        interestRate: interestRate.toNumber(),
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };
  
  const fetchMarketData = async () => {
    // Mock data for now
    setMarketStats({
      totalDeposits: '1,000,000',
      totalBorrows: '750,000',
      totalCollateral: '1,500,000',
      utilizationRate: 75,
    });
  };
  
  const fetchHistoricalData = async () => {
    // Mock historical data
    setHistoryData({
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Risk Score',
          data: [65, 59, 80, 81, 56, 55],
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        },
        {
          label: 'Interest Rate',
          data: [8, 7, 9, 10, 7, 6],
          fill: false,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }
      ],
    });
  };
  
  const fetchRecommendations = async () => {
    // Mock recommendations based on AI analysis
    setRecommendations([
      {
        id: 1,
        title: 'Diversify Your Collateral',
        description: 'Adding different asset types as collateral can reduce your risk score by up to 10 points.',
        impact: 'high',
      },
      {
        id: 2,
        title: 'Increase Repayment Frequency',
        description: 'More frequent smaller repayments can improve your repayment pattern score.',
        impact: 'medium',
      },
      {
        id: 3,
        title: 'Add More Collateral',
        description: 'Your current collateralization ratio is lower than recommended.',
        impact: 'high',
      },
    ]);
  };
  
  // Risk score visualization
  const RiskMeter = ({ score }) => {
    let color = 'green';
    if (score > 70) color = 'red';
    else if (score > 40) color = 'orange';
    
    return (
      <div className="risk-meter">
        <h3>Risk Score</h3>
        <div className="meter-container">
          <div 
            className="meter-fill" 
            style={{ 
              width: `${score}%`, 
              backgroundColor: color 
            }} 
          />
        </div>
        <div className="meter-labels">
          <span>Low Risk</span>
          <span>High Risk</span>
        </div>
        <div className="score-value">{score}</div>
      </div>
    );
  };
  
  return (
    <div className="dashboard">
      <h1>IntelliLend Dashboard</h1>
      
      <div className="user-overview">
        <h2>Your Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Deposits</h3>
            <p className="stat-value">{userStats.deposits} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Borrows</h3>
            <p className="stat-value">{userStats.borrows} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Collateral</h3>
            <p className="stat-value">{userStats.collateral} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Interest Rate</h3>
            <p className="stat-value">{userStats.interestRate}%</p>
          </div>
        </div>
        
        <div className="risk-section">
          <RiskMeter score={userStats.riskScore} />
          <div className="risk-explanation">
            <h3>What affects your risk score?</h3>
            <ul>
              <li>Loan repayment history</li>
              <li>Collateralization ratio</li>
              <li>Wallet activity patterns</li>
              <li>Transaction diversity</li>
              <li>Cross-chain interactions</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="history-charts">
        <h2>Historical Performance</h2>
        <Line data={historyData} />
      </div>
      
      <div className="ai-recommendations">
        <h2>AI Recommendations</h2>
        <div className="recommendations-list">
          {recommendations.map(rec => (
            <div key={rec.id} className={`recommendation-card impact-${rec.impact}`}>
              <h3>{rec.title}</h3>
              <p>{rec.description}</p>
              <span className="impact-label">{rec.impact} impact</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="market-overview">
        <h2>Market Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Deposits</h3>
            <p className="stat-value">{marketStats.totalDeposits} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Total Borrows</h3>
            <p className="stat-value">{marketStats.totalBorrows} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Total Collateral</h3>
            <p className="stat-value">{marketStats.totalCollateral} IOTA</p>
          </div>
          <div className="stat-card">
            <h3>Utilization Rate</h3>
            <p className="stat-value">{marketStats.utilizationRate}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
