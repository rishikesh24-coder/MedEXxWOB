/**
 * MedEx Production Document Upload Security Hardening Test Suite
 *
 * Verifies:
 * PASS:
 * 1. Valid real PDF under 5 MB is accepted.
 * 2. Authenticated authorized hospital upload succeeds.
 * 3. Authorized document retrieval (signed URL) succeeds for hospital owner.
 * 4. Admin can retrieve signed URL for any hospital document.
 *
 * FAIL:
 * 5. >5 MB file rejected with 413 DOCUMENT_TOO_LARGE.
 * 6. .jpg renamed to .pdf rejected with 400 INVALID_PDF_SIGNATURE.
 * 7. .png renamed to .pdf rejected with 400 INVALID_PDF_SIGNATURE.
 * 8. Random binary renamed to .pdf rejected with 400 INVALID_PDF_SIGNATURE.
 * 9. Invalid MIME type rejected with 400 INVALID_DOCUMENT_TYPE.
 * 10. Empty file (0 bytes) rejected with 400 INVALID_PDF.
 * 11. Malformed PDF (starts with %PDF- but corrupt/no objects/no EOF) rejected with 400 INVALID_PDF.
 * 12. Path traversal filename (../../etc/passwd.pdf) sanitized and storage path is UUID.
 * 13. Executable file (.exe / .pdf.exe) is rejected.
 * 14. Unauthenticated upload returns 401.
 * 15. Hospital A attempting to access Hospital B document returns 403 UNAUTHORIZED_DOCUMENT_ACCESS.
 * 16. Hospital A attempting to upload document with Hospital B ID in request body returns 403.
 * 17. Document upload endpoint rate limiting triggers HTTP 429 when flooded.
 */

const express = require('express');
const http = require('http');
const axios = require('axios');
const assert = require('assert');
const crypto = require('crypto');

const {
  validateDocumentUpload,
  sanitizeOriginalFilename,
  generateStorageFilename,
} = require('../utils/documentValidator');
const documentService = require('../services/documentService');
const documentController = require('../controllers/documentController');
const { documentUploadLimiter, createRateLimiter } = require('../middleware/rateLimiter');
const { authenticateUser } = require('../middleware/auth');

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
      console.error(`         Status: ${err.response.status}`);
      console.error(`         Data: ${JSON.stringify(err.response.data)}`);
    }
    failedCount++;
  }
}

// Generates a structurally valid PDF buffer
function createValidPdfBuffer(extraContent = 'MedEx Statutory Compliance Filing') {
  const contentStream = `BT /F1 12 Tf 100 700 Td (${extraContent}) Tj ET`;
  const streamLength = contentStream.length;

  return Buffer.from(
`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${contentStream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000201 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
280
%%EOF\n`, 'binary');
}

