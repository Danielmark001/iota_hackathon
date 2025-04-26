/**
 * Subprocess Utility
 * 
 * This module provides utility functions for spawning and managing child processes.
 */

const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Execute a command in a subprocess and return the result
 * @param {string} command - Command to run
 * @param {Array} args - Command arguments
 * @param {Object} options - Process options
 * @returns {Promise<Object>} Output from the process
 */
function subprocess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        // Default options
        const defaultOptions = {
            stdio: 'pipe',
            timeout: 60000, // 1 minute timeout
            encoding: 'utf8',
            detached: false
        };
        
        // Merge options
        const mergedOptions = {
            ...defaultOptions,
            ...options
        };
        
        // Start process
        const proc = spawn(command, args, mergedOptions);
        
        // Set timeout if specified
        let timeoutId;
        if (mergedOptions.timeout && mergedOptions.timeout > 0) {
            timeoutId = setTimeout(() => {
                logger.warn(`Process ${command} timed out after ${mergedOptions.timeout}ms`);
                
                // Kill the process
                if (mergedOptions.detached) {
                    try {
                        process.kill(-proc.pid, 'SIGTERM');
                    } catch (e) {
                        // Ignore errors
                    }
                } else {
                    proc.kill('SIGTERM');
                }
                
                reject(new Error(`Process timed out after ${mergedOptions.timeout}ms`));
            }, mergedOptions.timeout);
        }
        
        // Collect output if stdio is pipe
        let stdout = '';
        let stderr = '';
        
        if (proc.stdout) {
            proc.stdout.setEncoding(mergedOptions.encoding);
            proc.stdout.on('data', (data) => {
                stdout += data;
                
                // Log output if verbose
                if (mergedOptions.verbose) {
                    logger.debug(`[${command}] stdout: ${data}`);
                }
            });
        }
        
        if (proc.stderr) {
            proc.stderr.setEncoding(mergedOptions.encoding);
            proc.stderr.on('data', (data) => {
                stderr += data;
                
                // Log errors
                if (mergedOptions.verbose) {
                    logger.debug(`[${command}] stderr: ${data}`);
                }
            });
        }
        
        // Handle process exit
        proc.on('exit', (code, signal) => {
            // Clear timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            if (code === 0) {
                resolve({ stdout, stderr, code });
            } else {
                reject(new Error(`Process exited with code ${code} and signal ${signal}\nstderr: ${stderr}`));
            }
        });
        
        // Handle process error
        proc.on('error', (err) => {
            // Clear timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            reject(new Error(`Failed to start process: ${err.message}`));
        });
        
        // If detached, just return the process
        if (mergedOptions.detached) {
            proc.unref();
            resolve(proc);
        }
    });
}

module.exports = {
    subprocess
};
