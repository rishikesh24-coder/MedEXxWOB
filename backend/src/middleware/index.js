const auth = require('../../middleware/auth');
const errorHandler = require('../../middleware/errorHandler');
const validator = require('../../middleware/validator');
const rateLimiter = require('../../middleware/rateLimiter');
const logger = require('../../middleware/logger');

module.exports = {
  ...auth,
  ...errorHandler,
  ...validator,
  ...rateLimiter,
  logger,
};
