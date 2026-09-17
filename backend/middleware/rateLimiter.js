/**
 * Application-Layer Rate Limiting Middleware for MedEx
 * Powered by express-rate-limit
 */
const rateLimit = require('express-rate-limit');
const environment = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Standard rate-limit error handler returning a clean, machine-readable JSON response
 */
const standardRateLimitHandler = (req, res, next, options) => {
  logger.warn(`Rate limit exceeded for IP: ${req.ip} on route: ${req.originalUrl || req.url}`);
  return res.status(options.statusCode || 429).json({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: options.message || 'Too many requests. Please try again later.',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Factory to create standardized rate limiters
 */
const createRateLimiter = (options = {}) => {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: standardRateLimitHandler,
    ...options,
  });
};

// 1. Authentication Rate Limiter (Protects login & credentialed flows from brute force / credential stuffing)
const authLimiter = createRateLimiter({
  windowMs: environment.security.rateLimiting.auth.windowMs,
  max: environment.security.rateLimiting.auth.max,
  message: 'Too many authentication attempts. Please try again later.',
});

// 2. Registration Rate Limiter (Protects institutional onboarding endpoints from bot flooding)
const registrationLimiter = createRateLimiter({
  windowMs: environment.security.rateLimiting.registration.windowMs,
  max: environment.security.rateLimiting.registration.max,
  message: 'Too many registration requests. Please try again later.',
});

// 3. Webhook Rate Limiter (Protects external payment webhook endpoints while accommodating provider retries)
const webhookLimiter = createRateLimiter({
  windowMs: environment.security.rateLimiting.webhook.windowMs,
  max: environment.security.rateLimiting.webhook.max,
  message: 'Too many webhook requests. Please try again later.',
});

// 4. Document Upload Rate Limiter (Protects upload endpoints against upload flooding & DoS)
const documentUploadLimiter = createRateLimiter({
  windowMs: environment.security.rateLimiting.documentUpload?.windowMs || (15 * 60 * 1000),
  max: environment.security.rateLimiting.documentUpload?.max || (process.env.NODE_ENV === 'production' ? 20 : 100),
  message: 'Too many document upload requests. Please try again later.',
});

// 5. General API Rate Limiter (Protects application from basic volumetric abuse)
const generalLimiter = createRateLimiter({
  windowMs: environment.security.rateLimiting.general.windowMs,
  max: environment.security.rateLimiting.general.max,
  message: 'Too many requests from this client. Please try again later.',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  registrationLimiter,
  webhookLimiter,
  documentUploadLimiter,
  generalLimiter,
};

