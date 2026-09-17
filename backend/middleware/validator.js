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

/**
 * Ensures required query parameters are present
 * @param {string[]} fields
 */
const requireQueryFields = (fields) => (req, res, next) => {
  const missing = [];
  for (const field of fields) {
    if (req.query[field] === undefined || req.query[field] === null || req.query[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return errorResponse(
      res,
      `Missing required query parameters: ${missing.join(', ')}`,
      400,
      'QUERY_VALIDATION_FAILED',
      { missingQueryFields: missing }
    );
  }

  next();
};

/**
 * Ensures required URL route parameters are present
 * @param {string[]} params
 */
const requireParams = (params) => (req, res, next) => {
  const missing = [];
  for (const p of params) {
    if (!req.params || req.params[p] === undefined || req.params[p] === null || req.params[p] === '') {
      missing.push(p);
    }
  }

  if (missing.length > 0) {
    return errorResponse(
      res,
      `Missing required route parameters: ${missing.join(', ')}`,
      400,
      'PARAM_VALIDATION_FAILED',
      { missingParams: missing }
    );
  }

  next();
};

/**
 * Generic request validation runner
 * @param {Function} validatorFn - (req) => { isValid: boolean, error?: string, details?: any }
 */
const validateRequest = (validatorFn) => (req, res, next) => {
  try {
    const result = validatorFn(req);
    if (!result || result.isValid !== true) {
      return errorResponse(
        res,
        result?.error || 'Request validation check failed.',
        400,
        result?.code || 'VALIDATION_ERROR',
        result?.details || null
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requireBodyFields,
  requireQueryFields,
  requireParams,
  validateRequest,
};
