/**
 * React Development Server Runner
 * This script runs the React development server directly
 */
const { exec } = require('child_process');
const path = require('path');

console.log('\n===============================================');
console.log('IntelliLend React Development Server');
console.log('===============================================');
console.log('Starting React development server...');
console.log('This will run the actual React application');
console.log('===============================================\n');

// Change to the frontend directory and run npm start
const frontendDir = path.join(__dirname, 'frontend');
const command = process.platform === 'win32' 
  ? `cd "${frontendDir}" && npm start`
  : `cd "${frontendDir}" && npm start`;

const child = exec(command);

child.stdout.on('data', (data) => {
  console.log(data);
});

child.stderr.on('data', (data) => {
  console.error(data);
});

child.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
});
