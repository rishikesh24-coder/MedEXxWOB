/**
 * Standardized API Response Utilities for MedEx
 */

const successResponse = (res, data = null, message = 'Operation completed successfully', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const errorResponse = (res, message = 'An error occurred', statusCode = 500, code = 'SERVER_ERROR', details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};

const paginatedResponse = (res, items = [], page = 1, limit = 20, total = 0, message = 'Data retrieved successfully') => {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(total / limit) || 1,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
