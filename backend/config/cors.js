const logger = require('../utils/logger');

/**
 * Normalizes an origin string into standard scheme://host[:port] format.
 * - Trims whitespace
 * - Validates URL format
 * - Checks protocol is http or https
 * - Strips paths, query strings, hashes, and trailing slashes
 * - Converts scheme and host to lowercase
 * - Disallows wildcard '*'
 * 
 * @param {string} raw - The raw origin string
 * @returns {string|null} - Normalized origin or null if invalid
 */
function normalizeOrigin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch (err) {
    return null;
  }
}

/**
 * Default origins permitted during development and testing.
 */
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

/**
 * Parses and sanitizes CORS origins based on environment rules.
 * 
 * In Production:
 * - Origins MUST be explicitly supplied in CORS_ORIGINS.
 * - Wildcards (*) and local defaults are strictly prohibited.
 * - If missing or malformed, fails safely by returning an empty array.
 * 
 * In Development / Test:
 * - Sensible local defaults are provided automatically.
 * - FRONTEND_URL and CORS_ORIGINS (if present) are normalized and merged.
 * 
 * @param {string} [originsEnv] - Comma-separated CORS_ORIGINS value
 * @param {string} [nodeEnv] - The current NODE_ENV ('production', 'development', 'test')
 * @param {string} [frontendUrl] - Optional FRONTEND_URL environment variable
 * @returns {string[]} - Array of unique normalized allowed origins
 */
function parseCorsOrigins(originsEnv, nodeEnv = process.env.NODE_ENV, frontendUrl = process.env.FRONTEND_URL) {
  const isProd = nodeEnv === 'production';
  const origins = [];

  // Parse comma-separated origins from environment variable
  if (originsEnv && typeof originsEnv === 'string') {
    const rawTokens = originsEnv.split(',');
    for (const rawToken of rawTokens) {
      const trimmed = rawToken.trim();
      if (!trimmed) continue;

      if (trimmed === '*') {
        logger.warn('[CORS] Wildcard "*" origin is strictly prohibited when credentials are enabled. Skipping.');
        continue;
      }

      const normalized = normalizeOrigin(trimmed);
      if (normalized) {
        origins.push(normalized);
      } else {
        logger.warn(`[CORS] Invalid or malformed origin ignored: "${trimmed}"`);
      }
    }
  }

  if (isProd) {
    if (origins.length === 0) {
      logger.warn('[CORS] CRITICAL SECURITY WARNING: Production environment has no valid CORS_ORIGINS configured. All browser cross-origin requests will be denied.');
    }
    return Array.from(new Set(origins));
  }

  // Development & Test: Merge local defaults and frontendUrl
  const devOrigins = [...DEFAULT_DEV_ORIGINS];
  if (frontendUrl && typeof frontendUrl === 'string') {
    const normalizedFrontend = normalizeOrigin(frontendUrl);
    if (normalizedFrontend) {
      devOrigins.push(normalizedFrontend);
    }
  }

  return Array.from(new Set([...devOrigins, ...origins]));
}

/**
 * Creates standard CORS middleware configuration options for express cors package.
 * 
 * @param {Object} [overrides={}] - Optional custom configuration overrides
 * @returns {Object} - Options for cors() middleware
 */
function createCorsOptions(overrides = {}) {
  return {
    origin: function corsOriginDelegate(requestOrigin, callback) {
      // 1. Requests with no Origin header (server-to-server, health checks, curl, mobile native)
      // Browsers always send an Origin header on cross-origin requests.
      if (!requestOrigin) {
        return callback(null, true);
      }

      // Determine allowed origins dynamically or via overrides
      const isProd = (overrides.nodeEnv || process.env.NODE_ENV) === 'production';
      const allowedOrigins = overrides.origins !== undefined
        ? overrides.origins
        : parseCorsOrigins(process.env.CORS_ORIGINS, overrides.nodeEnv || process.env.NODE_ENV, process.env.FRONTEND_URL);

      // 2. Normalize incoming browser origin
      const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

      // 3. Check against allowlist
      if (normalizedRequestOrigin && allowedOrigins.includes(normalizedRequestOrigin)) {
        return callback(null, true);
      }

      // 4. Reject unauthorized browser origins cleanly
      const corsError = new Error(`CORS origin "${requestOrigin}" is not allowed.`);
      corsError.status = 403;
      corsError.statusCode = 403;
      corsError.code = 'CORS_NOT_ALLOWED';
      return callback(corsError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 204,
    ...overrides.corsOptions,
  };
}

module.exports = {
  normalizeOrigin,
  parseCorsOrigins,
  createCorsOptions,
  DEFAULT_DEV_ORIGINS,
};
