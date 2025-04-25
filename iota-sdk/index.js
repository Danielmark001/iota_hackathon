/**
 * IOTA SDK Integration
 * 
 * This file exports the IOTA SDK integration components.
 */

const config = require('./config');
const client = require('./client');
const wallet = require('./wallet');

module.exports = {
  config,
  client,
  wallet
};
