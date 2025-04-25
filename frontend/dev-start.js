/**
 * Development server launcher for IntelliLend frontend
 * This directly runs the React dev server without building
 */

const { exec } = require('child_process');
const path = require('path');

console.log('\n===============================================');
console.log('IntelliLend Frontend Development Server');
console.log('===============================================');
console.log('Starting React development server...');
console.log('This will bypass authentication and enable all routes');
console.log('===============================================\n');

// Change to the frontend directory and run npm start
const frontendDir = path.join(__dirname);
const command = 'cd ' + frontendDir + ' && npm start';

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
