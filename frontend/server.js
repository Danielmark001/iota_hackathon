/**
 * Simple Express server for serving the React frontend
 */
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// Respond to all GET requests not handled by static files with the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
