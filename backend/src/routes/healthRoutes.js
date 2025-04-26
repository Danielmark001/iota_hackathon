/**
 * Health Routes
 * 
 * API routes for health checks.
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// GET /health - Get API health status
router.get('/', healthController.getHealth);

module.exports = router;
