/**
 * IntelliLend AI Helper
 * 
 * A client-side JavaScript library for interacting with the IntelliLend AI risk assessment model.
 * This library provides methods to fetch and process on-chain data, make predictions, 
 * and visualize risk factors in the frontend.
 */

class IntelliLendAI {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || '/api';
    this.cache = new Map();
    this.cacheExpiry = options.cacheExpiry || 5 * 60 * 1000; // 5 minutes default
    this.onChainDataProviders = options.onChainDataProviders || [];
    this.features = this.getFeatureDefinitions();
    this.explanationComponents = [];
  }

  /**
   * Get all feature definitions used by the model
   */
  getFeatureDefinitions() {
    // List of all features used by the model with metadata
    return {
      // Transaction history features
      transaction_count: {
        name: 'Transaction Count',
        description: 'Number of transactions in the wallet history',
        category: 'Transaction History',
        importance: 'medium',
        improvable: true,
        improvementTip: 'Regular activity shows stability, but avoid unusual spikes'
      },
      avg_transaction_value: {
        name: 'Average Transaction Value',
        description: 'Average value of transactions',
        category: 'Transaction History',
        importance: 'medium',
        improvable: false
      },
      transaction_frequency: {
        name: 'Transaction Frequency',
        description: 'How often transactions are made',
        category: 'Transaction History',
        importance: 'medium',
        improvable: true,
        improvementTip: 'Regular, consistent transaction patterns are favorable'
      },
      
      // Wallet characteristics
      wallet_age_days: {
        name: 'Wallet Age',
        description: 'Age of the wallet in days',
        category: 'Wallet Profile',
        importance: 'high',
        improvable: false
      },
      wallet_balance: {
        name: 'Wallet Balance',
        description: 'Current balance in the wallet',
        category: 'Wallet Profile',
        importance: 'high',
        improvable: true,
        improvementTip: 'Maintaining higher balances improves creditworthiness'
      },
      wallet_balance_volatility: {
        name: 'Balance Volatility',
        description: 'How much the wallet balance fluctuates',
        category: 'Wallet Profile',
        importance: 'high',
        improvable: true,
        improvementTip: 'More stable balances indicate financial stability'
      },
      
      // Lending history
      previous_loans_count: {
        name: 'Previous Loans',
        description: 'Number of previous loans taken',
        category: 'Lending History',
        importance: 'high',
        improvable: false
      },
      repayment_ratio: {
        name: 'Repayment Ratio',
        description: 'Ratio of loans repaid to loans taken',
        category: 'Lending History',
        importance: 'critical',
        improvable: true,
        improvementTip: 'Always repay loans on time to maintain a high ratio'
      },
      default_count: {
        name: 'Default Count',
        description: 'Number of times defaulted on loans',
        category: 'Lending History',
        importance: 'critical',
        improvable: false
      },
      
      // Collateral behavior
      collateral_diversity: {
        name: 'Collateral Diversity',
        description: 'Variety of assets used as collateral',
        category: 'Collateral',
        importance: 'high',
        improvable: true,
        improvementTip: 'Diversify your collateral across different asset types'
      },
      collateral_value_ratio: {
        name: 'Collateral to Loan Ratio',
        description: 'Value of collateral relative to loan amount',
        category: 'Collateral',
        importance: 'critical',
        improvable: true,
        improvementTip: 'Higher collateral ratios reduce risk and may lower interest rates'
      },
      
      // Cross-chain and protocol activity
      cross_chain_activity: {
        name: 'Cross-chain Activity',
        description: 'Activity across multiple blockchains',
        category: 'Network Activity',
        importance: 'low',
        improvable: false
      },
      lending_protocol_interactions: {
        name: 'DeFi Lending Interactions',
        description: 'Interactions with other DeFi lending protocols',
        category: 'Network Activity',
        importance: 'medium',
        improvable: true,
        improvementTip: 'Positive history with other lending protocols is beneficial'
      },
      
      // Market condition features
      market_volatility_correlation: {
        name: 'Market Volatility Correlation',
        description: 'How wallet activity correlates with market volatility',
        category: 'Market Behavior',
        importance: 'medium',
        improvable: true,
        improvementTip: 'Avoid large withdrawals during market downturns'
      },
      
      // Security and identity features
      identity_verification_level: {
        name: 'Identity Verification Level',
        description: 'Level of identity verification completed',
        category: 'Identity',
        importance: 'high',
        improvable: true,
        improvementTip: 'Complete higher levels of verification to reduce risk'
      }
    };
  }

  /**
   * Predict risk score for a wallet address
   * 
   * @param {string} address - Wallet address
   * @param {Object} options - Additional options for the prediction
   * @returns {Promise<Object>} Risk assessment results
   */
  async predictRisk(address, options = {}) {
    try {
      // Check cache first
      const cacheKey = `risk_${address}`;
      if (this.cache.has(cacheKey) && !options.forceRefresh) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
      }

      // Collect on-chain data
      const onChainData = await this.collectOnChainData(address);
      
      // Call API
      const response = await fetch(`${this.apiUrl}/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          onChainData,
          options
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('Error predicting risk:', error);
      throw error;
    }
  }

  /**
   * Get personalized recommendations for improving risk score
   * 
   * @param {string} address - Wallet address
   * @returns {Promise<Array>} List of recommendations
   */
  async getRecommendations(address) {
    try {
      const response = await fetch(`${this.apiUrl}/recommendations/${address}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Collect on-chain data from multiple sources
   * 
   * @param {string} address - Wallet address
   * @returns {Promise<Object>} Collected features
   */
  async collectOnChainData(address) {
    // Combine data from all providers
    const features = {};
    
    // Run all data providers in parallel
    const promises = this.onChainDataProviders.map(provider => 
      provider.getFeatures(address).catch(err => {
        console.warn(`Error from data provider ${provider.name}:`, err);
        return {}; // Return empty object if a provider fails
      })
    );
    
    const results = await Promise.all(promises);
    
    // Merge all results
    results.forEach(result => {
      Object.assign(features, result);
    });
    
    return features;
  }

  /**
   * Register a new data provider
   * 
   * @param {Object} provider - On-chain data provider
   */
  registerDataProvider(provider) {
    if (typeof provider.getFeatures !== 'function') {
      throw new Error('Data provider must implement getFeatures() method');
    }
    this.onChainDataProviders.push(provider);
  }

  /**
   * Generate a risk explanation component
   * 
   * @param {Object} riskData - Risk assessment data
   * @param {string} targetElement - ID of the target HTML element
   * @returns {Object} Component controller
   */
  createRiskExplanation(riskData, targetElement) {
    const container = document.getElementById(targetElement);
    if (!container) {
      throw new Error(`Target element not found: ${targetElement}`);
    }
    
    // Create explanation component
    const component = {
      riskData,
      targetElement,
      container,
      charts: [],
      
      render() {
        // Clear container
        container.innerHTML = '';
        
        // Create main structure
        const header = document.createElement('div');
        header.className = 'risk-explanation-header';
        
        const title = document.createElement('h3');
        title.textContent = 'Risk Assessment Explanation';
        header.appendChild(title);
        
        const score = document.createElement('div');
        score.className = 'risk-score';
        score.innerHTML = `<span class="score-value">${riskData.riskScore}</span><span class="score-label">${riskData.riskCategory}</span>`;
        header.appendChild(score);
        
        container.appendChild(header);
        
        // Create factors section
        const factorsSection = document.createElement('div');
        factorsSection.className = 'risk-factors-section';
        
        const factorsTitle = document.createElement('h4');
        factorsTitle.textContent = 'Top Risk Factors';
        factorsSection.appendChild(factorsTitle);
        
        const factorsList = document.createElement('ul');
        factorsList.className = 'factors-list';
        
        riskData.topFactors.forEach(factor => {
          const featureInfo = this.features[factor.Feature] || {
            name: factor.Feature,
            description: 'Feature importance',
            category: 'Other',
            importance: 'medium',
            improvable: false
          };
          
          const factorItem = document.createElement('li');
          factorItem.className = `factor-item importance-${featureInfo.importance}${featureInfo.improvable ? ' improvable' : ''}`;
          
          factorItem.innerHTML = `
            <span class="factor-name">${featureInfo.name}</span>
            <div class="factor-bar-container">
              <div class="factor-bar" style="width: ${factor.Importance * 100}%"></div>
            </div>
            <span class="factor-value">${(factor.Importance * 100).toFixed(1)}%</span>
            <div class="factor-description">${featureInfo.description}</div>
            ${featureInfo.improvable ? `<div class="improvement-tip">${featureInfo.improvementTip}</div>` : ''}
          `;
          
          factorsList.appendChild(factorItem);
        });
        
        factorsSection.appendChild(factorsList);
        container.appendChild(factorsSection);
        
        // Create recommendations section
        const recsSection = document.createElement('div');
        recsSection.className = 'recommendations-section';
        
        const recsTitle = document.createElement('h4');
        recsTitle.textContent = 'Personalized Recommendations';
        recsSection.appendChild(recsTitle);
        
        const recsList = document.createElement('div');
        recsList.className = 'recommendations-list';
        
        riskData.recommendations.forEach(rec => {
          const recItem = document.createElement('div');
          recItem.className = `recommendation-item impact-${rec.impact}`;
          
          recItem.innerHTML = `
            <h5 class="rec-title">${rec.title}</h5>
            <p class="rec-description">${rec.description}</p>
            <span class="impact-badge">${rec.impact} impact</span>
          `;
          
          recsList.appendChild(recItem);
        });
        
        recsSection.appendChild(recsList);
        container.appendChild(recsSection);
        
        return this;
      },
      
      addHistoricalChart(historyData) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'risk-history-chart';
        container.appendChild(chartContainer);
        
        // Here you would use a charting library like Chart.js
        // This is a placeholder for the actual chart creation
        chartContainer.innerHTML = '<p>Historical risk score chart would be rendered here</p>';
        
        return this;
      },
      
      update(newRiskData) {
        this.riskData = newRiskData;
        return this.render();
      }
    };
    
    // Store the component
    this.explanationComponents.push(component);
    
    // Render initially
    component.render();
    
    return component;
  }

  /**
   * Create a real-time risk monitoring dashboard
   * 
   * @param {string} address - Wallet address to monitor
   * @param {string} targetElement - ID of the target HTML element
   * @param {Object} options - Dashboard options
   * @returns {Object} Dashboard controller
   */
  createMonitoringDashboard(address, targetElement, options = {}) {
    const container = document.getElementById(targetElement);
    if (!container) {
      throw new Error(`Target element not found: ${targetElement}`);
    }
    
    const refreshInterval = options.refreshInterval || 60000; // 1 minute default
    
    // Create dashboard controller
    const dashboard = {
      address,
      container,
      options,
      timerId: null,
      latestData: null,
      
      async initialize() {
        // Initial data fetch
        try {
          this.latestData = await this.refreshData();
          this.render();
          
          // Set up periodic refresh
          this.timerId = setInterval(() => {
            this.refreshData().then(data => {
              this.latestData = data;
              this.render();
            }).catch(console.error);
          }, refreshInterval);
        } catch (error) {
          console.error('Error initializing dashboard:', error);
          container.innerHTML = `<div class="error-message">Error loading risk data: ${error.message}</div>`;
        }
        
        return this;
      },
      
      async refreshData() {
        const riskData = await this.predictRisk(address, { forceRefresh: true });
        return riskData;
      },
      
      render() {
        if (!this.latestData) return this;
        
        // Clear container
        container.innerHTML = '';
        
        // Create dashboard structure
        const header = document.createElement('div');
        header.className = 'dashboard-header';
        
        header.innerHTML = `
          <h2>Risk Monitoring Dashboard</h2>
          <div class="address-display">${address}</div>
          <div class="last-updated">Last updated: ${new Date().toLocaleString()}</div>
        `;
        
        container.appendChild(header);
        
        // Add risk score gauge
        const gaugeSection = document.createElement('div');
        gaugeSection.className = 'risk-gauge-section';
        
        // This would typically use a gauge visualization library
        gaugeSection.innerHTML = `
          <div class="risk-gauge">
            <svg viewBox="0 0 100 50">
              <path d="M10,50 A40,40 0 0,1 90,50" stroke="#eee" stroke-width="5" fill="none" />
              <path d="M10,50 A40,40 0 0,1 ${10 + 80 * (this.latestData.riskScore / 100)},${50 - Math.sin(Math.PI * (this.latestData.riskScore / 100)) * 40}" stroke="${this.getRiskColor(this.latestData.riskScore)}" stroke-width="5" fill="none" />
              <text x="50" y="30" text-anchor="middle" font-size="12">${this.latestData.riskScore}</text>
              <text x="50" y="45" text-anchor="middle" font-size="8">${this.latestData.riskCategory}</text>
            </svg>
          </div>
        `;
        
        container.appendChild(gaugeSection);
        
        // Add key metrics
        const metricsSection = document.createElement('div');
        metricsSection.className = 'key-metrics-section';
        
        metricsSection.innerHTML = `
          <h3>Key Risk Metrics</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-title">Interest Rate</div>
              <div class="metric-value">${this.latestData.interestRate || 'N/A'}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Health Factor</div>
              <div class="metric-value">${this.latestData.healthFactor?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Collateral Ratio</div>
              <div class="metric-value">${this.latestData.collateralRatio?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Max Borrow Power</div>
              <div class="metric-value">${this.latestData.maxBorrowPower?.toFixed(2) || 'N/A'} IOTA</div>
            </div>
          </div>
        `;
        
        container.appendChild(metricsSection);
        
        // Add early warning indicators if any
        if (this.latestData.warnings && this.latestData.warnings.length > 0) {
          const warningsSection = document.createElement('div');
          warningsSection.className = 'warnings-section';
          
          const warningsList = document.createElement('ul');
          warningsList.className = 'warnings-list';
          
          this.latestData.warnings.forEach(warning => {
            const warningItem = document.createElement('li');
            warningItem.className = `warning-item severity-${warning.severity}`;
            warningItem.textContent = warning.description;
            warningsList.appendChild(warningItem);
          });
          
          warningsSection.appendChild(warningsList);
          container.appendChild(warningsSection);
        }
        
        return this;
      },
      
      getRiskColor(score) {
        if (score < 30) return '#4CAF50'; // Green
        if (score < 60) return '#FFC107'; // Yellow/Orange
        return '#F44336'; // Red
      },
      
      dispose() {
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
      }
    };
    
    // Bind methods to dashboard object
    dashboard.refreshData = this.predictRisk.bind(this);
    
    // Initialize and return
    return dashboard.initialize();
  }

  /**
   * Process on-chain transaction data to extract features
   * 
   * @param {Array} transactions - List of transactions
   * @returns {Object} Extracted features
   */
  processTransactionData(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {};
    }
    
    // Sort transactions by timestamp
    const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate basic statistics
    const values = sortedTx.map(tx => parseFloat(tx.value) || 0);
    const count = transactions.length;
    const totalValue = values.reduce((sum, val) => sum + val, 0);
    const avgValue = totalValue / count;
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Calculate transaction frequency (transactions per day)
    const firstTx = sortedTx[0];
    const lastTx = sortedTx[sortedTx.length - 1];
    const daysDiff = (lastTx.timestamp - firstTx.timestamp) / (24 * 60 * 60 * 1000);
    const frequency = daysDiff > 0 ? count / daysDiff : 0;
    
    // Calculate incoming/outgoing ratio
    const incomingTx = sortedTx.filter(tx => tx.direction === 'in').length;
    const incomingRatio = count > 0 ? incomingTx / count : 0;
    
    // Calculate growth rate
    const growthPeriods = Math.min(5, Math.floor(count / 10)); // Use up to 5 periods
    const periodSize = Math.floor(count / growthPeriods);
    
    let growthRate = 0;
    if (growthPeriods > 1) {
      const periodTotals = [];
      for (let i = 0; i < growthPeriods; i++) {
        const start = i * periodSize;
        const end = (i + 1) * periodSize;
        const periodValue = sortedTx.slice(start, end).reduce((sum, tx) => sum + (parseFloat(tx.value) || 0), 0);
        periodTotals.push(periodValue);
      }
      
      // Calculate average growth between periods
      let totalGrowth = 0;
      for (let i = 1; i < periodTotals.length; i++) {
        const prevPeriod = periodTotals[i - 1];
        const currentPeriod = periodTotals[i];
        if (prevPeriod > 0) {
          totalGrowth += (currentPeriod - prevPeriod) / prevPeriod;
        }
      }
      growthRate = totalGrowth / (periodTotals.length - 1);
    }
    
    // Calculate regularity
    // This is a measure of how consistent the time between transactions is
    const timeDiffs = [];
    for (let i = 1; i < sortedTx.length; i++) {
      timeDiffs.push(sortedTx[i].timestamp - sortedTx[i - 1].timestamp);
    }
    
    let regularity = 0;
    if (timeDiffs.length > 0) {
      const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
      const variance = timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgTimeDiff, 2), 0) / timeDiffs.length;
      const stdDev = Math.sqrt(variance);
      
      // Normalize: higher values mean more regular (consistent) transaction timing
      regularity = avgTimeDiff > 0 ? 1 - Math.min(1, stdDev / avgTimeDiff) : 0;
    }
    
    return {
      transaction_count: count,
      avg_transaction_value: avgValue,
      max_transaction_value: maxValue,
      min_transaction_value: minValue,
      transaction_frequency: frequency,
      transaction_regularity: regularity,
      transaction_growth_rate: growthRate,
      incoming_tx_ratio: incomingRatio
    };
  }

  /**
   * Create a data provider from transaction history
   * 
   * @param {function} fetchTransactions - Function that returns transaction history
   * @returns {Object} Data provider object
   */
  createTransactionDataProvider(fetchTransactions) {
    return {
      name: 'TransactionDataProvider',
      getFeatures: async (address) => {
        const transactions = await fetchTransactions(address);
        return this.processTransactionData(transactions);
      }
    };
  }

  /**
   * Extract wallet characteristics features
   * 
   * @param {Object} walletData - Wallet data
   * @returns {Object} Extracted features
   */
  processWalletData(walletData) {
    if (!walletData) {
      return {};
    }
    
    // Calculate wallet age
    const creationTime = walletData.creationTime || 0;
    const walletAgeDays = creationTime ? Math.floor((Date.now() - creationTime) / (24 * 60 * 60 * 1000)) : 0;
    
    // Calculate balance metrics
    const currentBalance = parseFloat(walletData.balance) || 0;
    
    // Calculate balance volatility if history is available
    let balanceVolatility = 0;
    if (walletData.balanceHistory && walletData.balanceHistory.length > 1) {
      const balances = walletData.balanceHistory.map(entry => parseFloat(entry.balance) || 0);
      const avgBalance = balances.reduce((sum, bal) => sum + bal, 0) / balances.length;
      
      // Calculate variance
      const variance = balances.reduce((sum, bal) => sum + Math.pow(bal - avgBalance, 2), 0) / balances.length;
      
      // Normalize volatility
      balanceVolatility = avgBalance > 0 ? Math.sqrt(variance) / avgBalance : 0;
    }
    
    // Calculate balance utilization
    const totalAvailable = currentBalance + (parseFloat(walletData.borrowed) || 0);
    const utilizationRatio = totalAvailable > 0 ? (parseFloat(walletData.borrowed) || 0) / totalAvailable : 0;
    
    return {
      wallet_age_days: walletAgeDays,
      wallet_balance: currentBalance,
      wallet_balance_volatility: balanceVolatility,
      balance_utilization_ratio: utilizationRatio
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntelliLendAI;
} else if (typeof window !== 'undefined') {
  window.IntelliLendAI = IntelliLendAI;
}
