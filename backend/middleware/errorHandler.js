const logger = require('../utils/logger');
const { errorResponse } = require('../utils/apiResponse');

const notFoundHandler = (req, res, next) => {
  return errorResponse(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
};

const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled API error on ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred on the MedEx server.';
  
  // Custom properties for domain-specific status gates
  const details = {};
  if (err.missingFields) details.missingFields = err.missingFields;
  if (err.hospital) details.hospital = err.hospital;
  if (err.rejectionReason) details.rejectionReason = err.rejectionReason;
  if (err.missingDocuments) details.missingDocuments = err.missingDocuments;

  return errorResponse(
    res,
    message,
    statusCode,
    code,
    Object.keys(details).length > 0 ? details : (process.env.NODE_ENV === 'development' ? { stack: err.stack } : null)
  );
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
