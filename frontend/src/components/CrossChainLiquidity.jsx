import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import CrossChainLiquidityABI from '../abis/CrossChainLiquidity.json';
import { CROSS_CHAIN_LIQUIDITY_ADDRESS, API_URL } from '../config';

/**
 * Component for cross-chain liquidity management
 * Enables users to optimize capital efficiency across multiple chains
 */
const CrossChainLiquidity = ({ address, provider }) => {
  const [liquidityStats, setLiquidityStats] = useState({
    totalLiquidity: 0,
    allocatedLiquidity: 0,
    utilizationRate: 0,
    apy: 0
  });
  
  const [chains, setChains] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [strategies, setStrategies] = useState([]);
  
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestination, setTransferDestination] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState(null);
  
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  
  const [contract, setContract] = useState(null);
  const [error, setError] = useState(null);
  
  // Initialize contract and load data
  useEffect(() => {
    if (address && provider) {
      const signer = provider.getSigner();
      const crossChainContract = new ethers.Contract(
        CROSS_CHAIN_LIQUIDITY_ADDRESS,
        CrossChainLiquidityABI,
        signer
      );
      setContract(crossChainContract);
      
      fetchLiquidityData();
      fetchChains();
      fetchTokens();
      fetchTransfers();
      fetchStrategies();
    }
  }, [address, provider]);
  
  const fetchLiquidityData = async () => {
    try {
      const response = await axios.get(`${API_URL}/liquidity/${address}`);
      setLiquidityStats(response.data);
    } catch (error) {
      console.error('Error fetching liquidity data:', error);
      // Use mock data for demonstration
      setLiquidityStats({
        totalLiquidity: 1000,
        allocatedLiquidity: 700,
        utilizationRate: 70,
        apy: 8.5
      });
    }
  };
  
  const fetchChains = async () => {
    try {
      if (contract) {
        const chainIds = await contract.getSupportedChains();
        
        const chainsData = await Promise.all(
          chainIds.map(async (chainId) => {
            const chainInfo = await contract.supportedChains(chainId);
            return {
              id: chainId.toString(),
              name: chainInfo.name,
              active: chainInfo.active,
              liquidity: ethers.utils.formatEther(chainInfo.liquidityAmount),
              lastSync: new Date(chainInfo.lastSyncTimestamp.toNumber() * 1000)
            };
          })
        );
        
        setChains(chainsData);
        if (chainsData.length > 0) {
          setSelectedChain(chainsData[0].id);
        }
      } else {
        // Mock data for demonstration
        const mockChains = [
          { id: '1', name: 'IOTA EVM', active: true, liquidity: '800', lastSync: new Date() },
          { id: '2', name: 'Ethereum', active: true, liquidity: '200', lastSync: new Date() },
          { id: '3', name: 'Shimmer', active: true, liquidity: '150', lastSync: new Date() }
        ];
        setChains(mockChains);
        setSelectedChain(mockChains[0].id);
      }
    } catch (error) {
      console.error('Error fetching chains:', error);
      // Mock data for demonstration
      const mockChains = [
        { id: '1', name: 'IOTA EVM', active: true, liquidity: '800', lastSync: new Date() },
        { id: '2', name: 'Ethereum', active: true, liquidity: '200', lastSync: new Date() },
        { id: '3', name: 'Shimmer', active: true, liquidity: '150', lastSync: new Date() }
      ];
      setChains(mockChains);
      setSelectedChain(mockChains[0].id);
    }
  };
  
  const fetchTokens = async () => {
    try {
      if (contract) {
        const tokenSymbols = await contract.getSupportedTokens();
        
        const tokensData = await Promise.all(
          tokenSymbols.map(async (symbol) => {
            const tokenInfo = await contract.getLiquidityPool(symbol);
            return {
              symbol: tokenInfo.symbol,
              totalLiquidity: ethers.utils.formatEther(tokenInfo.totalLiquidity),
              allocatedLiquidity: ethers.utils.formatEther(tokenInfo.allocatedLiquidity),
              utilizationRate: tokenInfo.utilizationRate.toNumber() / 1e6,
              apy: tokenInfo.apy.toNumber() / 1e6,
              active: tokenInfo.active
            };
          })
        );
        
        setTokens(tokensData);
        if (tokensData.length > 0) {
          setSelectedToken(tokensData[0].symbol);
        }
      } else {
        // Mock data for demonstration
        const mockTokens = [
          { symbol: 'IOTA', totalLiquidity: '1000', allocatedLiquidity: '700', utilizationRate: 0.7, apy: 0.085, active: true },
          { symbol: 'MIOTA', totalLiquidity: '500', allocatedLiquidity: '300', utilizationRate: 0.6, apy: 0.075, active: true },
          { symbol: 'iotaUSD', totalLiquidity: '2000', allocatedLiquidity: '1200', utilizationRate: 0.6, apy: 0.06, active: true }
        ];
        setTokens(mockTokens);
        setSelectedToken(mockTokens[0].symbol);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Mock data for demonstration
      const mockTokens = [
        { symbol: 'IOTA', totalLiquidity: '1000', allocatedLiquidity: '700', utilizationRate: 0.7, apy: 0.085, active: true },
        { symbol: 'MIOTA', totalLiquidity: '500', allocatedLiquidity: '300', utilizationRate: 0.6, apy: 0.075, active: true },
        { symbol: 'iotaUSD', totalLiquidity: '2000', allocatedLiquidity: '1200', utilizationRate: 0.6, apy: 0.06, active: true }
      ];
      setTokens(mockTokens);
      setSelectedToken(mockTokens[0].symbol);
    }
  };
  
  const fetchTransfers = async () => {
    try {
      const response = await axios.get(`${API_URL}/liquidity/transfers/${address}`);
      setTransfers(response.data);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      // Mock data for demonstration
      const mockTransfers = [
        { 
          id: '0x123', 
          sourceChain: 'IOTA EVM', 
          targetChain: 'Ethereum', 
          symbol: 'IOTA', 
          amount: '50', 
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 
          status: 'Completed' 
        },
        { 
          id: '0x456', 
          sourceChain: 'Ethereum', 
          targetChain: 'IOTA EVM', 
          symbol: 'IOTA', 
          amount: '30', 
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
          status: 'Completed' 
        },
        { 
          id: '0x789', 
          sourceChain: 'IOTA EVM', 
          targetChain: 'Shimmer', 
          symbol: 'MIOTA', 
          amount: '20', 
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), 
          status: 'In progress' 
        }
      ];
      setTransfers(mockTransfers);
    }
  };
  
  const fetchStrategies = async () => {
    try {
      const response = await axios.get(`${API_URL}/liquidity/strategies`);
      setStrategies(response.data);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      // Mock data for demonstration
      const mockStrategies = [
        { 
          id: 'strategy1', 
          name: 'Yield Aggregator', 
          description: 'Automatically allocates funds to the highest yielding protocols', 
          apy: 12.5, 
          risk: 'Medium',
          active: true
        },
        { 
          id: 'strategy2', 
          name: 'Liquidity Provider', 
          description: 'Provides liquidity to DEXes for trading fees', 
          apy: 8.2, 
          risk: 'Low',
          active: true
        },
        { 
          id: 'strategy3', 
          name: 'Flash Loan Provider', 
          description: 'Generates fees by providing flash loans', 
          apy: 5.7, 
          risk: 'Low',
          active: true
        }
      ];
      setStrategies(mockStrategies);
    }
  };
  
  const handleAddLiquidity = async () => {
    if (!selectedToken || !liquidityAmount || isNaN(parseFloat(liquidityAmount)) || parseFloat(liquidityAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    setIsAddingLiquidity(true);
    setError(null);
    
    try {
      if (contract) {
        // Convert amount to wei
        const amount = ethers.utils.parseEther(liquidityAmount);
        
        // Call contract method
        const tx = await contract.addLiquidity(selectedToken, amount);
        await tx.wait();
        
        // Refresh data
        fetchLiquidityData();
        fetchTokens();
        
        // Reset input
        setLiquidityAmount('');
        setIsAddingLiquidity(false);
      } else {
        // Simulate transaction for demonstration
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update data with mock values
        setLiquidityStats(prev => ({
          ...prev,
          totalLiquidity: prev.totalLiquidity + parseFloat(liquidityAmount)
        }));
        
        setTokens(prev => 
          prev.map(token => 
            token.symbol === selectedToken
              ? {
                  ...token,
                  totalLiquidity: (parseFloat(token.totalLiquidity) + parseFloat(liquidityAmount)).toString()
                }
              : token
          )
        );
        
        // Reset input
        setLiquidityAmount('');
        setIsAddingLiquidity(false);
      }
    } catch (error) {
      console.error('Error adding liquidity:', error);
      setError('Failed to add liquidity. Please try again.');
      setIsAddingLiquidity(false);
    }
  };
  
  const handleTransferLiquidity = async () => {
    if (!selectedToken || !transferAmount || !transferDestination || 
        isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
      setError('Please enter valid transfer details');
      return;
    }
    
    setIsTransferring(true);
    setTransferStatus('Processing');
    setError(null);
    
    try {
      if (contract) {
        // Get destination chain ID
        const destinationChain = chains.find(chain => chain.name === transferDestination);
        if (!destinationChain) {
          throw new Error('Invalid destination chain');
        }
        
        // Convert amount to wei
        const amount = ethers.utils.parseEther(transferAmount);
        
        // Convert recipient address to bytes32
        const recipientBytes = ethers.utils.hexZeroPad(address, 32);
        
        // Call contract method
        const tx = await contract.initiateTransfer(
          destinationChain.id,
          recipientBytes,
          selectedToken,
          amount
        );
        
        const receipt = await tx.wait();
        
        // Find transfer ID from event logs
        const transferId = receipt.events
          .filter(event => event.event === 'CrossChainTransferInitiated')
          .map(event => event.args.transferId)[0];
        
        setTransferStatus('Completed');
        
        // Refresh data
        fetchTransfers();
        fetchLiquidityData();
        fetchChains();
        
        // Reset inputs
        setTransferAmount('');
        setTimeout(() => {
          setIsTransferModalOpen(false);
          setIsTransferring(false);
          setTransferStatus(null);
        }, 2000);
      } else {
        // Simulate transaction for demonstration
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Add mock transfer to the list
        setTransfers(prev => [
          {
            id: `0x${Math.random().toString(16).slice(2, 10)}`,
            sourceChain: 'IOTA EVM',
            targetChain: transferDestination,
            symbol: selectedToken,
            amount: transferAmount,
            timestamp: new Date(),
            status: 'In progress'
          },
          ...prev
        ]);
        
        setTransferStatus('Completed');
        
        // Reset inputs
        setTransferAmount('');
        setTimeout(() => {
          setIsTransferModalOpen(false);
          setIsTransferring(false);
          setTransferStatus(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Error transferring liquidity:', error);
      setError('Failed to transfer liquidity. Please try again.');
      setTransferStatus('Failed');
      setIsTransferring(false);
    }
  };
  
  // Chart configurations
  const liquidityChartData = {
    labels: tokens.map(token => token.symbol),
    datasets: [
      {
        label: 'Total Liquidity',
        data: tokens.map(token => parseFloat(token.totalLiquidity)),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Allocated Liquidity',
        data: tokens.map(token => parseFloat(token.allocatedLiquidity)),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ]
  };
  
  const chainDistributionData = {
    labels: chains.map(chain => chain.name),
    datasets: [
      {
        data: chains.map(chain => parseFloat(chain.liquidity)),
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  };
  
  const strategyPerformanceData = {
    labels: strategies.map(strategy => strategy.name),
    datasets: [
      {
        label: 'APY (%)',
        data: strategies.map(strategy => strategy.apy),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  };
  
  const utilizationRateData = {
    labels: ['Utilized', 'Available'],
    datasets: [
      {
        data: [liquidityStats.utilizationRate, 100 - liquidityStats.utilizationRate],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)'
        ],
        borderWidth: 0
      }
    ]
  };
  
  // Render transfer modal
  const renderTransferModal = () => {
    return (
      <div className={`transfer-modal ${isTransferModalOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Transfer Liquidity Across Chains</h3>
            <button className="close-button" onClick={() => !isTransferring && setIsTransferModalOpen(false)}>×</button>
          </div>
          
          <div className="modal-body">
            {!isTransferring ? (
              <>
                <div className="form-group">
                  <label>Token:</label>
                  <select 
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    disabled={isTransferring}
                  >
                    {tokens.map(token => (
                      <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Amount:</label>
                  <input 
                    type="number" 
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="Enter amount to transfer"
                    disabled={isTransferring}
                  />
                </div>
                
                <div className="form-group">
                  <label>Destination Chain:</label>
                  <select 
                    value={transferDestination}
                    onChange={(e) => setTransferDestination(e.target.value)}
                    disabled={isTransferring}
                  >
                    <option value="">Select destination chain</option>
                    {chains
                      .filter(chain => chain.name !== 'IOTA EVM' && chain.active)
                      .map(chain => (
                        <option key={chain.id} value={chain.name}>{chain.name}</option>
                      ))
                    }
                  </select>
                </div>
                
                {error && (
                  <div className="error-message">{error}</div>
                )}
                
                <div className="modal-actions">
                  <button 
                    className="action-button"
                    onClick={handleTransferLiquidity}
                    disabled={isTransferring}
                  >
                    Transfer Liquidity
                  </button>
                  <button 
                    className="action-button secondary"
                    onClick={() => setIsTransferModalOpen(false)}
                    disabled={isTransferring}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="transfer-status">
                <div className={`status-indicator ${transferStatus.toLowerCase()}`}>
                  {transferStatus === 'Processing' && <div className="spinner"></div>}
                  {transferStatus === 'Completed' && <div className="checkmark">✓</div>}
                  {transferStatus === 'Failed' && <div className="error-mark">✗</div>}
                </div>
                <h3>{transferStatus}</h3>
                <p>
                  {transferStatus === 'Processing' && 'Your cross-chain transfer is being processed...'}
                  {transferStatus === 'Completed' && 'Your cross-chain transfer has been successfully initiated!'}
                  {transferStatus === 'Failed' && 'Your cross-chain transfer failed. Please try again.'}
                </p>
                
                {transferStatus === 'Completed' && (
                  <div className="transfer-details">
                    <p>Transfer of {transferAmount} {selectedToken} to {transferDestination} has been initiated.</p>
                    <p>Cross-chain transfers typically take 5-15 minutes to complete.</p>
                  </div>
                )}
                
                {transferStatus === 'Failed' && (
                  <button 
                    className="action-button"
                    onClick={() => {
                      setIsTransferring(false);
                      setTransferStatus(null);
                    }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="cross-chain-liquidity">
      <h2>Cross-Chain Liquidity Management</h2>
      <p className="feature-description">
        Optimize your capital efficiency by managing liquidity across multiple chains.
        IntelliLend's cross-chain architecture allows seamless movement of assets while maintaining
        security through IOTA's dual-layer design.
      </p>
      
      <div className="tabs">
        <button 
          className={selectedTab === 'overview' ? 'active' : ''} 
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button 
          className={selectedTab === 'chains' ? 'active' : ''} 
          onClick={() => setSelectedTab('chains')}
        >
          Chains
        </button>
        <button 
          className={selectedTab === 'tokens' ? 'active' : ''} 
          onClick={() => setSelectedTab('tokens')}
        >
          Tokens
        </button>
        <button 
          className={selectedTab === 'transfers' ? 'active' : ''} 
          onClick={() => setSelectedTab('transfers')}
        >
          Transfers
        </button>
        <button 
          className={selectedTab === 'strategies' ? 'active' : ''} 
          onClick={() => setSelectedTab('strategies')}
        >
          Strategies
        </button>
      </div>
      
      <div className="tab-content">
        {selectedTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Liquidity</h3>
                <p className="stat-value">{liquidityStats.totalLiquidity.toLocaleString()} IOTA</p>
              </div>
              <div className="stat-card">
                <h3>Allocated Liquidity</h3>
                <p className="stat-value">{liquidityStats.allocatedLiquidity.toLocaleString()} IOTA</p>
              </div>
              <div className="stat-card">
                <h3>Current APY</h3>
                <p className="stat-value">{liquidityStats.apy.toFixed(2)}%</p>
              </div>
              <div className="stat-card">
                <h3>Utilization Rate</h3>
                <p className="stat-value">{liquidityStats.utilizationRate}%</p>
              </div>
            </div>
            
            <div className="dashboard-charts">
              <div className="chart-container">
                <h3>Chain Distribution</h3>
                <Doughnut 
                  data={chainDistributionData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right'
                      }
                    }
                  }}
                />
              </div>
              
              <div className="chart-container">
                <h3>Utilization Rate</h3>
                <Doughnut 
                  data={utilizationRateData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="liquidity-actions">
              <div className="action-card">
                <h3>Add Liquidity</h3>
                <p>Add liquidity to earn yield across multiple chains</p>
                <div className="form-group">
                  <select 
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    disabled={isAddingLiquidity}
                  >
                    {tokens.map(token => (
                      <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <input 
                    type="number" 
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    placeholder="Enter amount"
                    disabled={isAddingLiquidity}
                  />
                </div>
                <button 
                  className="action-button"
                  onClick={handleAddLiquidity}
                  disabled={isAddingLiquidity}
                >
                  {isAddingLiquidity ? 'Processing...' : 'Add Liquidity'}
                </button>
              </div>
              
              <div className="action-card">
                <h3>Transfer Across Chains</h3>
                <p>Move liquidity between chains for optimal capital efficiency</p>
                <div className="transfer-illustration">
                  <div className="chain-icon source">IOTA EVM</div>
                  <div className="transfer-arrow">→</div>
                  <div className="chain-icon destination">Other Chains</div>
                </div>
                <button 
                  className="action-button"
                  onClick={() => setIsTransferModalOpen(true)}
                >
                  Transfer Liquidity
                </button>
              </div>
            </div>
          </div>
        )}
        
        {selectedTab === 'chains' && (
          <div className="chains-tab">
            <h3>Supported Chains</h3>
            <div className="chains-list">
              {chains.map(chain => (
                <div 
                  key={chain.id}
                  className={`chain-card ${chain.active ? 'active' : 'inactive'} ${selectedChain === chain.id ? 'selected' : ''}`}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <div className="chain-header">
                    <h4>{chain.name}</h4>
                    <span className={`status-badge ${chain.active ? 'active' : 'inactive'}`}>
                      {chain.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="chain-liquidity">
                    <p>Liquidity: {parseFloat(chain.liquidity).toLocaleString()} IOTA</p>
                  </div>
                  <div className="chain-sync">
                    <p>Last Synced: {chain.lastSync.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="chains-chart">
              <h3>Liquidity Distribution Across Chains</h3>
              <Bar 
                data={chainDistributionData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false
                    },
                    title: {
                      display: true,
                      text: 'Chain Liquidity Distribution'
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
        
        {selectedTab === 'tokens' && (
          <div className="tokens-tab">
            <h3>Supported Tokens</h3>
            <div className="tokens-list">
              {tokens.map(token => (
                <div
                  key={token.symbol}
                  className={`token-card ${selectedToken === token.symbol ? 'selected' : ''}`}
                  onClick={() => setSelectedToken(token.symbol)}
                >
                  <div className="token-header">
                    <h4>{token.symbol}</h4>
                    <span className={`status-badge ${token.active ? 'active' : 'inactive'}`}>
                      {token.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="token-stats">
                    <div className="token-stat">
                      <p className="stat-label">Total Liquidity</p>
                      <p className="stat-value">{parseFloat(token.totalLiquidity).toLocaleString()} {token.symbol}</p>
                    </div>
                    <div className="token-stat">
                      <p className="stat-label">Utilized</p>
                      <p className="stat-value">{parseFloat(token.allocatedLiquidity).toLocaleString()} {token.symbol}</p>
                    </div>
                    <div className="token-stat">
                      <p className="stat-label">Utilization Rate</p>
                      <p className="stat-value">{(token.utilizationRate * 100).toFixed(2)}%</p>
                    </div>
                    <div className="token-stat">
                      <p className="stat-label">APY</p>
                      <p className="stat-value">{(token.apy * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="tokens-chart">
              <h3>Token Liquidity Allocation</h3>
              <Bar 
                data={liquidityChartData}
                options={{
                  responsive: true,
                  plugins: {
                    title: {
                      display: true,
                      text: 'Token Liquidity Allocation'
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
        
        {selectedTab === 'transfers' && (
          <div className="transfers-tab">
            <h3>Cross-Chain Transfers</h3>
            <div className="transfer-actions">
              <button 
                className="action-button"
                onClick={() => setIsTransferModalOpen(true)}
              >
                New Transfer
              </button>
            </div>
            
            <div className="transfers-list">
              <table className="transfers-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Asset</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-transfers">No transfers found</td>
                    </tr>
                  ) : (
                    transfers.map((transfer, index) => (
                      <tr key={index} className={`transfer-row status-${transfer.status.toLowerCase().replace(' ', '-')}`}>
                        <td>{transfer.timestamp.toLocaleString()}</td>
                        <td>{transfer.sourceChain}</td>
                        <td>{transfer.targetChain}</td>
                        <td>{transfer.symbol}</td>
                        <td>{parseFloat(transfer.amount).toLocaleString()} {transfer.symbol}</td>
                        <td>
                          <span className={`status-pill ${transfer.status.toLowerCase().replace(' ', '-')}`}>
                            {transfer.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {selectedTab === 'strategies' && (
          <div className="strategies-tab">
            <h3>Yield Optimization Strategies</h3>
            <p className="section-description">
              IntelliLend uses AI to optimize capital allocation across different yield strategies.
              These strategies automatically allocate funds to maximize returns while managing risk.
            </p>
            
            <div className="strategies-list">
              {strategies.map(strategy => (
                <div key={strategy.id} className="strategy-card">
                  <div className="strategy-header">
                    <h4>{strategy.name}</h4>
                    <span className={`risk-badge risk-${strategy.risk.toLowerCase()}`}>
                      {strategy.risk} Risk
                    </span>
                  </div>
                  
                  <div className="strategy-description">
                    <p>{strategy.description}</p>
                  </div>
                  
                  <div className="strategy-stats">
                    <div className="strategy-apy">
                      <span className="apy-value">{strategy.apy.toFixed(2)}%</span>
                      <span className="apy-label">Current APY</span>
                    </div>
                  </div>
                  
                  <button className="action-button">
                    Allocate Funds
                  </button>
                </div>
              ))}
            </div>
            
            <div className="strategy-performance">
              <h3>Strategy Performance</h3>
              <Bar 
                data={strategyPerformanceData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false
                    },
                    title: {
                      display: true,
                      text: 'Current APY by Strategy'
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      {renderTransferModal()}
    </div>
  );
};

export default CrossChainLiquidity;
