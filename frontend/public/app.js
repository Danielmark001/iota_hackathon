/**
 * IntelliLend Frontend Application
 * 
 * This script handles the frontend functionality for the IntelliLend DeFi platform.
 */

// Configuration
const config = {
    // Backend API URL
    apiUrl: 'http://localhost:3001',
    
    // Shimmer EVM RPC URL
    rpcUrl: 'https://evm.wasp.sc.iota.org',
    
    // Chain ID for Shimmer EVM testnet
    chainId: 1073, // This matches the IOTA Shimmer testnet
    
    // Contract addresses from .env
    contracts: {
        lendingPool: window.ENV?.LENDING_POOL_ADDRESS || '0x1000000000000000000000000000000000000000',
        zkVerifier: window.ENV?.ZK_VERIFIER_ADDRESS || '0x2000000000000000000000000000000000000000',
        zkBridge: window.ENV?.ZK_BRIDGE_ADDRESS || '0x3000000000000000000000000000000000000000'
    }
};

// Application state
const state = {
    connected: false,
    address: null,
    signer: null,
    provider: null,
    contracts: {},
    userData: null,
    marketData: null
};

// Initialize the application
async function initApp() {
    console.log('Initializing IntelliLend application...');
    
    // Load environment variables if available
    await loadEnvironment();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load market data
    await loadMarketData();
    
    // Check if user has already connected
    checkConnection();
    
    console.log('Application initialized');
}

// Load environment variables from the server
async function loadEnvironment() {
    try {
        const response = await fetch(`${config.apiUrl}/api/config`);
        if (response.ok) {
            const envVars = await response.json();
            window.ENV = envVars;
            
            // Update contract addresses
            if (envVars.LENDING_POOL_ADDRESS) {
                config.contracts.lendingPool = envVars.LENDING_POOL_ADDRESS;
            }
            if (envVars.ZK_VERIFIER_ADDRESS) {
                config.contracts.zkVerifier = envVars.ZK_VERIFIER_ADDRESS;
            }
            if (envVars.ZK_BRIDGE_ADDRESS) {
                config.contracts.zkBridge = envVars.ZK_BRIDGE_ADDRESS;
            }
            
            console.log('Environment variables loaded');
        }
    } catch (error) {
        console.warn('Could not load environment variables:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Connect wallet button
    document.querySelector('.connect-button').addEventListener('click', connectWallet);
    
    // Supply button
    const supplyButton = document.querySelector('.primary-button');
    if (supplyButton) {
        supplyButton.addEventListener('click', () => openActionModal('supply'));
    }
    
    // Borrow button
    const borrowButton = document.querySelector('.secondary-button');
    if (borrowButton) {
        borrowButton.addEventListener('click', () => openActionModal('borrow'));
    }
}

// Check if user is already connected
function checkConnection() {
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
}

// Connect to MetaMask wallet
async function connectWallet() {
    if (!window.ethereum) {
        alert('Please install MetaMask to use this application');
        return;
    }
    
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
            alert('No accounts found. Please create an account in MetaMask.');
            return;
        }
        
        // Set up ethers provider and signer
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = accounts[0];
        
        // Check if connected to the correct network
        const network = await provider.getNetwork();
        if (network.chainId !== config.chainId) {
            await switchNetwork();
        }
        
        // Update state
        state.connected = true;
        state.address = address;
        state.provider = provider;
        state.signer = signer;
        
        // Initialize contracts
        await initializeContracts();
        
        // Update UI
        updateWalletUI(address);
        
        // Load user data
        await loadUserData(address);
        
        console.log('Wallet connected:', address);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Error connecting wallet: ' + error.message);
    }
}

// Switch to Shimmer EVM network
async function switchNetwork() {
    try {
        // Try to switch to the Shimmer EVM network
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${config.chainId.toString(16)}` }]
        });
    } catch (error) {
        // If the network is not added yet, add it
        if (error.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${config.chainId.toString(16)}`,
                    chainName: 'Shimmer EVM Testnet',
                    nativeCurrency: {
                        name: 'Shimmer',
                        symbol: 'SMR',
                        decimals: 18
                    },
                    rpcUrls: [config.rpcUrl],
                    blockExplorerUrls: ['https://explorer.evm.testnet.shimmer.network/']
                }]
            });
        } else {
            throw error;
        }
    }
}

// Initialize contract instances
async function initializeContracts() {
    // Load contract ABIs
    const lendingPoolABI = await fetchABI('LendingPool');
    
    // Create contract instances
    state.contracts.lendingPool = new ethers.Contract(
        config.contracts.lendingPool,
        lendingPoolABI,
        state.signer
    );
    
    console.log('Contracts initialized');
}

