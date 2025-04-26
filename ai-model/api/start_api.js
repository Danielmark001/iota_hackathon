/**
 * Start the AI Risk Assessment API
 * 
 * This script starts the Flask API server that exposes the AI risk assessment models.
 * It handles process management, logging, and automatic restarts.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuration
const API_PORT = process.env.AI_API_PORT || 5000;
const LOG_FILE = path.join(__dirname, 'ai_api.log');
const MAX_RESTARTS = 5;
let restartCount = 0;

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Log startup
console.log(`Starting AI Risk Assessment API on port ${API_PORT}...`);
console.log(`Logs will be written to ${LOG_FILE}`);

// Start API process
function startAPI() {
    // Create process with environment variables
    const apiProcess = spawn('python', [path.join(__dirname, 'app.py')], {
        env: {
            ...process.env,
            AI_API_PORT: API_PORT,
            PYTHONUNBUFFERED: '1' // Ensure Python output is unbuffered
        }
    });
    
    // Log process ID
    console.log(`API process started with PID: ${apiProcess.pid}`);
    
    // Connect to stdout
    apiProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[API] ${output}`);
        
        // Append to log file
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${output}\n`);
    });
    
    // Connect to stderr
    apiProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        console.error(`[API ERROR] ${output}`);
        
        // Append to log file
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ERROR: ${output}\n`);
    });
    
    // Handle process exit
    apiProcess.on('exit', (code, signal) => {
        console.log(`API process exited with code ${code} and signal ${signal}`);
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Process exited with code ${code} and signal ${signal}\n`);
        
        // Restart if exit wasn't clean and we haven't exceeded restart limit
        if (code !== 0 && restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(`Restarting API (attempt ${restartCount}/${MAX_RESTARTS})...`);
            fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Restarting (attempt ${restartCount}/${MAX_RESTARTS})...\n`);
            
            // Wait before restarting to avoid rapid restart loops
            setTimeout(() => {
                startAPI();
            }, 3000);
        } else if (restartCount >= MAX_RESTARTS) {
            console.error(`Maximum restart attempts (${MAX_RESTARTS}) reached. Please check the logs and restart manually.`);
            fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Maximum restart attempts reached. Exiting.\n`);
            process.exit(1);
        }
    });
    
    // Handle process errors
    apiProcess.on('error', (err) => {
        console.error(`Failed to start API process: ${err.message}`);
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Process start error: ${err.message}\n`);
        
        if (restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(`Attempting restart (${restartCount}/${MAX_RESTARTS})...`);
            setTimeout(() => {
                startAPI();
            }, 3000);
        } else {
            console.error(`Maximum restart attempts reached. Please check the logs and restart manually.`);
            process.exit(1);
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('Received SIGINT signal. Shutting down API...');
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Received SIGINT signal. Shutting down...\n`);
        
        // Kill the API process
        apiProcess.kill('SIGINT');
        
        // Exit after a timeout in case the process doesn't exit cleanly
        setTimeout(() => {
            console.log('Exiting...');
            process.exit(0);
        }, 5000);
    });
    
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM signal. Shutting down API...');
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] Received SIGTERM signal. Shutting down...\n`);
        
        // Kill the API process
        apiProcess.kill('SIGTERM');
        
        // Exit after a timeout in case the process doesn't exit cleanly
        setTimeout(() => {
            console.log('Exiting...');
            process.exit(0);
        }, 5000);
    });
}

// Start the API
startAPI();
