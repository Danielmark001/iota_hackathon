/**
 * Simple script to start the frontend in development mode
 * This uses express to serve the frontend directly
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// For React Router, send all requests to index.html
app.get('*', (req, res) => {
  // Serve our dummy index.html
  const indexPath = path.join(__dirname, 'frontend', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Create a fallback HTML content if no index.html exists
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IntelliLend - AI-Powered DeFi Lending Platform</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          h1 span { color: #1976d2; }
          .card {
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            background-color: #f9f9f9;
          }
          .btn {
            display: inline-block;
            background-color: #1976d2;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            margin-right: 10px;
          }
        </style>
      </head>
      <body>
        <h1><span>Intelli</span>Lend</h1>
        <p>AI-Powered DeFi Lending Platform on IOTA</p>
        
        <div class="card">
          <h2>Development Mode</h2>
          <p>The full frontend is still being built or installed. You can access these demo pages:</p>
          <p>
            <a href="/dashboard" class="btn">Dashboard</a>
            <a href="/deposit" class="btn">Deposit</a>
            <a href="/borrow" class="btn">Borrow</a>
          </p>
        </div>
        
        <div class="card">
          <h2>Backend Status</h2>
          <p>The backend API should be running at: <code>http://localhost:${process.env.BACKEND_PORT || 3001}</code></p>
          <p>You can check its status at: <code>http://localhost:${process.env.BACKEND_PORT || 3001}/health</code></p>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
===============================================
IntelliLend Frontend Server
===============================================
Frontend server running on port ${PORT}
Open http://localhost:${PORT} in your browser
===============================================
  `);
});
