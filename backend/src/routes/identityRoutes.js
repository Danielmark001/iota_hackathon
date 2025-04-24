/**
 * Privacy-Preserving Identity API Routes
 */

const express = require('express');
const identityController = require('../controllers/identityController');
const router = express.Router();

// Identity verification routes
router.get('/status/:address', identityController.checkIdentityStatus);
router.post('/register/:address', identityController.registerIdentity);
router.post('/generate-proof/:address', identityController.generateZkProof);
router.post('/verify/:address', identityController.verifyIdentity);
router.get('/credit-profile/:address', identityController.getCreditProfile);

module.exports = router;