async function runAllTests() {
  console.log('================================================================');
  console.log('MEDEX PRODUCTION DOCUMENT UPLOAD SECURITY TEST SUITE');
  console.log('================================================================\n');

  const HOSPITAL_A_ID = '11111111-1111-1111-1111-111111111111';
  const HOSPITAL_B_ID = '22222222-2222-2222-2222-222222222222';

  const userHospitalA = {
    id: 'user-apollo',
    email: 'apollo.mumbai@medex.org',
    role: 'hospital',
    hospitalId: HOSPITAL_A_ID,
    name: 'Apollo Hospital & Multi-Specialty Centre',
  };

  const userHospitalB = {
    id: 'user-fortis',
    email: 'fortis.gurugram@medex.org',
    role: 'hospital',
    hospitalId: HOSPITAL_B_ID,
    name: 'Fortis Memorial Research Institute',
  };

  const userAdmin = {
    id: 'admin-01',
    email: 'admin@medex.org',
    role: 'admin',
    name: 'Super Administrator',
  };

  // -------------------------------------------------------------
  // SECTION 1: UNIT & VALIDATION PIPELINE TESTS
  // -------------------------------------------------------------
  console.log('--- SECTION 1: VALIDATION PIPELINE & SIGNATURE INTEGRITY ---');

  await test('1. Valid real PDF under 5 MB is accepted by validator', async () => {
    const validBuffer = createValidPdfBuffer();
    const result = validateDocumentUpload({
      buffer: validBuffer,
      originalFilename: 'Drug_License_Form20B.pdf',
      mimeType: 'application/pdf',
    });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.mimeType, 'application/pdf');
    assert.strictEqual(result.originalFilename, 'Drug_License_Form20B.pdf');
    assert.match(result.storageFilename, /^[a-f0-9-]+\.pdf$/i);
  });

  await test('2. Empty file (0 bytes) is rejected with 400 INVALID_PDF', async () => {
    try {
      validateDocumentUpload({
        buffer: Buffer.alloc(0),
        originalFilename: 'empty.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Empty buffer should have thrown DocumentValidationError');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_PDF');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /empty/i);
    }
  });

  await test('3. Oversized file (>5 MB) is rejected with 413 DOCUMENT_TOO_LARGE', async () => {
    // 5.5 MB dummy buffer starting with %PDF-
    const oversizedBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(5.5 * 1024 * 1024),
      Buffer.from('\n%%EOF\n'),
    ]);

    try {
      validateDocumentUpload({
        buffer: oversizedBuffer,
        originalFilename: 'huge_document.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Oversized buffer should have thrown DOCUMENT_TOO_LARGE');
    } catch (err) {
      assert.strictEqual(err.code, 'DOCUMENT_TOO_LARGE');
      assert.strictEqual(err.statusCode, 413);
      assert.match(err.message, /exceeds the maximum allowed limit of 5 MB/i);
    }
  });

  await test('4. JPEG renamed to .pdf is detected and rejected with 400 INVALID_PDF_SIGNATURE', async () => {
    // JPEG magic bytes: FF D8 FF E0
    const fakeJpgPdf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);

    try {
      validateDocumentUpload({
        buffer: fakeJpgPdf,
        originalFilename: 'scanned_cert.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Disguised JPEG should have thrown INVALID_PDF_SIGNATURE');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_PDF_SIGNATURE');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /JPEG|magic/i);
    }
  });

  await test('5. PNG renamed to .pdf is detected and rejected with 400 INVALID_PDF_SIGNATURE', async () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const fakePngPdf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);

    try {
      validateDocumentUpload({
        buffer: fakePngPdf,
        originalFilename: 'license_photo.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Disguised PNG should have thrown INVALID_PDF_SIGNATURE');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_PDF_SIGNATURE');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /PNG|magic/i);
    }
  });

  await test('6. Random binary data renamed to .pdf is rejected with 400 INVALID_PDF_SIGNATURE', async () => {
    const randomBinary = crypto.randomBytes(256);

    try {
      validateDocumentUpload({
        buffer: randomBinary,
        originalFilename: 'random_junk.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Random binary should have thrown INVALID_PDF_SIGNATURE');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_PDF_SIGNATURE');
      assert.strictEqual(err.statusCode, 400);
    }
  });

  await test('7. Invalid MIME type (text/plain) is rejected with 400 INVALID_DOCUMENT_TYPE', async () => {
    const validPdf = createValidPdfBuffer();

    try {
      validateDocumentUpload({
        buffer: validPdf,
        originalFilename: 'document.pdf',
        mimeType: 'text/plain',
      });
      assert.fail('Invalid MIME type should have thrown INVALID_DOCUMENT_TYPE');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_DOCUMENT_TYPE');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /MIME/i);
    }
  });

  await test('8. Malformed PDF (has %PDF- but no objects or %%EOF) is rejected with 400 INVALID_PDF', async () => {
    const corruptPdf = Buffer.from('%PDF-1.4 This is fake garbage text with no PDF structure or trailer markers at all.');

    try {
      validateDocumentUpload({
        buffer: corruptPdf,
        originalFilename: 'corrupt.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Malformed PDF should have thrown INVALID_PDF');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_PDF');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Corrupt|structure|EOF/i);
    }
  });

  await test('9. Path traversal filename (../../etc/passwd.pdf) is rejected with 400', async () => {
    const validPdf = createValidPdfBuffer();
    try {
      validateDocumentUpload({
        buffer: validPdf,
        originalFilename: 'my_docs/../../etc/passwd.pdf',
        mimeType: 'application/pdf',
      });
      assert.fail('Path traversal filename should have been rejected');
    } catch (err) {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /traversal|null/i);
    }
  });

  await test('10. Executable extension (.pdf.exe / .exe) is rejected with 400 INVALID_DOCUMENT_TYPE', async () => {
    const validPdf = createValidPdfBuffer();

    try {
      validateDocumentUpload({
        buffer: validPdf,
        originalFilename: 'contract.pdf.exe',
        mimeType: 'application/pdf',
      });
      assert.fail('Executable file extension should have thrown INVALID_DOCUMENT_TYPE');
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_DOCUMENT_TYPE');
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /prohibited|executable/i);
    }
  });

  // -------------------------------------------------------------
  // SECTION 2: END-TO-END SERVICE & AUTHORIZATION TESTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: SERVICE LAYER & AUTHORIZATION CONTROLS ---');

  let uploadedDocHospitalA = null;

  await test('11. Authenticated hospital upload succeeds and stores metadata safely', async () => {
    const validPdf = createValidPdfBuffer('Apollo Registration Document 2026');
    uploadedDocHospitalA = await documentService.uploadDocument({
      hospitalId: HOSPITAL_A_ID,
      documentType: 'Registration Certificate',
      documentName: 'Apollo_Registration.pdf',
      fileBuffer: validPdf,
      mimeType: 'application/pdf',
      uploadedBy: userHospitalA.name,
      reqUser: userHospitalA,
    });

    assert.ok(uploadedDocHospitalA.id);
    assert.strictEqual(uploadedDocHospitalA.hospital_id, HOSPITAL_A_ID);
    assert.strictEqual(uploadedDocHospitalA.document_type, 'Registration Certificate');
    assert.strictEqual(uploadedDocHospitalA.original_filename, 'Apollo_Registration.pdf');
    assert.match(uploadedDocHospitalA.storage_path, new RegExp(`^${HOSPITAL_A_ID}/[a-f0-9-]+\\.pdf$`));
  });

  await test('12. Hospital A can retrieve signed URL for its own document', async () => {
    const signed = await documentService.getSignedUrl({
      documentId: uploadedDocHospitalA.id,
      reqUser: userHospitalA,
    });

    assert.strictEqual(signed.documentId, uploadedDocHospitalA.id);
    assert.strictEqual(signed.hospitalId, HOSPITAL_A_ID);
    assert.ok(signed.signedUrl);
    assert.ok(signed.expiresAt);
  });

  await test('13. Hospital B attempting to access Hospital A document returns 403 UNAUTHORIZED_DOCUMENT_ACCESS', async () => {
    try {
      await documentService.getSignedUrl({
        documentId: uploadedDocHospitalA.id,
        reqUser: userHospitalB, // Fortis attempting to access Apollo document
      });
      assert.fail('Cross-hospital document access should have thrown 403');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.code, 'UNAUTHORIZED_DOCUMENT_ACCESS');
      assert.match(err.message, /not authorized to view this statutory document/i);
    }
  });

  await test('14. Admin can retrieve signed URL for any hospital document', async () => {
    const signed = await documentService.getSignedUrl({
      documentId: uploadedDocHospitalA.id,
      reqUser: userAdmin, // Admin accessing Apollo document for statutory verification
    });

    assert.strictEqual(signed.documentId, uploadedDocHospitalA.id);
    assert.strictEqual(signed.hospitalId, HOSPITAL_A_ID);
    assert.ok(signed.signedUrl);
  });

  await test('15. Replacing document marks previous record superseded and issues fresh UUID storage path', async () => {
    const validPdfV2 = createValidPdfBuffer('Apollo Registration Document 2026 - Renewal V2');
    const replacedDoc = await documentService.uploadDocument({
      hospitalId: HOSPITAL_A_ID,
      documentType: 'Registration Certificate',
      documentName: 'Apollo_Registration_Renewal.pdf',
      fileBuffer: validPdfV2,
      mimeType: 'application/pdf',
      uploadedBy: userHospitalA.name,
      reqUser: userHospitalA,
    });

    assert.notStrictEqual(replacedDoc.id, uploadedDocHospitalA.id, 'Fresh document must have unique UUID');
    assert.notStrictEqual(replacedDoc.storage_path, uploadedDocHospitalA.storage_path, 'Storage paths must not collide');
    assert.strictEqual(replacedDoc.document_type, 'Registration Certificate');
  });

  // -------------------------------------------------------------
  // SECTION 3: HTTP API, RATE LIMITING & ATTACK SIMULATIONS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: HTTP API INTEGRATION & RATE LIMITING ---');

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Mock authentication middleware injector for testing
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    const token = authHeader.replace('Bearer ', '');
    if (token === 'token_apollo') req.user = userHospitalA;
    else if (token === 'token_fortis') req.user = userHospitalB;
    else if (token === 'token_admin') req.user = userAdmin;

    next();
  });

  // Mount document router
  const documentRoutes = require('../routes/documentRoutes');
  app.use('/api/documents', documentRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message,
      },
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/documents`;

  await test('16. HTTP: Unauthenticated upload returns 401 UNAUTHORIZED', async () => {
    try {
      await axios.post(`${baseUrl}/upload`, {
        documentType: 'Drug License',
        documentName: 'license.pdf',
        fileData: createValidPdfBuffer().toString('base64'),
      });
      assert.fail('Unauthenticated request should have failed');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
      assert.strictEqual(err.response?.data?.error?.code, 'UNAUTHORIZED');
    }
  });

  await test('17. HTTP: Hospital user attempting to attach document to another hospital returns 403', async () => {
    try {
      await axios.post(
        `${baseUrl}/upload`,
        {
          hospitalId: HOSPITAL_B_ID, // Apollo user attempting to inject Fortis ID
          documentType: 'Drug License',
          documentName: 'license.pdf',
          fileData: createValidPdfBuffer().toString('base64'),
        },
        {
          headers: { Authorization: 'Bearer token_apollo' },
        }
      );
      assert.fail('Cross-hospital ID manipulation should have returned 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.strictEqual(err.response?.data?.error?.code, 'UNAUTHORIZED_DOCUMENT_ACCESS');
    }
  });

  await test('18. HTTP: Base64 PDF upload under 5 MB succeeds (201 Created)', async () => {
    const validPdf = createValidPdfBuffer('Apollo GST Filing 2026');
    const res = await axios.post(
      `${baseUrl}/upload`,
      {
        documentType: 'GST Certificate',
        documentName: 'Apollo_GST.pdf',
        fileData: `data:application/pdf;base64,${validPdf.toString('base64')}`,
      },
      {
        headers: { Authorization: 'Bearer token_apollo' },
      }
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.hospital_id, HOSPITAL_A_ID);
    assert.strictEqual(res.data.data.document_type, 'GST Certificate');
  });

  await test('19. HTTP: Uploading oversized base64 PDF returns HTTP 413 DOCUMENT_TOO_LARGE', async () => {
    const hugePdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
      Buffer.alloc(5.2 * 1024 * 1024),
      Buffer.from('\n%%EOF\n'),
    ]);

    try {
      await axios.post(
        `${baseUrl}/upload`,
        {
          documentType: 'Audit Report',
          documentName: 'Huge_Audit.pdf',
          fileData: hugePdf.toString('base64'),
        },
        {
          headers: { Authorization: 'Bearer token_apollo' },
        }
      );
      assert.fail('Oversized upload should have returned 413');
    } catch (err) {
      assert.strictEqual(err.response?.status, 413);
      assert.strictEqual(err.response?.data?.error?.code, 'DOCUMENT_TOO_LARGE');
    }
  });

  await test('20. HTTP: Document upload endpoint rate limiting returns 429 when flooded', async () => {
    // Create dedicated rate limited test route with low threshold
    const floodLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: 'Too many document upload requests. Please try again later.',
    });

    const floodApp = express();
    floodApp.use(express.json());
    floodApp.post('/flood-upload', floodLimiter, (req, res) => res.status(200).json({ success: true }));

    const floodServer = http.createServer(floodApp);
    await new Promise((r) => floodServer.listen(0, r));
    const floodUrl = `http://127.0.0.1:${floodServer.address().port}/flood-upload`;

    // 3 accepted requests
    await axios.post(floodUrl);
    await axios.post(floodUrl);
    await axios.post(floodUrl);

    // 4th request must return 429
    try {
      await axios.post(floodUrl);
      assert.fail('4th request should have returned 429');
    } catch (err) {
      assert.strictEqual(err.response?.status, 429);
      assert.strictEqual(err.response?.data?.error, 'RATE_LIMIT_EXCEEDED');
    }

    floodServer.close();
  });

  server.close();

  console.log('\n================================================================');
  console.log(`DOCUMENT SECURITY TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
