const express = require('express');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const hospitalRoutes = require('./hospitalRoutes');
const adminRoutes = require('./adminRoutes');
const verificationRoutes = require('./verificationRoutes');
const documentRoutes = require('./documentRoutes');
const medicineRoutes = require('./medicineRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const marketplaceRoutes = require('./marketplaceRoutes');
const requestRoutes = require('./requestRoutes');
const refundRoutes = require('./refundRoutes');
const paymentRoutes = require('./paymentRoutes');
const alertRoutes = require('./alertRoutes');
const notificationRoutes = require('./notificationRoutes');
const auditRoutes = require('./auditRoutes');
const tradeRoutes = require('./tradeRoutes');
const transferRoutes = require('./transferRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const abdmRoutes = require('./abdmRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/admin', adminRoutes);
router.use('/hospital-verification', verificationRoutes);
router.use('/documents', documentRoutes);
router.use('/medicines', medicineRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/requests', requestRoutes);
router.use('/refunds', refundRoutes);
router.use('/payments', paymentRoutes);
router.use('/trades', tradeRoutes);
router.use('/transfers', transferRoutes);
router.use('/tracking', transferRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/alerts', alertRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);
router.use('/abdm', abdmRoutes);

module.exports = router;
