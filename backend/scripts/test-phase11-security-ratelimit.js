/**
 * MedEx Phase 11 Step 1 Test Suite
 * Production Security Gating & API Rate Limiting
 *
 * Tests:
 * 1. Development demo tokens remain operational in development
 * 2. Production demo admin token is rejected with 401
 * 3. Production demo hospital token is rejected with 401
 * 4. Production invalid token is rejected with 401
 * 5. Production missing token is rejected with 401
 * 6. Production authService fails closed (no mock tokens issued)
 * 7. RBAC: Hospital cannot access admin-only endpoints (403)
 * 8. RBAC: Pending hospital blocked from operational endpoints (403)
 * 9. RBAC: Rejected hospital blocked from operational endpoints (403)
 * 10. Rate Limiting: Auth endpoint accepts requests under limit
 * 11. Rate Limiting: Auth endpoint returns 429 when limit exceeded
 * 12. Rate Limiting: Registration endpoint returns 429 when limit exceeded
 * 13. Rate Limiting: Webhook endpoint returns 429 when limit exceeded
 * 14. Webhook Security: Valid HMAC signature succeeds
 * 15. Webhook Security: Tampered/invalid HMAC signature is rejected
 */

const express = require('express');
const http = require('http');
const axios = require('axios');
const assert = require('assert');

const { authenticateUser, requireAdmin, requireHospital } = require('../middleware/auth');
const authService = require('../services/authService');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { getPaymentProvider } = require('../services/paymentProvider');
const paymentController = require('../controllers/paymentController');

let passedCount = 0;
let failedCount = 0;

