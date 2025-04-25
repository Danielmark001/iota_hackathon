/**
 * Development server for the React frontend
 * This uses react-scripts start to run the development server with hot reloading
 */
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('===============================================');
console.log('IntelliLend Frontend Development Server');
console.log('===============================================');

console.log('Starting React development server...');

// Start the React development server
const reactProcess = spawn('npm', ['start'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    BROWSER: 'none', // Don't open browser automatically
    PORT: process.env.FRONTEND_PORT || 3000
  }
});

// Handle process exit
reactProcess.on('exit', (code) => {
  console.log(`React development server exited with code ${code}`);
  process.exit(code);
});

// Handle errors
reactProcess.on('error', (err) => {
  console.error('Failed to start React development server:', err);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nStopping React development server...');
  reactProcess.kill();
  process.exit();
});
