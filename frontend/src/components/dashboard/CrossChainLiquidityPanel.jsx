import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Bar, Pie } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement
} from 'chart.js';

// Register required Chart.js components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement
);

/**
 * Component for displaying cross-chain liquidity information and optimization recommendations
 */
const CrossChainLiquidityPanel = ({ 
  userAddress, 
  crossChainContract, 
  defaultChains = [],
  defaultMetrics = null
}) => {
  const [chains, setChains] = useState(defaultChains.length > 0 ? defaultChains : [
    { id: 1, name: 'IOTA EVM', liquidity: 1200000, utilization: 68, apy: 5.2 },
    { id: 2, name: 'Shimmer', liquidity: 800000, utilization: 75, apy: 6.8 },
    { id: 3, name: 'Ethereum', liquidity: 500000, utilization: 82, apy: 4.9 },
    { id: 4, name: 'Polygon', liquidity: 350000, utilization: 60, apy: 7.1 },
    { id: 5, name: 'Avalanche', liquidity: 250000, utilization: 55, apy: 8.5 },
  ]);
  
  const [userLiquidity, setUserLiquidity] = useState([]);
  const [optimalDistribution, setOptimalDistribution] = useState([]);
  const [potentialYield, setPotentialYield] = useState(0);
  const [currentYield, setCurrentYield] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch cross-chain liquidity data
  useEffect(() => {
    const fetchCrossChainData = async () => {
      if (!userAddress || !crossChainContract) {
        // Use mock data if contract not available
        generateMockData();
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Fetch supported chains
        const chainList = await crossChainContract.getSupportedChains();
        const chainsData = [];
        
        // Fetch data for each chain
        for (const chainId of chainList) {
          const chainInfo = await crossChainContract.getChainInfo(chainId);
          chainsData.push({
            id: chainId.toNumber(),
            name: chainInfo.name,
            liquidity: parseFloat(ethers.utils.formatEther(chainInfo.totalLiquidity)),
            utilization: chainInfo.utilizationRate.toNumber() / 100,
            apy: chainInfo.interestRate.toNumber() / 100,
          });
        }
        
        setChains(chainsData);
        
        // Fetch user's liquidity distribution
        const userLiquidityData = [];
        
        for (const chain of chainsData) {
          const userLiquidity = await crossChainContract.getUserLiquidity(userAddress, chain.id);
          userLiquidityData.push({
            chainId: chain.id,
            amount: parseFloat(ethers.utils.formatEther(userLiquidity)),
            chainName: chain.name,
          });
        }
        
        setUserLiquidity(userLiquidityData);
        
        // Calculate current yield
        let totalYield = 0;
        let totalLiquidity = 0;
        
        userLiquidityData.forEach(item => {
          const chain = chainsData.find(c => c.id === item.chainId);
          if (chain) {
            totalYield += item.amount * (chain.apy / 100);
            totalLiquidity += item.amount;
          }
        });
        
        setCurrentYield(totalYield);
        
        // Get optimal distribution recommendation
        const optimalResults = await crossChainContract.getOptimalDistribution(userAddress);
        const optimalData = [];
        
        for (let i = 0; i < optimalResults.chainIds.length; i++) {
          const chainId = optimalResults.chainIds[i].toNumber();
          const chain = chainsData.find(c => c.id === chainId);
          
          optimalData.push({
            chainId: chainId,
            amount: parseFloat(ethers.utils.formatEther(optimalResults.amounts[i])),
            chainName: chain ? chain.name : `Chain ${chainId}`,
          });
        }
        
        setOptimalDistribution(optimalData);
        setPotentialYield(parseFloat(ethers.utils.formatEther(optimalResults.projectedYield)));
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching cross-chain data:", err);
        setError("Failed to load cross-chain liquidity data");
        
        // Fallback to mock data
        generateMockData();
        setLoading(false);
      }
    };
    
    // Generate mock data for development or when contract is unavailable
    const generateMockData = () => {
      // Use default chains or create mock data
      const chainsData = defaultChains.length > 0 ? defaultChains : [
        { id: 1, name: 'IOTA EVM', liquidity: 1200000, utilization: 68, apy: 5.2 },
        { id: 2, name: 'Shimmer', liquidity: 800000, utilization: 75, apy: 6.8 },
        { id: 3, name: 'Ethereum', liquidity: 500000, utilization: 82, apy: 4.9 },
        { id: 4, name: 'Polygon', liquidity: 350000, utilization: 60, apy: 7.1 },
        { id: 5, name: 'Avalanche', liquidity: 250000, utilization: 55, apy: 8.5 },
      ];
      
      setChains(chainsData);
      
      // Mock user liquidity data
      const userLiquidityData = [
        { chainId: 1, amount: 5000, chainName: 'IOTA EVM' },
        { chainId: 2, amount: 2000, chainName: 'Shimmer' },
        { chainId: 3, amount: 1500, chainName: 'Ethereum' },
        { chainId: 4, amount: 500, chainName: 'Polygon' },
        { chainId: 5, amount: 0, chainName: 'Avalanche' },
      ];
      
      setUserLiquidity(userLiquidityData);
      
      // Calculate current yield
      let totalYield = 0;
      userLiquidityData.forEach(item => {
        const chain = chainsData.find(c => c.id === item.chainId);
        if (chain) {
          totalYield += item.amount * (chain.apy / 100);
        }
      });
      
      setCurrentYield(totalYield);
      
      // Mock optimal distribution
      const optimalData = [
        { chainId: 1, amount: 3000, chainName: 'IOTA EVM' },
        { chainId: 2, amount: 2500, chainName: 'Shimmer' },
        { chainId: 5, amount: 2000, chainName: 'Avalanche' },
        { chainId: 4, amount: 1500, chainName: 'Polygon' },
        { chainId: 3, amount: 500, chainName: 'Ethereum' },
      ];
      
      setOptimalDistribution(optimalData);
      
      // Calculate potential yield
      let potentialYield = 0;
      optimalData.forEach(item => {
        const chain = chainsData.find(c => c.id === item.chainId);
        if (chain) {
          potentialYield += item.amount * (chain.apy / 100);
        }
      });
      
      setPotentialYield(potentialYield);
    };
    
    fetchCrossChainData();
  }, [userAddress, crossChainContract, defaultChains]);
  
  // Prepare data for the liquidity distribution bar chart
  const distributionData = {
    labels: chains.map(chain => chain.name),
    datasets: [
      {
        label: 'Current Distribution',
        data: chains.map(chain => {
          const userChain = userLiquidity.find(item => item.chainId === chain.id);
          return userChain ? userChain.amount : 0;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Optimal Distribution',
        data: chains.map(chain => {
          const optimalChain = optimalDistribution.find(item => item.chainId === chain.id);
          return optimalChain ? optimalChain.amount : 0;
        }),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  const distributionOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount (IOTA)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Blockchain Network',
        },
      },
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Cross-Chain Liquidity Distribution',
      },
    },
  };
  
  // Prepare data for the yield comparison pie chart
  const yieldData = {
    labels: ['Current Yield', 'Additional Potential'],
    datasets: [
      {
        data: [currentYield, Math.max(0, potentialYield - currentYield)],
        backgroundColor: [
          'rgba(54, 162, 235, 0.5)',
          'rgba(75, 192, 192, 0.5)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  const yieldOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Yield Comparison',
      },
    },
  };
  
  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  if (loading) {
    return <div className="loading-spinner">Loading cross-chain data...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  return (
    <div className="cross-chain-liquidity-panel">
      <div className="panel-header">
        <h2>Cross-Chain Liquidity Optimization</h2>
        <p className="panel-description">
          Optimize your liquidity across multiple blockchain networks to maximize yield and minimize risk.
          Our AI-powered system analyzes market conditions and recommends the optimal distribution.
        </p>
      </div>
      
      <div className="distribution-comparison">
        <div className="chart-container">
          <Bar data={distributionData} options={distributionOptions} />
        </div>
      </div>
      
      <div className="stats-row">
        <div className="stat-card">
          <h3>Current Yield</h3>
          <p className="stat-value">{formatCurrency(currentYield)}</p>
          <p className="stat-description">Annual yield based on current distribution</p>
        </div>
        
        <div className="stat-card highlight">
          <h3>Potential Yield</h3>
          <p className="stat-value">{formatCurrency(potentialYield)}</p>
          <p className="stat-description">Annual yield with optimal distribution</p>
        </div>
        
        <div className="stat-card">
          <h3>Yield Increase</h3>
          <p className="stat-value">
            {((potentialYield / currentYield - 1) * 100).toFixed(2)}%
          </p>
          <p className="stat-description">Percentage increase in annual yield</p>
        </div>
        
        <div className="stat-card">
          <h3>Networks</h3>
          <p className="stat-value">{chains.length}</p>
          <p className="stat-description">Supported blockchain networks</p>
        </div>
      </div>
      
      <div className="yield-comparison">
        <div className="chart-container pie-chart">
          <Pie data={yieldData} options={yieldOptions} />
        </div>
        
        <div className="yield-info">
          <h3>Yield Optimization Breakdown</h3>
          <p className="yield-description">
            By redistributing your liquidity across multiple chains according to our AI-powered optimization algorithm,
            you can achieve a higher yield while maintaining your risk profile.
          </p>
          
          <div className="yield-breakdown">
            <div className="breakdown-row">
              <span className="breakdown-label">Current Annual Yield:</span>
              <span className="breakdown-value">{formatCurrency(currentYield)}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-label">Optimal Annual Yield:</span>
              <span className="breakdown-value">{formatCurrency(potentialYield)}</span>
            </div>
            <div className="breakdown-row highlight">
              <span className="breakdown-label">Additional Annual Yield:</span>
              <span className="breakdown-value">{formatCurrency(potentialYield - currentYield)}</span>
            </div>
          </div>
          
          <button className="optimize-button">Optimize Distribution</button>
          <p className="fee-note">
            Note: Cross-chain transfers may incur network fees.
            The optimization takes these fees into account in the yield calculation.
          </p>
        </div>
      </div>
      
      <div className="network-comparison">
        <h3>Network Comparison</h3>
        <div className="network-table-container">
          <table className="network-table">
            <thead>
              <tr>
                <th>Network</th>
                <th>Total Liquidity</th>
                <th>Utilization</th>
                <th>Current APY</th>
                <th>Your Allocation</th>
                <th>Recommended</th>
              </tr>
            </thead>
            <tbody>
              {chains.map(chain => {
                const userChain = userLiquidity.find(item => item.chainId === chain.id);
                const optimalChain = optimalDistribution.find(item => item.chainId === chain.id);
                const userAmount = userChain ? userChain.amount : 0;
                const optimalAmount = optimalChain ? optimalChain.amount : 0;
                const diffPercent = userAmount > 0 ? ((optimalAmount / userAmount - 1) * 100).toFixed(1) : 'N/A';
                
                return (
                  <tr key={chain.id}>
                    <td>{chain.name}</td>
                    <td>{formatCurrency(chain.liquidity)}</td>
                    <td>{(chain.utilization).toFixed(1)}%</td>
                    <td>{chain.apy.toFixed(1)}%</td>
                    <td>{formatCurrency(userAmount)}</td>
                    <td className={optimalAmount > userAmount ? 'increase' : optimalAmount < userAmount ? 'decrease' : ''}>
                      {formatCurrency(optimalAmount)} {diffPercent !== 'N/A' ? `(${diffPercent > 0 ? '+' : ''}${diffPercent}%)` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CrossChainLiquidityPanel;
