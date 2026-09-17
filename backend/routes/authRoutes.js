const express = require('express');
const authController = require('../controllers/authController');
const { authenticateUser } = require('../middleware/auth');
const { requireBodyFields } = require('../middleware/validator');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', authLimiter, requireBodyFields(['email', 'password']), authController.login);
router.post('/register-hospital', registrationLimiter, requireBodyFields(['name', 'registrationNo', 'email']), authController.registerHospital);
router.post('/register-admin', registrationLimiter, requireBodyFields(['email', 'fullName']), authController.registerAdmin);
router.get('/me', authenticateUser, authController.getMe);
router.post('/logout', authenticateUser, authController.logout);

module.exports = router;

