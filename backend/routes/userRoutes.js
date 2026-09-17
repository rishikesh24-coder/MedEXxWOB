const express = require('express');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

/**
 * GET /api/users/profile
 * Retrieves the current authenticated user's profile and linked hospital metadata.
 */
router.get('/profile', authenticateUser, (req, res) => {
  return successResponse(
    res,
    {
      user: req.user,
      hospital: req.hospital || null,
    },
    'User profile retrieved successfully'
  );
});

/**
 * GET /api/users/test-admin
 * Protected endpoint strictly verifying ADMIN authorization.
 */
router.get('/test-admin', authenticateUser, requireAdmin, (req, res) => {
  return successResponse(
    res,
    {
      authorized: true,
      role: req.user.role,
      user: req.user,
      message: 'Admin access verified successfully.',
    },
    'Admin privileges confirmed'
  );
});

module.exports = router;