// Fetch contract ABI
async function fetchABI(contractName) {
    try {
        const response = await fetch(`${config.apiUrl}/api/abi/${contractName}`);
        if (response.ok) {
            return await response.json();
        }
        
        // Fallback ABIs if server doesn't provide them
        if (contractName === 'LendingPool') {
            return [
                "function deposits(address user) view returns (uint256)",
                "function borrows(address user) view returns (uint256)",
                "function collaterals(address user) view returns (uint256)",
                "function riskScores(address user) view returns (uint256)",
                "function deposit(uint256 amount)",
                "function borrow(uint256 amount)"
            ];
        }
        
        throw new Error(`Could not fetch ABI for ${contractName}`);
    } catch (error) {
        console.error(`Error fetching ABI for ${contractName}:`, error);
        throw error;
    }
}

// Load user data from backend and contracts
async function loadUserData(address) {
    try {
        // Show loading state
        const userPositionSection = document.querySelector('.card:nth-child(2)');
        if (userPositionSection) {
            userPositionSection.innerHTML = '<h2>Your Position</h2><p>Loading your data...</p>';
        }
        
        // Fetch user data from backend
        const response = await fetch(`${config.apiUrl}/api/user/${address}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const userData = await response.json();
        state.userData = userData;
        
        // Update UI with user data
        updateUserDataUI(userData);
        
        console.log('User data loaded:', userData);
    } catch (error) {
        console.error('Error loading user data:', error);
        
        // Show error in UI
        const userPositionSection = document.querySelector('.card:nth-child(2)');
        if (userPositionSection) {
            userPositionSection.innerHTML = `
                <h2>Your Position</h2>
                <p>Error loading your data. Please try again later.</p>
                <button class="action-button" onclick="loadUserData('${address}')">Retry</button>
            `;
        }
    }
}

// Load market data from backend
async function loadMarketData() {
    try {
        // Show loading state
        const marketSection = document.querySelector('.card:first-child');
        if (marketSection) {
            marketSection.innerHTML = '<h2>Market Overview</h2><p>Loading market data...</p>';
        }
        
        // Fetch market data from backend
        const response = await fetch(`${config.apiUrl}/api/market`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const marketData = await response.json();
        state.marketData = marketData;
        
        // Update UI with market data
        updateMarketDataUI(marketData);
        
        console.log('Market data loaded:', marketData);
    } catch (error) {
        console.error('Error loading market data:', error);
        
        // Show error in UI
        const marketSection = document.querySelector('.card:first-child');
        if (marketSection) {
            marketSection.innerHTML = `
                <h2>Market Overview</h2>
                <p>Error loading market data. Please try again later.</p>
                <button class="action-button" onclick="loadMarketData()">Retry</button>
            `;
        }
    }
}

// Update wallet UI
function updateWalletUI(address) {
    // Update connect button
    const connectButton = document.querySelector('.connect-button');
    if (connectButton) {
        connectButton.textContent = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    
    // Show action buttons
    const actionButtons = document.querySelectorAll('.action-button');
    actionButtons.forEach(button => {
        button.disabled = false;
    });
}

// Update user data UI
function updateUserDataUI(userData) {
    const userPositionSection = document.querySelector('.card:nth-child(2)');
    if (!userPositionSection) return;
    
    userPositionSection.innerHTML = `
        <h2>Your Position</h2>
        <div class="grid">
            <div class="stat-card">
                <div>Your Deposits</div>
                <div class="stat-value primary">$${userData.deposits.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <div>Your Borrows</div>
                <div class="stat-value secondary">$${userData.borrows.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <div>Your Collateral</div>
                <div class="stat-value success">$${userData.collateral.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <div>Risk Score</div>
                <div class="stat-value info">${userData.riskScore}/100</div>
            </div>
            <div class="stat-card">
                <div>Interest Rate</div>
                <div class="stat-value warning">${userData.interestRate.toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div>Health Factor</div>
                <div class="stat-value ${userData.healthFactor >= 1.5 ? 'success' : 'error'}">${userData.healthFactor.toFixed(2)}</div>
            </div>
        </div>
    `;
}

// Update market data UI
function updateMarketDataUI(marketData) {
    const marketSection = document.querySelector('.card:first-child');
    if (!marketSection) return;
    
    marketSection.innerHTML = `
        <h2>Market Overview</h2>
        <div class="grid">
            <div class="stat-card">
                <div>Total Deposits</div>
                <div class="stat-value primary">$${marketData.totalDeposits.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div>Total Borrows</div>
                <div class="stat-value secondary">$${marketData.totalBorrows.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div>Total Collateral</div>
                <div class="stat-value success">$${marketData.totalCollateral.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div>Utilization Rate</div>
                <div class="stat-value info">${marketData.utilizationRate}%</div>
            </div>
        </div>
    `;
}

// Open modal for supply or borrow action
function openActionModal(action) {
    if (!state.connected) {
        alert('Please connect your wallet first');
        return;
    }
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('action-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'action-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    // Set modal content based on action
    const title = action === 'supply' ? 'Supply Assets' : 'Borrow Assets';
    const buttonClass = action === 'supply' ? 'primary-button' : 'secondary-button';
    const buttonText = action === 'supply' ? 'Supply' : 'Borrow';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>${title}</h2>
            <div class="form-group">
                <label for="amount">Amount</label>
                <input type="number" id="amount" placeholder="Enter amount" min="0" step="0.01">
            </div>
            ${action === 'borrow' ? `
                <div class="info-box">
                    <p>Available to borrow: $${calculateAvailableToBorrow().toFixed(2)}</p>
                    <p>Health factor after: <span id="health-after">-</span></p>
                </div>
            ` : ''}
            <button class="action-button ${buttonClass}" id="confirm-${action}">${buttonText}</button>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'block';
    
    // Set up event listeners
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById(`confirm-${action}`).addEventListener('click', () => {
        const amount = document.getElementById('amount').value;
        if (action === 'supply') {
            supplyAssets(amount);
        } else {
            borrowAssets(amount);
        }
    });
    
    // Update health factor calculation on input change for borrow
    if (action === 'borrow') {
        document.getElementById('amount').addEventListener('input', updateHealthFactorCalculation);
    }
}

// Calculate available to borrow based on collateral and current borrows
function calculateAvailableToBorrow() {
    if (!state.userData) return 0;
    
    const collateral = state.userData.collateral;
    const borrows = state.userData.borrows;
    const ltv = 0.75; // Loan to value ratio (75%)
    
    return Math.max(0, (collateral * ltv) - borrows);
}

// Update health factor calculation in the borrow modal
function updateHealthFactorCalculation() {
    if (!state.userData) return;
    
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const collateral = state.userData.collateral;
    const currentBorrows = state.userData.borrows;
    const newBorrows = currentBorrows + amount;
    
    // If no borrows, health factor is infinite
    if (newBorrows <= 0) {
        document.getElementById('health-after').textContent = '∞';
        document.getElementById('health-after').className = 'success';
        return;
    }
    
    // Calculate new health factor
    const liquidationThreshold = 0.83; // 83%
    const newHealthFactor = (collateral * liquidationThreshold) / newBorrows;
    
    // Update UI
    const healthAfterElement = document.getElementById('health-after');
    healthAfterElement.textContent = newHealthFactor.toFixed(2);
    
    // Set color based on health factor
    if (newHealthFactor >= 1.5) {
        healthAfterElement.className = 'success';
    } else if (newHealthFactor >= 1.1) {
        healthAfterElement.className = 'warning';
    } else {
        healthAfterElement.className = 'error';
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('action-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Supply assets to the lending pool
async function supplyAssets(amount) {
    if (!state.connected || !state.contracts.lendingPool) {
        alert('Wallet not connected or contracts not initialized');
        return;
    }
    
    try {
        const amountWei = ethers.utils.parseEther(amount);
        
        // Call deposit function on the lending pool contract
        const tx = await state.contracts.lendingPool.deposit(amountWei);
        
        // Show pending transaction
        showNotification('Transaction pending...', 'info');
        
        // Wait for transaction to be mined
        await tx.wait();
        
        // Show success notification
        showNotification(`Successfully supplied ${amount} SMR`, 'success');
        
        // Close modal
        closeModal();
        
        // Reload user data
        await loadUserData(state.address);
    } catch (error) {
        console.error('Error supplying assets:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Borrow assets from the lending pool
async function borrowAssets(amount) {
    if (!state.connected || !state.contracts.lendingPool) {
        alert('Wallet not connected or contracts not initialized');
        return;
    }
    
    try {
        const amountWei = ethers.utils.parseEther(amount);
        
        // Call borrow function on the lending pool contract
        const tx = await state.contracts.lendingPool.borrow(amountWei);
        
        // Show pending transaction
        showNotification('Transaction pending...', 'info');
        
        // Wait for transaction to be mined
        await tx.wait();
        
        // Show success notification
        showNotification(`Successfully borrowed ${amount} SMR`, 'success');
        
        // Close modal
        closeModal();
        
        // Reload user data
        await loadUserData(state.address);
    } catch (error) {
        console.error('Error borrowing assets:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set notification content and type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide notification after 5 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Initialize the application when the page is loaded
window.addEventListener('DOMContentLoaded', initApp);
