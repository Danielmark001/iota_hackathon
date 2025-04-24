import React, { useState, useEffect } from 'react';
import { Radar, Doughnut } from 'react-chartjs-2';
import { ethers } from 'ethers';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ArcElement } from 'chart.js';

// Register required Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ArcElement);

/**
 * Component for visualizing detailed risk score metrics
 * Includes both a radar chart for detailed metrics and a doughnut chart for overall score
 */
const RiskScoreVisualizer = ({ 
  userAddress, 
  riskAssessmentContract,
  overallScore = 50,
  detailedMetrics = null 
}) => {
  const [riskMetrics, setRiskMetrics] = useState({
    overall: overallScore,
    repayment: 0,
    collateral: 0,
    volatility: 0,
    activity: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Risk level classifications
  const getRiskLevel = (score) => {
    if (score <= 20) return "Very Low";
    if (score <= 40) return "Low";
    if (score <= 60) return "Medium";
    if (score <= 80) return "High";
    return "Very High";
  };
  
  // Risk level colors
  const getRiskColor = (score) => {
    if (score <= 20) return "#4CAF50"; // Green
    if (score <= 40) return "#8BC34A"; // Light Green
    if (score <= 60) return "#FFC107"; // Amber
    if (score <= 80) return "#FF9800"; // Orange
    return "#F44336"; // Red
  };
  
  // Fetch detailed risk metrics from the contract
  useEffect(() => {
    const fetchRiskMetrics = async () => {
      if (!userAddress || !riskAssessmentContract) {
        // Use provided default values if contract not available
        if (detailedMetrics) {
          setRiskMetrics({
            overall: detailedMetrics.overall || overallScore,
            repayment: detailedMetrics.repayment || 0,
            collateral: detailedMetrics.collateral || 0,
            volatility: detailedMetrics.volatility || 0,
            activity: detailedMetrics.activity || 0
          });
        }
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Call the contract to get detailed risk metrics
        const metrics = await riskAssessmentContract.getUserRiskMetrics(userAddress);
        
        setRiskMetrics({
          overall: metrics.overallScore.toNumber(),
          repayment: metrics.repaymentScore.toNumber(),
          collateral: metrics.collateralScore.toNumber(),
          volatility: metrics.volatilityScore.toNumber(),
          activity: metrics.activityScore.toNumber()
        });
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching risk metrics:", err);
        setError("Failed to load risk metrics");
        setLoading(false);
        
        // Fallback to mock data if contract call fails
        if (detailedMetrics) {
          setRiskMetrics({
            overall: detailedMetrics.overall || overallScore,
            repayment: detailedMetrics.repayment || 50,
            collateral: detailedMetrics.collateral || 60,
            volatility: detailedMetrics.volatility || 40,
            activity: detailedMetrics.activity || 55
          });
        }
      }
    };
    
    fetchRiskMetrics();
  }, [userAddress, riskAssessmentContract, detailedMetrics, overallScore]);
  
  // Data for radar chart showing detailed risk components
  const radarData = {
    labels: [
      'Repayment History', 
      'Collateral Quality', 
      'Wallet Volatility', 
      'On-chain Activity',
      'Overall Risk'
    ],
    datasets: [
      {
        label: 'Your Risk Profile',
        data: [
          riskMetrics.repayment,
          riskMetrics.collateral,
          riskMetrics.volatility,
          riskMetrics.activity,
          riskMetrics.overall
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(75, 192, 192, 1)',
      },
      {
        label: 'Market Average',
        data: [40, 45, 50, 55, 48],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 99, 132, 1)',
      },
    ],
  };
  
  // Radar chart options
  const radarOptions = {
    scales: {
      r: {
        angleLines: {
          display: true
        },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: {
          stepSize: 20
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += context.parsed + '/100';
            }
            return label;
          }
        }
      }
    }
  };
  
  // Data for doughnut chart showing overall risk score
  const doughnutData = {
    labels: ['Risk Score', 'Remaining'],
    datasets: [
      {
        data: [riskMetrics.overall, 100 - riskMetrics.overall],
        backgroundColor: [
          getRiskColor(riskMetrics.overall),
          '#e0e0e0',
        ],
        borderWidth: 0,
      },
    ],
  };
  
  // Doughnut chart options
  const doughnutOptions = {
    cutout: '70%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    maintainAspectRatio: false,
  };
  
  // Component to display metric score with colored indicator
  const MetricScore = ({ label, score }) => (
    <div className="metric-score">
      <span className="metric-label">{label}</span>
      <div className="score-bar-container">
        <div 
          className="score-bar" 
          style={{ 
            width: `${score}%`, 
            backgroundColor: getRiskColor(score) 
          }}
        />
      </div>
      <span className="score-value">{score}/100</span>
    </div>
  );
  
  if (loading) {
    return <div className="loading-spinner">Loading risk assessment...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  return (
    <div className="risk-score-visualizer">
      <div className="risk-score-container">
        <div className="overall-score-gauge">
          <h3>Overall Risk Score</h3>
          <div className="doughnut-container">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="doughnut-center">
              <span className="score-number">{riskMetrics.overall}</span>
              <span className="risk-level">{getRiskLevel(riskMetrics.overall)} Risk</span>
            </div>
          </div>
        </div>
        
        <div className="detailed-metrics">
          <h3>Risk Components</h3>
          <MetricScore label="Repayment History" score={riskMetrics.repayment} />
          <MetricScore label="Collateral Quality" score={riskMetrics.collateral} />
          <MetricScore label="Wallet Volatility" score={riskMetrics.volatility} />
          <MetricScore label="On-chain Activity" score={riskMetrics.activity} />
        </div>
      </div>
      
      <div className="radar-chart-container">
        <h3>Risk Profile Comparison</h3>
        <Radar data={radarData} options={radarOptions} />
      </div>
      
      <div className="risk-explanation">
        <h3>Understanding Your Risk Score</h3>
        <p>
          Your risk score is calculated using AI analysis of your on-chain activity and lending behavior.
          Lower scores indicate lower risk, which can lead to better borrowing terms and lower interest rates.
        </p>
        <ul className="risk-factors">
          <li>
            <strong>Repayment History:</strong> Evaluates your history of loan repayments across various platforms.
          </li>
          <li>
            <strong>Collateral Quality:</strong> Assesses the stability and diversification of your collateral assets.
          </li>
          <li>
            <strong>Wallet Volatility:</strong> Measures the stability of your wallet balances over time.
          </li>
          <li>
            <strong>On-chain Activity:</strong> Analyzes your general transaction patterns and DeFi interactions.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RiskScoreVisualizer;
