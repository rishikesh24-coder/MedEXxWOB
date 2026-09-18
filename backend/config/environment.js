const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { parseCorsOrigins } = require('./cors');

const environment = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV, process.env.FRONTEND_URL),
    rawOrigins: process.env.CORS_ORIGINS || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    isConfigured: Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_URL.startsWith('https://') &&
      process.env.SUPABASE_ANON_KEY &&
      !process.env.SUPABASE_ANON_KEY.includes('your-supabase-anon-key')
    ),
    isServiceRoleConfigured: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase-service-role-key')
    ),
  },

  abdm: {
    apiKey: process.env.ABDM_API_KEY || '',
    clientId: process.env.ABDM_CLIENT_ID || '',
    clientSecret: process.env.ABDM_CLIENT_SECRET || '',
    baseUrl: process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway',
    isConfigured: Boolean(
      process.env.ABDM_CLIENT_ID &&
      process.env.ABDM_CLIENT_SECRET
    ),
  },

  payment: {
    provider: (process.env.PAYMENT_PROVIDER || (process.env.RAZORPAY_KEY_ID ? 'razorpay' : 'mock')).toLowerCase(),
    keyId: process.env.PAYMENT_PROVIDER_KEY || process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.PAYMENT_PROVIDER_SECRET || process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '',
    isConfigured: Boolean(
      (process.env.PAYMENT_PROVIDER_KEY || process.env.RAZORPAY_KEY_ID) &&
      (process.env.PAYMENT_PROVIDER_SECRET || process.env.RAZORPAY_KEY_SECRET)
    )
  },

  documents: {
    maxSizeMb: parseInt(process.env.MAX_DOCUMENT_SIZE_MB, 10) || 5,
    maxSizeBytes: (parseInt(process.env.MAX_DOCUMENT_SIZE_MB, 10) || 5) * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    signedUrlExpiresSeconds: parseInt(process.env.DOCUMENT_SIGNED_URL_EXPIRES_SECONDS, 10) || 900,
  },

  security: {
    trustProxy: process.env.TRUST_PROXY || false,
    rateLimiting: {
      auth: {
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000),
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 10 : 100),
      },
      registration: {
        windowMs: parseInt(process.env.REGISTRATION_RATE_LIMIT_WINDOW_MS, 10) || (60 * 60 * 1000),
        max: parseInt(process.env.REGISTRATION_RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 5 : 50),
      },
      webhook: {
        windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 10) || (60 * 1000),
        max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 120 : 1000),
      },
      documentUpload: {
        windowMs: parseInt(process.env.DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000),
        max: parseInt(process.env.DOCUMENT_UPLOAD_RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 20 : 100),
      },
      general: {
        windowMs: parseInt(process.env.GENERAL_RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000),
        max: parseInt(process.env.GENERAL_RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 300 : 3000),
      },
    },
  },
};

module.exports = environment;

