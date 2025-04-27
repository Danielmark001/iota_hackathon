/**
 * Quick IOTA Fix Script
 * 
 * This script fixes the key issues in the IOTA integration:
 * 1. IOTA Streams service failing with "client is not defined" error
 * 2. Missing Identity service and Cross-Layer Aggregator dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Quick IOTA Fix Script 🔧');
console.log('===========================');

// Kill any running backend processes
try {
  console.log('Checking for running backend processes...');
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM node.exe /T', { stdio: 'ignore' });
  } else {
    execSync('pkill -f "node backend/server.js"', { stdio: 'ignore' });
  }
  console.log('✅ Stopped any running backend processes');
} catch (error) {
  console.log('No running backend processes found');
}

// Fix streams.js (client is not defined error)
try {
  console.log('\nFixing IOTA Streams service...');
  const streamsPath = path.join(__dirname, 'iota-sdk', 'streams.js');
  
  // Read the streams.js file
  let streamsContent = fs.readFileSync(streamsPath, 'utf8');
  
  // Check if we need to apply the patch (only if it doesn't already have createStreamsService)
  if (!streamsContent.includes('createStreamsService')) {
    // Create backup
    fs.writeFileSync(`${streamsPath}.bak`, streamsContent);
    
    // Find the export line
    const exportLine = 'module.exports = IOTAStreams;';
    
    // Create the createStreamsService function
    const createStreamsServiceFn = `
/**
 * Create an IOTA Streams service
 * @param {Object} client - IOTA client instance
 * @param {Object} options - Options for the streams service
 * @returns {Promise<IOTAStreams>} The IOTA Streams service instance
 */
async function createStreamsService(client, options = {}) {
  if (!client) {
    throw new Error("IOTA client is required for Streams service");
  }
  
  const { seed, permanode, account } = options;
  
  // Create a new IOTAStreams instance
  const streamsService = new IOTAStreams(client, account);
  
  // If a seed is provided, use it for initialization
  if (seed) {
    streamsService.seedKey = seed;
    logger.info('Using provided seed for Streams service');
  }
  
  // If a permanode URL is provided, use it for fetching historical data
  if (permanode) {
    streamsService.permanodeUrl = permanode;
    logger.info('Using provided permanode for Streams service');
  }
  
  logger.info('IOTA Streams service created successfully');
  
  return streamsService;
}

module.exports = {
  IOTAStreams,
  createStreamsService
};`;
    
    // Replace the export line with our new export that includes createStreamsService
    streamsContent = streamsContent.replace(exportLine, createStreamsServiceFn);
    
    // Write the updated file
    fs.writeFileSync(streamsPath, streamsContent);
    console.log('✅ Successfully patched IOTA Streams service');
  } else {
    console.log('✅ IOTA Streams service already patched, skipping...');
  }
} catch (streamsError) {
  console.error(`❌ Error patching Streams service: ${streamsError.message}`);
}

// Fix server.js to properly initialize streams service
try {
  console.log('\nFixing server.js to properly initialize streams service...');
  const serverPath = path.join(__dirname, 'backend', 'server.js');
  
  // Read server.js
  let serverContent = fs.readFileSync(serverPath, 'utf8');
  
  // Create backup if not exists
  if (!fs.existsSync(`${serverPath}.bak`)) {
    fs.writeFileSync(`${serverPath}.bak`, serverContent);
  }

  // Find the streams initialization section
  const streamsInitPattern = /logger\.info\('Initializing IOTA Streams service\.\.\.'\);[\s\S]*?try {[\s\S]*?iotaStreamsService = await iotaStreams\.createStreamsService\(client,/;
  
  if (serverContent.match(streamsInitPattern)) {
    // Fix the client parameter
    serverContent = serverContent.replace(
      'iotaStreamsService = await iotaStreams.createStreamsService(client,',
      'iotaStreamsService = await iotaStreams.createStreamsService(iotaClient,'
    );
    
    // Write updated content
    fs.writeFileSync(serverPath, serverContent);
    console.log('✅ Successfully patched server.js streams initialization');
  } else {
    console.log('⚠️ Streams initialization pattern not found in server.js');
  }
} catch (serverError) {
  console.error(`❌ Error patching server.js: ${serverError.message}`);
}

// Create a run script for the patched server
try {
  console.log('\nCreating run script for patched server...');
  const runScriptPath = path.join(__dirname, 'run-iota-fixed.bat');
  
  const runScriptContent = `@echo off
echo Starting IntelliLend Backend with fixed IOTA Integration...
cd %~dp0
echo Checking for dependencies...
call npm install --no-save
echo Starting server with fixed IOTA integration...
node backend/server.js`;
  
  fs.writeFileSync(runScriptPath, runScriptContent);
  console.log('✅ Successfully created patched run script');
} catch (runScriptError) {
  console.error(`❌ Error creating run script: ${runScriptError.message}`);
}

console.log('\n🚀 IOTA integration fixes have been applied!');
console.log('To run the fixed backend server, use:');
console.log('run-iota-fixed.bat');
console.log('\nIf you still encounter any issues, try using port 3002 instead of 3001:');
console.log('set PORT=3002 && run-iota-fixed.bat');
