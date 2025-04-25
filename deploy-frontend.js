/**
 * Frontend Deployment Script for IntelliLend
 * 
 * This script focuses on building and deploying just the frontend component
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Global process object
let frontendProcess = null;

/**
 * Main deployment function
 */
async function deployFrontend() {
  console.log('===============================================');
  console.log('IntelliLend Frontend Deployment');
  console.log('===============================================');
  
  try {
    // 1. Install dependencies
    console.log('\n1. Installing frontend dependencies...');
    await installDependencies();
    
    // 2. Build frontend
    console.log('\n2. Building frontend...');
    await buildFrontend();
    
    // 3. Start frontend server
    console.log('\n3. Starting frontend server...');
    await startFrontendServer();
    
    console.log('\n===============================================');
    console.log('Frontend deployed successfully!');
    console.log('===============================================');
    console.log(`Frontend available at: http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    console.log('===============================================');
    console.log('\nPress Ctrl+C to stop the server and exit.');
    
  } catch (error) {
    console.error('Frontend deployment failed:', error);
    stopFrontendServer();
    process.exit(1);
  }
}

/**
 * Install frontend dependencies
 */
async function installDependencies() {
  try {
    console.log('Installing npm dependencies...');
    execSync('npm install', { 
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit' 
    });
    console.log('Dependencies installed successfully.');
  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
}

/**
 * Build frontend application
 */
async function buildFrontend() {
  try {
    console.log('Building frontend application...');
    execSync('npm run build', { 
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit' 
    });
    console.log('Frontend built successfully.');
  } catch (error) {
    console.error('Error building frontend:', error);
    throw error;
  }
}

/**
 * Start frontend server
 */
async function startFrontendServer() {
  try {
    console.log('Starting frontend server...');
    
    // Create build directory if it doesn't exist
    const buildDir = path.join(__dirname, 'frontend', 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
      
      // Create a simple placeholder index.html if the build failed
      const indexPath = path.join(buildDir, 'index.html');
      fs.writeFileSync(indexPath, `
        <!DOCTYPE html>
        <html>
        <head>
          <title>IntelliLend</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #1976d2; }
            p { color: #666; max-width: 600px; margin: 20px auto; }
            .button { background: #1976d2; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>IntelliLend</h1>
          <p>The frontend build process might have had issues. Please check the console for errors or use development mode with 'npm start'.</p>
          <a href="/dashboard" class="button">Try Dashboard Anyway</a>
        </body>
        </html>
      `);
    }
    
    // Start frontend server
    frontendProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit',
      detached: false
    });
    
    console.log('Frontend server started successfully.');
  } catch (error) {
    console.error('Error starting frontend server:', error);
    throw error;
  }
}

/**
 * Stop frontend server
 */
function stopFrontendServer() {
  if (frontendProcess) {
    console.log('\nStopping frontend server...');
    frontendProcess.kill();
    frontendProcess = null;
    console.log('Frontend server stopped.');
  }
}

// Handle cleanup on exit
process.on('exit', stopFrontendServer);
process.on('SIGINT', () => {
  stopFrontendServer();
  process.exit();
});

// Execute deployment
deployFrontend().catch(error => {
  console.error(error);
  stopFrontendServer();
  process.exit(1);
});
