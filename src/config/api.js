/**
 * MedEx Centralized Frontend API Configuration
 * 
 * Manages the API base URL across local development, staging, and production environments.
 * Normalizes input so trailing slashes are stripped and '/api' is deterministically handled
 * without producing duplicate slashes (//api) or duplicate segments (/api/api).
 */

export function normalizeApiBaseUrl(rawUrl) {
  const url = (typeof rawUrl === 'string' ? rawUrl : '').trim();

  // If empty or root slash, default directly to '/api'
  if (!url || url === '/') {
    return '/api';
  }

  // Strip all trailing slashes: e.g. 'https://api.example.com/' -> 'https://api.example.com'
  const trimmed = url.replace(/\/+$/, '');

  // If already exactly '/api' or ends with '/api', do not append another '/api'
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }

  // Otherwise, ensure single slash separator before 'api'
  return `${trimmed}/api`;
}

// Safely access Vite environment variable with fallback for Node test environments
const configuredBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL)
    ? process.env.VITE_API_BASE_URL
    : '/api';

export const API_BASE_URL = normalizeApiBaseUrl(configuredBaseUrl);
export const API_BASE = API_BASE_URL;

/**
 * Emits a window custom event to notify listeners (e.g. App component)
 * that an HTTP 401 Unauthorized or expired session token occurred.
 */
export function notifySessionExpired() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('medex:session-expired', { detail: { timestamp: Date.now() } }));
  }
}

export default API_BASE_URL;
