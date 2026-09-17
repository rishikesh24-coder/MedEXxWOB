const app = require('./server');
const axios = require('axios');

async function runTests() {
  console.log('\n--- Starting MedEx Backend Verification Tests ---');
  const port = 5001; // test port
  const server = app.listen(port);
  const baseURL = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name} ->`, err.response?.data || err.message);
      failed++;
    }
  };

  try {
    // 1. Health check
    await test('GET /api/health returns healthy MedEx status', async () => {
      const res = await axios.get(`${baseURL}/api/health`);
      if (res.data.product !== 'MedEx' || res.data.status !== 'healthy') {
        throw new Error('Invalid health response');
      }
    });

    // 2. ABDM Status
    await test('GET /api/abdm/status returns ABDM status', async () => {
      const res = await axios.get(`${baseURL}/api/abdm/status`);
      if (!res.data.success || !res.data.data.gatewayBaseUrl) {
        throw new Error('Invalid ABDM response');
      }
    });

    // 3. Admin Login
    let adminToken = '';
    await test('POST /api/auth/login allows Admin login', async () => {
      const res = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'admin@medex.org',
        password: 'Admin@123',
        role: 'admin',
      });
      if (res.data.data.user.role !== 'admin' || !res.data.data.token) {
        throw new Error('Admin login failed');
      }
      adminToken = res.data.data.token;
    });

    // 4. Pending Hospital Login blocked
    await test('POST /api/auth/login blocks pending hospital with PENDING_ADMIN_APPROVAL', async () => {
      try {
        await axios.post(`${baseURL}/api/auth/login`, {
          email: 'metro.care@medex.org',
          password: 'Password@123',
          role: 'hospital',
        });
        throw new Error('Should have blocked pending hospital');
      } catch (err) {
        if (err.response?.status !== 403 || err.response?.data?.error?.code !== 'PENDING_ADMIN_APPROVAL') {
          throw new Error(`Unexpected error: ${JSON.stringify(err.response?.data)}`);
        }
      }
    });

    // 5. Rejected Hospital Login blocked
    await test('POST /api/auth/login blocks rejected hospital with REGISTRATION_REJECTED', async () => {
      try {
        await axios.post(`${baseURL}/api/auth/login`, {
          email: 'city.trauma@medex.org',
          password: 'Password@123',
          role: 'hospital',
        });
        throw new Error('Should have blocked rejected hospital');
      } catch (err) {
        if (err.response?.status !== 403 || err.response?.data?.error?.code !== 'REGISTRATION_REJECTED') {
          throw new Error(`Unexpected error: ${JSON.stringify(err.response?.data)}`);
        }
      }
    });

    // 6. Verified Hospital Login allowed
    let hospitalToken = '';
    await test('POST /api/auth/login allows verified hospital login', async () => {
      const res = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'apollo.mumbai@medex.org',
        password: 'Hospital@123',
        role: 'hospital',
      });
      if (res.data.data.user.role !== 'hospital' || res.data.data.user.status !== 'verified') {
        throw new Error('Hospital login failed');
      }
      hospitalToken = res.data.data.token;
    });

    // 7. Hospital Registration Validation (Missing mandatory fields rejected)
    await test('POST /api/auth/register-hospital blocks submission if mandatory documents/fields missing', async () => {
      try {
        await axios.post(`${baseURL}/api/auth/register-hospital`, {
          name: 'Incomplete Clinic',
          registrationNo: 'REG-9999',
          email: 'incomplete@medex.org',
          documents: [
            { documentType: 'Registration Certificate', documentName: 'Reg.pdf' }
          ]
        });
        throw new Error('Should have failed validation');
      } catch (err) {
        if (err.response?.status !== 400 && err.response?.status !== 422) {
          throw new Error(`Unexpected error: ${JSON.stringify(err.response?.data)}`);
        }
      }
    });

    // 8. Hospital Registration Success (Creates Pending Approval without active session)
    let newHospId = '';
    await test('POST /api/auth/register-hospital creates hospital in PENDING status', async () => {
      const res = await axios.post(`${baseURL}/api/auth/register-hospital`, {
        name: 'Max Super Specialty Hospital',
        registrationNo: `MAX-MUM-${Date.now()}`,
        authorizedPerson: 'Dr. Sunil Kashyap',
        email: `max.pharmacy.${Date.now()}@medex.org`,
        phone: '+91 98200 44556',
        address: 'Sector 19, Vashi',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        pincode: '400703',
        documents: [
          { documentType: 'Registration Certificate', documentName: 'Max_Reg.pdf' },
          { documentType: 'Drug License', documentName: 'Max_DrugLic.pdf' },
          { documentType: 'GST Certificate', documentName: 'Max_GST.pdf' },
          { documentType: 'Authorization Letter', documentName: 'Max_Auth.pdf' },
        ]
      });

      const hospStatus = (res.data.data.hospital?.status || res.data.data.status || '').toLowerCase();
      if (!hospStatus.includes('pending') || res.data.data.token) {
        throw new Error('Registration should result in pending status without session token');
      }
      newHospId = res.data.data.hospital?.id || res.data.data.id;
    });

    // 9. Admin Verification Workflow (Approve Pending Hospital)
    await test('PUT /api/hospital-verification/:id/approve verifies hospital application', async () => {
      const res = await axios.put(
        `${baseURL}/api/hospital-verification/${newHospId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const approvedStatus = (res.data.data?.status || res.data.data?.hospital?.status || '').toLowerCase();
      if (!['verified', 'approved'].includes(approvedStatus)) {
        throw new Error('Hospital verification failed');
      }
    });

    // 10. Non-admin Hospitals directory only shows verified
    await test('GET /api/hospitals for hospital user only lists approved hospitals', async () => {
      const res = await axios.get(`${baseURL}/api/hospitals`, {
        headers: { Authorization: `Bearer ${hospitalToken}` }
      });
      const hasUnverified = res.data.data.some((h) => !['verified', 'approved'].includes((h.status || '').toLowerCase()));
      if (hasUnverified) {
        throw new Error('Non-admin user received unverified hospital in directory');
      }
    });

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  } finally {
    server.close();
    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();
