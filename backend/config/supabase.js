const { createClient } = require('@supabase/supabase-js');
const environment = require('./environment');
const logger = require('../utils/logger');

let supabaseAnon = null;
let supabaseAdmin = null;

if (environment.supabase.isConfigured) {
  try {
    // 1. Client-safe / Anon Supabase Client
    supabaseAnon = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // 2. Server-side Service Role Client (Optional - strictly server-side)
    if (environment.supabase.isServiceRoleConfigured) {
      supabaseAdmin = createClient(
        environment.supabase.url,
        environment.supabase.serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );
    }

    logger.info('Supabase client initialized successfully.');
  } catch (err) {
    logger.error('Failed to initialize Supabase client:', err.message);
  }
} else {
  logger.warn('Supabase credentials not configured or incomplete in backend/.env');
}

/**
 * Checks connectivity to the Supabase project
 * @returns {Promise<{ configured: boolean, initialized: boolean, connected: boolean, message: string }>}
 */
const checkConnection = async () => {
  if (!environment.supabase.isConfigured || !supabaseAnon) {
    return {
      configured: false,
      initialized: false,
      connected: false,
      message: 'Supabase credentials are not configured in backend/.env.',
    };
  }

  try {
    // Probe Supabase service to confirm network connectivity and key validity
    const { error } = await supabaseAnon.auth.getSession();
    if (error) {
      return {
        configured: true,
        initialized: true,
        connected: false,
        message: `Supabase probe returned error: ${error.message}`,
      };
    }

    return {
      configured: true,
      initialized: true,
      connected: true,
      message: 'Supabase client connected and reachable.',
    };
  } catch (err) {
    return {
      configured: true,
      initialized: true,
      connected: false,
      message: `Supabase connection test failed: ${err.message}`,
    };
  }
};

module.exports = {
  supabaseAnon,
  supabaseAdmin,
  isConfigured: environment.supabase.isConfigured,
  isServiceRoleConfigured: environment.supabase.isServiceRoleConfigured,
  checkConnection,
};
