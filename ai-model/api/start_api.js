/**
 * Start AI Risk Assessment API Server
 * 
 * This script starts the Python AI API server for risk assessment.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configure logging
const logFile = path.join(__dirname, 'ai_api.log');
let logStream = fs.createWriteStream(logFile, { flags: 'a' });

console.log('Starting AI Risk Assessment API Server...');

// Check for Python environment
const pythonPath = process.env.PYTHON_PATH || 'python';
const apiScript = path.join(__dirname, 'run_api.py');

// Check if script exists
if (!fs.existsSync(apiScript)) {
    console.error(`API script not found: ${apiScript}`);
    process.exit(1);
}

// Set environment variables
const env = { ...process.env };
env.PORT = process.env.AI_API_PORT || '5000';
env.HOST = process.env.AI_API_HOST || '0.0.0.0';
env.DEBUG = process.env.AI_API_DEBUG || 'false';

// Start the Python API server
const apiProcess = spawn(pythonPath, [apiScript], {
    env,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
});

// Log process information
console.log(`AI API Server started with PID: ${apiProcess.pid}`);
console.log(`API will be available at: http://localhost:${env.PORT}`);

// Handle output
apiProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[AI API] ${output}`);
    logStream.write(`[${new Date().toISOString()}] [INFO] ${output}\n`);
});

apiProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    console.error(`[AI API ERROR] ${output}`);
    logStream.write(`[${new Date().toISOString()}] [ERROR] ${output}\n`);
});

// Handle process exit
apiProcess.on('close', (code) => {
    console.log(`AI API Server exited with code ${code}`);
    logStream.end();
});

// Handle errors
apiProcess.on('error', (err) => {
    console.error(`Failed to start AI API Server: ${err.message}`);
    logStream.write(`[${new Date().toISOString()}] [FATAL] Failed to start: ${err.message}\n`);
    logStream.end();
    process.exit(1);
});

// Handle Node.js process exit
process.on('exit', () => {
    console.log('Stopping AI API Server...');
    
    if (apiProcess && !apiProcess.killed) {
        // Kill the API process 
        apiProcess.kill();
    }
    
    if (logStream) {
        logStream.end();
    }
});

// Handle signals
process.on('SIGINT', () => {
    console.log('Received SIGINT signal. Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal. Shutting down...');
    process.exit(0);
});
