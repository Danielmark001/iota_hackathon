/**
 * Development server for IntelliLend frontend
 * This script adds development overrides for authentication and wallet connection
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;

// Serve static files from frontend/build
app.use(express.static(path.join(__dirname, 'frontend/build'), {
  index: false // Don't serve index.html automatically
}));

// Inject our dev-mode script for easy development
app.get('*', (req, res) => {
  // Read the original index.html
  const indexPath = path.join(__dirname, 'frontend/build', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading index.html:', err);
      return res.status(500).send('Error loading application');
    }

    // Inject our dev-mode script
    const modifiedHtml = data.replace(
      '</head>',
      '<script src="/dev-mode.js"></script></head>'
    );

    res.send(modifiedHtml);
  });
});

// Create the dev-mode.js script in the build directory
const createDevModeScript = () => {
  const devModeScriptPath = path.join(__dirname, 'frontend/build', 'dev-mode.js');
  const devModeScript = `
// Development mode override script
console.log('🛠️ DEVELOPMENT MODE ENABLED');

// Override authentication globally for development
window.DEV_MODE = {
  isAuthenticated: true,
  bypassAuth: true,
  mockAccount: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
};

// Override the authentication hooks
const originalUseAuth = window.useAuth;
if (typeof React !== 'undefined') {
  // Mock implementation of useAuth
  window.useAuth = function() {
    return {
      isAuthenticated: true,
      isInitializing: false,
      userProfile: {
        address: window.DEV_MODE.mockAccount,
        deposits: 1500,
        borrows: 800,
        collateral: 2000,
        riskScore: 45,
        interestRate: 7.5,
        healthFactor: 1.8,
        identityVerified: false
      },
      login: async () => true,
      logout: () => console.log('DEV MODE: Logout called (staying authenticated)')
    };
  };
  
  // Ensure protected routes render
  const originalProtectedRoute = window.ProtectedRoute;
  window.ProtectedRoute = function({ children }) {
    return children;
  };
}

console.log('✅ Authentication bypassed');
console.log('✅ Mock wallet connected:', window.DEV_MODE.mockAccount);
  `;

  fs.writeFileSync(devModeScriptPath, devModeScript);
  console.log('Created dev-mode.js script in build directory');
};

// Create the dev-mode script before starting the server
try {
  createDevModeScript();
} catch (error) {
  console.error('Error creating dev-mode script:', error);
}

// Start the server
app.listen(PORT, () => {
  console.log('\n===============================================');
  console.log('IntelliLend Frontend Server (DEVELOPMENT MODE)');
  console.log('===============================================');
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log('Authentication is bypassed for development');
  console.log('===============================================\n');
});
