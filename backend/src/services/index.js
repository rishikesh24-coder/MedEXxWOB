const alertService = require('../../services/alertService');
const auditService = require('../../services/auditService');
const authService = require('../../services/authService');
const documentService = require('../../services/documentService');
const feedbackService = require('../../services/feedbackService');
const hospitalService = require('../../services/hospitalService');
const inventoryService = require('../../services/inventoryService');
const medicineService = require('../../services/medicineService');
const notificationService = require('../../services/notificationService');
const paymentProvider = require('../../services/paymentProvider');
const paymentService = require('../../services/paymentService');
const refundService = require('../../services/refundService');
const requestService = require('../../services/requestService');
const tradingService = require('../../services/tradingService');
const transferService = require('../../services/transferService');
const verificationService = require('../../services/verificationService');

module.exports = {
  alertService,
  auditService,
  authService,
  documentService,
  feedbackService,
  hospitalService,
  inventoryService,
  medicineService,
  notificationService,
  paymentProvider,
  paymentService,
  refundService,
  requestService,
  tradingService,
  transferService,
  verificationService,
};
