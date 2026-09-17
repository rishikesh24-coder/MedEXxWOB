const { errorResponse } = require('../utils/apiResponse');

/**
 * Ensures required body fields are present
 * @param {string[]} fields
 */
const requireBodyFields = (fields) => (req, res, next) => {
  const missing = [];
  for (const field of fields) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return errorResponse(
      res,
      `Missing required request fields: ${missing.join(', ')}`,
      400,
      'VALIDATION_FAILED',
      { missingFields: missing }
    );
  }

  next();
};

module.exports = {
  requireBodyFields,
};
