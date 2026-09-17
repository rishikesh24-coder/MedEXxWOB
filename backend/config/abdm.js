/**
 * Ayushman Bharat Digital Mission (ABDM)
 * Secure Configuration Placeholder for Future Integration
 * 
 * NOTE: Credentials must be configured via environment variables.
 * No external API calls are made at this stage.
 */

const abdmConfig = {
  apiKey: process.env.ABDM_API_KEY || '',
  clientId: process.env.ABDM_CLIENT_ID || '',
  clientSecret: process.env.ABDM_CLIENT_SECRET || '',
  baseUrl: process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway',
  isConfigured: Boolean(process.env.ABDM_CLIENT_ID && process.env.ABDM_CLIENT_SECRET),
};

module.exports = abdmConfig;
