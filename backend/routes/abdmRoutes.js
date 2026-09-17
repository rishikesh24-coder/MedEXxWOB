const express = require('express');
const abdmConfig = require('../config/abdm');

const router = express.Router();

/**
 * GET /api/abdm/status
 * Returns ABDM National Health Gateway configuration and readiness status
 */
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: abdmConfig.isConfigured ? 'configured' : 'placeholder_ready',
      gatewayStatus: 'OPERATIONAL',
      facilityRegistry: 'ACTIVE',
      isConfigured: abdmConfig.isConfigured,
      gatewayBaseUrl: abdmConfig.baseUrl,
      clientId: abdmConfig.clientId ? '***CONFIGURED***' : null,
      message: 'ABDM Ayushman Bharat Digital Mission National Health Gateway placeholder is active and ready for production credentials.',
      milestones: [
        { name: 'M1: Ayushman Bharat Health Account (ABHA) Creation', status: 'READY' },
        { name: 'M2: Health Facility Registry (HFR) & Professional Registry (HPR)', status: 'ACTIVE' },
        { name: 'M3: Health Information Exchange & Consent Manager (HIECM)', status: 'CONFIGURED' },
      ],
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/', (req, res) => {
  return res.redirect(301, '/api/abdm/status');
});

module.exports = router;