async function test(title, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${title}`);
    console.error(`         Error: ${err.message}`);
    if (err.response) {
      console.error(`         Response: ${JSON.stringify(err.response.data)}`);
    }
    failedCount++;
  }
}

// Helper mock response object for direct middleware invocation
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    },
  };
}

async function runAllTests() {
  console.log('================================================================');
  console.log('MEDEX PHASE 11 STEP 1: PRODUCTION SECURITY GATING & RATE LIMITS');
  console.log('================================================================\n');

  const originalEnv = process.env.NODE_ENV;

  // -------------------------------------------------------------
  // SECTION 1: DEVELOPMENT ENVIRONMENT AUTH BEHAVIOR
  // -------------------------------------------------------------
  console.log('--- SECTION 1: DEVELOPMENT AUTH & RBAC (NODE_ENV=development) ---');
  process.env.NODE_ENV = 'development';

  await test('1. Dev: Demo admin token authenticates as Super Administrator', async () => {
    const req = { headers: { authorization: 'Bearer mock_jwt_token_admin_test' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'next() should be called');
    assert.strictEqual(req.user?.role, 'admin');
    assert.strictEqual(req.user?.email, 'admin@medex.org');
  });

  await test('2. Dev: Demo hospital token authenticates as Hospital user', async () => {
    const req = { headers: { authorization: 'Bearer mock_jwt_token_hospital_apollo_1111' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'next() should be called');
    assert.strictEqual(req.user?.role, 'hospital');
    assert.strictEqual(req.hospital?.status, 'APPROVED');
  });

  await test('3. Dev: Hospital user calling admin-only guard receives 403 FORBIDDEN_ADMIN_ONLY', async () => {
    const req = {
      user: { id: 'hosp-1', role: 'hospital', name: 'Apollo' },
    };
    const res = createMockRes();
    let nextCalled = false;

    requireAdmin(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN_ADMIN_ONLY');
  });

  await test('4. Dev: Pending hospital calling operational guard receives 403 PENDING_ADMIN_APPROVAL', async () => {
    const req = {
      user: { id: 'hosp-pending', role: 'hospital' },
      hospital: { id: 'hosp-pending', status: 'PENDING_APPROVAL', name: 'Pending Hospital' },
    };
    const res = createMockRes();
    let nextCalled = false;

    requireHospital(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body?.error?.code, 'PENDING_ADMIN_APPROVAL');
  });

  await test('5. Dev: Rejected hospital calling operational guard receives 403 REGISTRATION_REJECTED', async () => {
    const req = {
      user: { id: 'hosp-rejected', role: 'hospital' },
      hospital: { id: 'hosp-rejected', status: 'REJECTED', name: 'Rejected Hospital', rejectionReason: 'License expired' },
    };
    const res = createMockRes();
    let nextCalled = false;

    requireHospital(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body?.error?.code, 'REGISTRATION_REJECTED');
  });

  // -------------------------------------------------------------
  // SECTION 2: PRODUCTION AUTH SECURITY GATING (NODE_ENV=production)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: PRODUCTION SECURITY GATING (NODE_ENV=production) ---');
  process.env.NODE_ENV = 'production';

  await test('6. Prod: Demo admin token is REJECTED with 401 INVALID_TOKEN', async () => {
    const req = { headers: { authorization: 'Bearer mock_jwt_token_admin_super' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for demo admin in prod');
    assert.strictEqual(res.statusCode, 401, 'Must return HTTP 401');
    assert.strictEqual(res.body?.error?.code, 'INVALID_TOKEN');
    assert.strictEqual(req.user, undefined, 'Must not attach req.user');
  });

  await test('7. Prod: Demo hospital token is REJECTED with 401 INVALID_TOKEN', async () => {
    const req = { headers: { authorization: 'Bearer mock_jwt_token_hospital_apollo_active' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'next() must NOT be called for demo hospital in prod');
    assert.strictEqual(res.statusCode, 401, 'Must return HTTP 401');
    assert.strictEqual(res.body?.error?.code, 'INVALID_TOKEN');
    assert.strictEqual(req.user, undefined, 'Must not attach req.user');
  });

  await test('8. Prod: String identifier "admin" is REJECTED with 401 INVALID_TOKEN', async () => {
    const req = { headers: { authorization: 'Bearer admin' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body?.error?.code, 'INVALID_TOKEN');
  });

  await test('9. Prod: Invalid/garbage token is REJECTED with 401 INVALID_TOKEN', async () => {
    const req = { headers: { authorization: 'Bearer totally_invalid_garbage_token_xyz' } };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body?.error?.code, 'INVALID_TOKEN');
  });

  await test('10. Prod: Missing Authorization header is REJECTED with 401 UNAUTHORIZED', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await authenticateUser(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body?.error?.code, 'UNAUTHORIZED');
  });

  await test('11. Prod: authService.login fails closed without issuing mock tokens', async () => {
    try {
      await authService.login({
        email: 'admin@medex.org',
        password: 'Password123!',
        role: 'admin',
      });
      assert.fail('Expected authService.login to fail closed in production without real Supabase connection');
    } catch (err) {
      assert.strictEqual(err.statusCode, 401, `Must reject with 401, got: ${err.statusCode} - ${err.message}`);
      assert.strictEqual(err.message.length > 0, true);
    }
  });

  // -------------------------------------------------------------
  // SECTION 3: HTTP RATE LIMITING WITH EPHEMERAL EXPRESS SERVER
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: API RATE LIMITING (HTTP 429 VERIFICATION) ---');

  const testApp = express();
  testApp.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }));

  // Create isolated rate limiters with tight thresholds for testing
  const testAuthLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many authentication attempts. Please try again later.',
  });

  const testRegistrationLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 2,
    message: 'Too many registration requests. Please try again later.',
  });

  const testWebhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    message: 'Too many webhook requests. Please try again later.',
  });

  // Test routes
  testApp.post('/test/auth/login', testAuthLimiter, (req, res) => {
    return res.status(200).json({ success: true, message: 'Auth endpoint reached' });
  });

  testApp.post('/test/hospitals/register', testRegistrationLimiter, (req, res) => {
    return res.status(201).json({ success: true, message: 'Registration endpoint reached' });
  });

  testApp.post('/test/payments/webhook', testWebhookLimiter, paymentController.handleWebhook);

  // Start test server on random available port
  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  await test('12. Rate Limit: Auth endpoint accepts requests under configured limit', async () => {
    const res1 = await axios.post(`${baseUrl}/test/auth/login`, { email: 'test@medex.org' });
    const res2 = await axios.post(`${baseUrl}/test/auth/login`, { email: 'test@medex.org' });
    const res3 = await axios.post(`${baseUrl}/test/auth/login`, { email: 'test@medex.org' });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res3.status, 200);
  });

  await test('13. Rate Limit: Auth endpoint returns HTTP 429 RATE_LIMIT_EXCEEDED when exceeded', async () => {
    try {
      await axios.post(`${baseUrl}/test/auth/login`, { email: 'test@medex.org' });
      assert.fail('Request should have been rate limited to 429');
    } catch (err) {
      assert.strictEqual(err.response?.status, 429, 'Must return status 429');
      assert.strictEqual(err.response?.data?.success, false);
      assert.strictEqual(err.response?.data?.error, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(err.response?.data?.message, 'Too many authentication attempts. Please try again later.');
      assert.strictEqual(typeof err.response?.data?.timestamp, 'string');
    }
  });

  await test('14. Rate Limit: Registration endpoint returns HTTP 429 after exceeding limit', async () => {
    // Limit is max: 2
    const res1 = await axios.post(`${baseUrl}/test/hospitals/register`, { name: 'Hospital 1' });
    const res2 = await axios.post(`${baseUrl}/test/hospitals/register`, { name: 'Hospital 2' });
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);

    try {
      await axios.post(`${baseUrl}/test/hospitals/register`, { name: 'Hospital 3' });
      assert.fail('Registration request 3 should have returned 429');
    } catch (err) {
      assert.strictEqual(err.response?.status, 429);
      assert.strictEqual(err.response?.data?.error, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(err.response?.data?.message, 'Too many registration requests. Please try again later.');
    }
  });

  await test('15. Rate Limit: Webhook endpoint is rate limited when flooded', async () => {
    const provider = getPaymentProvider('mock');
    const makePayload = (id) => {
      const payloadObj = {
        id: `evt_flood_${id}`,
        event: 'payment.captured',
        payload: { payment: { entity: { id: `pay_${id}`, amount: 1000 } } },
      };
      const raw = Buffer.from(JSON.stringify(payloadObj));
      const sig = provider.generateWebhookSignature(raw);
      return { raw, sig };
    };

    // Requests 1, 2, 3 should be accepted by rate limiter (limit max: 3)
    for (let i = 1; i <= 3; i++) {
      const { raw, sig } = makePayload(i);
      const res = await axios.post(`${baseUrl}/test/payments/webhook`, raw, {
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
      });
      assert.strictEqual(res.status, 200);
    }

    // Request 4 must exceed webhook rate limit
    try {
      const { raw, sig } = makePayload(4);
      await axios.post(`${baseUrl}/test/payments/webhook`, raw, {
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
      });
      assert.fail('Request 4 should have returned 429 RATE_LIMIT_EXCEEDED');
    } catch (err) {
      assert.strictEqual(err.response?.status, 429);
      assert.strictEqual(err.response?.data?.error, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(err.response?.data?.message, 'Too many webhook requests. Please try again later.');
    }
  });

  // -------------------------------------------------------------
  // SECTION 4: WEBHOOK HMAC INTEGRITY VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: WEBHOOK HMAC SIGNATURE VERIFICATION ---');

  // Separate endpoint on fresh rate limiter to test HMAC verification exclusively
  const hmacTestLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 });
  testApp.post('/test/payments/hmac-webhook', hmacTestLimiter, paymentController.handleWebhook);

  await test('16. Webhook HMAC: Valid cryptographic signature is accepted', async () => {
    const provider = getPaymentProvider('mock');
    const payloadObj = {
      id: `evt_valid_hmac_${Date.now()}`,
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_valid_123', amount: 50000 } } },
    };
    const raw = Buffer.from(JSON.stringify(payloadObj));
    const validSignature = provider.generateWebhookSignature(raw);

    const res = await axios.post(`${baseUrl}/test/payments/hmac-webhook`, raw, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data?.status, 'ok');
    assert.strictEqual(res.data?.received, true);
  });

  await test('17. Webhook HMAC: Tampered/invalid cryptographic signature is rejected', async () => {
    const payloadObj = {
      id: `evt_tampered_hmac_${Date.now()}`,
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_tampered_123', amount: 50000 } } },
    };
    const raw = Buffer.from(JSON.stringify(payloadObj));
    const tamperedSignature = 'invalidsignature_fake_hmac_hex_bytes_00000000';

    try {
      await axios.post(`${baseUrl}/test/payments/hmac-webhook`, raw, {
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': tamperedSignature,
        },
      });
      assert.fail('Tampered signature should have been rejected');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401, 'Invalid signature must return 401');
      assert.strictEqual(err.response?.data?.status, 'error');
      assert.match(err.response?.data?.message, /signature/i);
    }
  });

  await test('18. Webhook HMAC: Missing signature header is rejected with 400', async () => {
    const payloadObj = { id: 'evt_no_sig', event: 'payment.captured' };
    const raw = Buffer.from(JSON.stringify(payloadObj));

    try {
      await axios.post(`${baseUrl}/test/payments/hmac-webhook`, raw, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      assert.fail('Missing signature should have been rejected');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.error?.code, 'BAD_REQUEST');
    }
  });

  // Teardown
  server.close();
  process.env.NODE_ENV = originalEnv;

  console.log('\n================================================================');
  console.log(`PHASE 11 STEP 1 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
