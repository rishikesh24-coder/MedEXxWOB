/**
 * MedEx Authentication & RBAC Test Suite
 * Validates the 6 required security scenarios + Auth flow endpoints
 */

const axios = require('axios');
const app = require('../server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function startServerIfNeeded() {
  try {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 1500 });
    if (res.status === 200) {
      return null;
    }
  } catch (e) {
    // Server not running, start in-process
  }

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      resolve(server);
    });
  });
}

const TOKENS = {
  ADMIN: 'mock_jwt_token_admin_test_session',
  APPROVED_HOSPITAL: 'mock_jwt_token_hospital_apollo_active',
  PENDING_HOSPITAL: 'mock_jwt_token_pending_metrocare_review',
  REJECTED_HOSPITAL: 'mock_jwt_token_rejected_citytrauma_declined',
};

async function runTests() {
  console.log('====================================================');
  console.log('MedEx AUTHENTICATION & ROLE-BASED ACCESS CONTROL TESTS');
  console.log('====================================================\n');

  const serverInstance = await startServerIfNeeded();

  let passed = 0;
  let failed = 0;

  try {

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      if (err.response) {
        console.error('       Response data:', JSON.stringify(err.response.data));
      }
      failed++;
    }
  }

  // 1. Unauthenticated request -> 401
  await testCase('1. Unauthenticated request returns 401 Unauthorized', async () => {
    try {
      await axios.get(`${BASE_URL}/users/profile`);
      throw new Error('Expected 401 but request succeeded');
    } catch (err) {
      if (err.response?.status === 401 && err.response.data?.error?.code === 'UNAUTHORIZED') {
        return true;
      }
      throw err;
    }
  });

  // 2. Hospital calling admin endpoint -> 403
  await testCase('2. Hospital user calling admin endpoint returns 403 Forbidden', async () => {
    try {
      await axios.get(`${BASE_URL}/users/test-admin`, {
        headers: { Authorization: `Bearer ${TOKENS.APPROVED_HOSPITAL}` },
      });
      throw new Error('Expected 403 but hospital accessed admin endpoint');
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.error?.code === 'FORBIDDEN_ADMIN_ONLY') {
        return true;
      }
      throw err;
    }
  });

  // 3. Admin calling admin endpoint -> allowed (200)
  await testCase('3. Admin user calling admin endpoint returns 200 OK', async () => {
    const res = await axios.get(`${BASE_URL}/users/test-admin`, {
      headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
    });
    if (res.status === 200 && res.data?.data?.authorized === true && res.data?.data?.role === 'admin') {
      return true;
    }
    throw new Error(`Unexpected response payload: ${JSON.stringify(res.data)}`);
  });

  // 4. Approved hospital calling hospital endpoint -> allowed (200)
  await testCase('4. Approved hospital calling operational endpoint returns 200 OK', async () => {
    const res = await axios.get(`${BASE_URL}/hospitals/operational-test`, {
      headers: { Authorization: `Bearer ${TOKENS.APPROVED_HOSPITAL}` },
    });
    if (res.status === 200 && res.data?.data?.authorized === true && res.data?.data?.status === 'APPROVED') {
      return true;
    }
    throw new Error(`Unexpected response payload: ${JSON.stringify(res.data)}`);
  });

  // 5. Pending hospital calling protected hospital operation -> denied (403 PENDING_ADMIN_APPROVAL)
  await testCase('5. Pending hospital calling operational endpoint returns 403 PENDING_ADMIN_APPROVAL', async () => {
    try {
      await axios.get(`${BASE_URL}/hospitals/operational-test`, {
        headers: { Authorization: `Bearer ${TOKENS.PENDING_HOSPITAL}` },
      });
      throw new Error('Expected 403 but pending hospital accessed operational endpoint');
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.error?.code === 'PENDING_ADMIN_APPROVAL') {
        return true;
      }
      throw err;
    }
  });

  // 6. Rejected hospital calling protected hospital operation -> denied (403 REGISTRATION_REJECTED)
  await testCase('6. Rejected hospital calling operational endpoint returns 403 REGISTRATION_REJECTED', async () => {
    try {
      await axios.get(`${BASE_URL}/hospitals/operational-test`, {
        headers: { Authorization: `Bearer ${TOKENS.REJECTED_HOSPITAL}` },
      });
      throw new Error('Expected 403 but rejected hospital accessed operational endpoint');
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.error?.code === 'REGISTRATION_REJECTED') {
        return true;
      }
      throw err;
    }
  });

  // 7. Pending hospital allowed on onboarding/status endpoint -> 200
  await testCase('7. Pending hospital allowed on pending-test onboarding endpoint returns 200 OK', async () => {
    const res = await axios.get(`${BASE_URL}/hospitals/pending-test`, {
      headers: { Authorization: `Bearer ${TOKENS.PENDING_HOSPITAL}` },
    });
    if (res.status === 200 && res.data?.data?.authorized === true) {
      return true;
    }
    throw new Error(`Unexpected response payload: ${JSON.stringify(res.data)}`);
  });

  // 8. Auth me endpoint -> 200 with user profile
  await testCase('8. Authenticated GET /api/auth/me returns user session profile', async () => {
    const res = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${TOKENS.APPROVED_HOSPITAL}` },
    });
    if (res.status === 200 && res.data?.data?.user?.email === 'apollo.mumbai@medex.org') {
      return true;
    }
    throw new Error(`Unexpected user payload: ${JSON.stringify(res.data)}`);
  });

  // 9. Auth logout endpoint -> 200
  await testCase('9. Authenticated POST /api/auth/logout safely terminates session', async () => {
    const res = await axios.post(`${BASE_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
    });
    if (res.status === 200 && res.data?.data?.loggedOut === true) {
      return true;
    }
    throw new Error(`Unexpected logout payload: ${JSON.stringify(res.data)}`);
  });

  // 10. Login endpoint -> 200
  await testCase('10. POST /api/auth/login with Admin credentials returns session token', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@medex.org',
      password: 'SuperSecretPassword123',
      role: 'admin',
    });
    if (res.status === 200 && res.data?.data?.token && res.data?.data?.user?.role === 'admin') {
      return true;
    }
    throw new Error(`Unexpected login payload: ${JSON.stringify(res.data)}`);
  });

  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
