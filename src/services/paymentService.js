/**
 * MedEx Payment Service (Frontend Client)
 * 
 * Handles interaction with backend payment endpoints and standard Razorpay checkout SDK.
 * Exclusively communicates with backend for order creation and cryptographic verification.
 * Does NOT collect, transmit, or store raw card numbers, CVVs, or sensitive credentials.
 */

import { API_BASE_URL } from '../config/api.js';
import { getStoredItem, KEYS } from './storage.js';

function getAuthHeader() {
  const session = getStoredItem(KEYS.AUTH, null);
  const token = session?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Loads the official Razorpay Checkout SDK script dynamically.
 * Resolves when window.Razorpay is available.
 */
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve(null);
    }
    if (window.Razorpay) {
      return resolve(window.Razorpay);
    }

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Razorpay));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout SDK')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      resolve(window.Razorpay);
    };

    script.onerror = () => {
      reject(new Error('Failed to load Razorpay Checkout SDK. Check network connectivity.'));
    };

    document.body.appendChild(script);
  });
}

export const paymentService = {
  /**
   * Fetch public gateway config (e.g. keyId, provider, currency)
   */
  async getGatewayConfig() {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/config`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.data) {
        return data.data;
      }
      return { provider: 'mock', keyId: null, isConfigured: false, currency: 'INR' };
    } catch {
      return { provider: 'mock', keyId: null, isConfigured: false, currency: 'INR' };
    }
  },

  /**
   * Authoritatively initiate a payment order on the backend
   * Returns order details including providerOrderId, paymentId, amount, keyId
   */
  async createPaymentOrder({ requestId }) {
    if (!requestId) throw new Error('Requisition ID is required to create payment order');

    const res = await fetch(`${API_BASE_URL}/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ requestId }),
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      const msg = data?.error?.message || data?.message || 'Failed to create payment order on backend';
      throw new Error(msg);
    }

    return data.data;
  },

  /**
   * Server-side cryptographic signature verification
   */
  async verifyPayment({ paymentId, providerOrderId, providerPaymentId, providerSignature }) {
    const res = await fetch(`${API_BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        paymentId,
        providerOrderId,
        providerPaymentId,
        providerSignature,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      const msg = data?.error?.message || data?.message || 'Payment signature verification failed';
      throw new Error(msg);
    }

    return data.data;
  },

  /**
   * Record payment failure or checkout cancellation
   */
  async recordPaymentFailure({ paymentId, reason }) {
    try {
      const res = await fetch(`${API_BASE_URL}/payments/fail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ paymentId, reason }),
      });
      return await res.json();
    } catch (err) {
      console.warn('Payment failure reporting error:', err);
      return null;
    }
  },

  /**
   * Retry payment for an existing requisition
   */
  async retryPayment({ requestId }) {
    const res = await fetch(`${API_BASE_URL}/payments/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ requestId }),
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      const msg = data?.error?.message || data?.message || 'Failed to re-initiate payment order';
      throw new Error(msg);
    }

    return data.data;
  },
};

export default paymentService;
