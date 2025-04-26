/**
 * Enhanced IOTA Blockchain Service
 * 
 * Handles interactions with the IOTA network and its EVM layer
 * Enhanced with resilience features, caching, and comprehensive error handling
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const config = require('../../../config/iota-config');
