/**
 * MedEx Phase 11 Step 7: Production CORS Hardening Automated Test Suite
 * 
 * Verifies:
 * 1. Origin normalization (whitespace, trailing slashes, case-insensitivity)
 * 2. Multi-origin comma-separated parsing & empty entry filtering
 * 3. Prohibition of wildcard '*' with credentials
 * 4. Development sensible local defaults (localhost:5173, localhost:3000, 127.0.0.1)
 * 5. Production fail-safe behavior when CORS_ORIGINS is missing or malformed
 * 6. Allowed development origin HTTP handling (200 + credentials + Origin reflection)
 * 7. Allowed production origin HTTP handling (200 + credentials + Origin reflection)
 * 8. Unauthorized origin HTTP rejection (403 + no Access-Control-Allow-Origin header)
 * 9. Server-to-server no-Origin request handling (200 + normal execution)
 * 10. OPTIONS preflight behavior for allowed origins (204 + all preflight headers)
 * 11. OPTIONS preflight rejection for unauthorized origins (403 + no CORS header)
 * 12. Credentials security guarantee (Access-Control-Allow-Origin is never '*')
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { normalizeOrigin, parseCorsOrigins, createCorsOptions, DEFAULT_DEV_ORIGINS } = require('../config/cors');

let totalTests = 0;
let passedTests = 0;

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  [PASS] Test ${totalTests}: ${name}`);
}

function fail(name, error) {
  totalTests++;
  console.error(`  [FAIL] Test ${totalTests}: ${name}`);
  console.error(`         Error: ${error.message || error}`);
}

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createTestApp(corsOptions) {
  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.post('/api/requests', (req, res) => {
    res.status(201).json({ success: true, message: 'Request created' });
  });

  // Centralized Error Handler (matching server.js)
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An error occurred';

    res.status(statusCode).json({
      success: false,
      error: { code, message },
    });
  });

  return app;
}

async function runSuite() {
  console.log('================================================================');
  console.log('  MEDEX PHASE 11 STEP 7: PRODUCTION CORS HARDENING SUITE        ');
  console.log('================================================================\n');

  // --- SECTION 1: ORIGIN NORMALIZATION & PARSING UNIT TESTS ---
  console.log('--- SECTION 1: ORIGIN NORMALIZATION & PARSING ---');

  try {
    const norm1 = normalizeOrigin('  https://app.medex.example.com/  ');
    assert.strictEqual(norm1, 'https://app.medex.example.com', 'Should trim whitespace and strip trailing slash');
    pass('normalizeOrigin: Trims whitespace and strips trailing slashes');
  } catch (e) { fail('normalizeOrigin: Trims whitespace and strips trailing slashes', e); }

  try {
    const norm2 = normalizeOrigin('HTTPS://MEDEX.EXAMPLE.COM:8443/api/v1');
    assert.strictEqual(norm2, 'https://medex.example.com:8443', 'Should lowercase scheme and host, and strip paths');
    pass('normalizeOrigin: Lowercases scheme/host and preserves port while stripping path');
  } catch (e) { fail('normalizeOrigin: Lowercases scheme/host and preserves port while stripping path', e); }

  try {
    const norm3 = normalizeOrigin('invalid-origin-string');
    assert.strictEqual(norm3, null, 'Should return null for non-URL strings');
    const norm4 = normalizeOrigin('javascript:alert(1)');
    assert.strictEqual(norm4, null, 'Should return null for non-http(s) protocols');
    const norm5 = normalizeOrigin('*');
    assert.strictEqual(norm5, null, 'Wildcard * should be rejected by normalizeOrigin');
    pass('normalizeOrigin: Rejects malformed strings, javascript: URIs, and wildcard *');
  } catch (e) { fail('normalizeOrigin: Rejects malformed strings, javascript: URIs, and wildcard *', e); }

  try {
    const parsed = parseCorsOrigins(' https://app.example.com , https://admin.example.com:3000/ ', 'production');
    assert.deepStrictEqual(parsed, ['https://app.example.com', 'https://admin.example.com:3000']);
    pass('parseCorsOrigins: Parses multiple comma-separated origins with whitespace and trailing slashes');
  } catch (e) { fail('parseCorsOrigins: Parses multiple comma-separated origins', e); }

  try {
    const parsed = parseCorsOrigins('https://app.example.com, ,  ,,https://admin.example.com,', 'production');
    assert.deepStrictEqual(parsed, ['https://app.example.com', 'https://admin.example.com']);
    pass('parseCorsOrigins: Safely ignores empty entries and extra commas');
  } catch (e) { fail('parseCorsOrigins: Safely ignores empty entries and extra commas', e); }

  try {
    const parsed = parseCorsOrigins('https://app.example.com, not-a-valid-url, *, https://admin.example.com', 'production');
    assert.deepStrictEqual(parsed, ['https://app.example.com', 'https://admin.example.com']);
    pass('parseCorsOrigins: Strips malformed entries and wildcards without crashing');
  } catch (e) { fail('parseCorsOrigins: Strips malformed entries and wildcards', e); }

  try {
    const devParsed = parseCorsOrigins('', 'development');
    for (const d of DEFAULT_DEV_ORIGINS) {
      assert(devParsed.includes(d), `Development defaults must include ${d}`);
    }
    pass('parseCorsOrigins: Development environment automatically includes local Vite defaults');
  } catch (e) { fail('parseCorsOrigins: Development environment local defaults', e); }

  try {
    const prodMissing = parseCorsOrigins(undefined, 'production');
    assert.deepStrictEqual(prodMissing, [], 'Production with missing CORS_ORIGINS must fail-safe to empty array');
    const prodEmpty = parseCorsOrigins('', 'production');
    assert.deepStrictEqual(prodEmpty, [], 'Production with empty CORS_ORIGINS must fail-safe to empty array');
    const prodMalformedOnly = parseCorsOrigins('invalid, also-invalid', 'production');
    assert.deepStrictEqual(prodMalformedOnly, [], 'Production with only malformed origins must fail-safe to empty array');
    pass('parseCorsOrigins: Production fails safely to empty array when CORS_ORIGINS is missing or invalid');
  } catch (e) { fail('parseCorsOrigins: Production fails safely to empty array', e); }

  // --- SECTION 2: HTTP INTEGRATION & PREFLIGHT TESTS ---
  console.log('\n--- SECTION 2: HTTP INTEGRATION & PREFLIGHT SUITE ---');

  // Server instance A: Development Mode
  const devApp = createTestApp(createCorsOptions({
    nodeEnv: 'development',
    origins: parseCorsOrigins('', 'development'),
  }));
  const devServer = await new Promise((resolve) => {
    const s = devApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  // Server instance B: Production Mode with Configured Origins
  const prodApp = createTestApp(createCorsOptions({
    nodeEnv: 'production',
    origins: parseCorsOrigins('https://app.medex.com,https://admin.medex.com', 'production'),
  }));
  const prodServer = await new Promise((resolve) => {
    const s = prodApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  // Server instance C: Production Mode with Missing Origins (Fail-Safe)
  const prodEmptyApp = createTestApp(createCorsOptions({
    nodeEnv: 'production',
    origins: parseCorsOrigins(undefined, 'production'),
  }));
  const prodEmptyServer = await new Promise((resolve) => {
    const s = prodEmptyApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    // 9. Allowed development origin (localhost:5173)
    const res = await makeRequest(devServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    assert(res.headers['vary'] && res.headers['vary'].includes('Origin'));
    pass('HTTP: Allowed development origin (http://localhost:5173) succeeds with CORS credentials');
  } catch (e) { fail('HTTP: Allowed development origin', e); }

  try {
    // 10. Allowed secondary development origin (localhost:3000)
    const res = await makeRequest(devServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    pass('HTTP: Allowed secondary development origin (http://localhost:3000) succeeds');
  } catch (e) { fail('HTTP: Allowed secondary development origin', e); }

  try {
    // 11. Unauthorized origin in development
    const res = await makeRequest(devServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://attacker.evil.com' },
    });
    assert.strictEqual(res.statusCode, 403, 'Unauthorized origin must be rejected with 403');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined, 'Must not return Access-Control-Allow-Origin');
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error.code, 'CORS_NOT_ALLOWED');
    pass('HTTP: Unauthorized origin in development is rejected cleanly with 403 Forbidden');
  } catch (e) { fail('HTTP: Unauthorized origin in development', e); }

  try {
    // 12. Allowed configured production origin
    const res = await makeRequest(prodServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://app.medex.com' },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://app.medex.com');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    pass('HTTP: Configured production origin (https://app.medex.com) succeeds with credentials');
  } catch (e) { fail('HTTP: Configured production origin succeeds', e); }

  try {
    // 13. Second allowed production origin
    const res = await makeRequest(prodServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://admin.medex.com' },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://admin.medex.com');
    pass('HTTP: Multiple production origins: second origin (https://admin.medex.com) succeeds');
  } catch (e) { fail('HTTP: Multiple production origins', e); }

  try {
    // 14. Localhost origin rejected in production mode
    const res = await makeRequest(prodServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.strictEqual(res.statusCode, 403, 'Localhost must be rejected in production');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    pass('HTTP: Localhost origin is strictly blocked in production mode');
  } catch (e) { fail('HTTP: Localhost origin is strictly blocked in production', e); }

  try {
    // 15. Production with missing CORS_ORIGINS rejects all browser origins
    const res = await makeRequest(prodEmptyServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://app.medex.com' },
    });
    assert.strictEqual(res.statusCode, 403, 'Missing CORS_ORIGINS must reject browser origins');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    pass('HTTP: Production with missing CORS_ORIGINS fails safely by rejecting browser origins');
  } catch (e) { fail('HTTP: Production with missing CORS_ORIGINS fails safely', e); }

  try {
    // 16. Server-to-server request with no Origin header
    const res = await makeRequest(prodServer, {
      path: '/api/health',
      method: 'GET',
      headers: {}, // No Origin header
    });
    assert.strictEqual(res.statusCode, 200, 'Requests without Origin header must succeed');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.status, 'healthy');
    pass('HTTP: Server-to-server / health check request with no Origin header succeeds cleanly');
  } catch (e) { fail('HTTP: Server-to-server request with no Origin header', e); }

  try {
    // 17. OPTIONS preflight for allowed origin
    const res = await makeRequest(prodServer, {
      path: '/api/requests',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.medex.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization,X-Requested-With',
      },
    });
    assert.strictEqual(res.statusCode, 204, 'Preflight for allowed origin should return 204');
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://app.medex.com');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    assert(res.headers['access-control-allow-methods'], 'Should include allowed methods');
    assert(res.headers['access-control-allow-headers'], 'Should include allowed headers');
    pass('HTTP: Preflight OPTIONS for allowed origin returns 204 with complete CORS headers');
  } catch (e) { fail('HTTP: Preflight OPTIONS for allowed origin', e); }

  try {
    // 18. OPTIONS preflight for unauthorized origin
    const res = await makeRequest(prodServer, {
      path: '/api/requests',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert.strictEqual(res.statusCode, 403, 'Preflight for unauthorized origin must return 403');
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined, 'No allow-origin header on preflight rejection');
    pass('HTTP: Preflight OPTIONS for unauthorized origin is rejected with 403 Forbidden');
  } catch (e) { fail('HTTP: Preflight OPTIONS for unauthorized origin', e); }

  try {
    // 19. Credentials security check: Access-Control-Allow-Origin is never wildcard '*'
    const res = await makeRequest(prodServer, {
      path: '/api/health',
      method: 'GET',
      headers: { Origin: 'https://app.medex.com' },
    });
    assert.notStrictEqual(res.headers['access-control-allow-origin'], '*', 'Origin must NEVER be wildcard * with credentials');
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://app.medex.com');
    pass('HTTP: Access-Control-Allow-Origin is never wildcard "*" when credentials are true');
  } catch (e) { fail('HTTP: Access-Control-Allow-Origin is never wildcard *', e); }

  // Cleanup test servers
  await new Promise((r) => devServer.close(r));
  await new Promise((r) => prodServer.close(r));
  await new Promise((r) => prodEmptyServer.close(r));

  console.log('\n================================================================');
  console.log(`  CORS VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('\n>> ALL PRODUCTION CORS HARDENING TESTS COMPLETED SUCCESSFULLY! <<\n');
    process.exit(0);
  } else {
    console.error(`\n>> ${totalTests - passedTests} TESTS FAILED! <<\n`);
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
