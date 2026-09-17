# MedEx Security Architecture & Hardening Guide

> **IMPORTANT DISCLAIMER**  
> **MedEx is currently a frontend-first React/Vite prototype.**  
> All authentication sessions, role-based checks, audit logs, and transaction records currently run within client-side memory and browser `localStorage`.  
> **THIS DEMONSTRATION ENVIRONMENT IS NOT PRODUCTION READY, DOES NOT CLAIM HIPAA OR DISHA COMPLIANCE, DOES NOT PROCESS REAL BANKING TRANSACTIONS, AND CONTAINS STRICTLY SYNTHETIC DEMONSTRATION DATA (NO REAL PATIENT OR HEALTHCARE CLINICAL INFORMATION).**  
>  
> The client-side safeguards implemented in this repository serve to prevent common client vulnerabilities, demonstrate secure UI/UX patterns, defend against state tampering, and establish clean interfaces for backend integration. For production deployment, **authoritative enforcement must reside on a hardened backend server and API gateway.**

---

## Table of Contents

1. [Security Architecture & Trust Boundaries](#1-security-architecture--trust-boundaries)
2. [Authentication: Prototype vs Production](#2-authentication-prototype-vs-production)
3. [Session Storage & Token Security](#3-session-storage--token-security)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [Input Validation & Defense-in-Depth](#5-input-validation--defense-in-depth)
6. [State Integrity & Business Rule Enforcement](#6-state-integrity--business-rule-enforcement)
7. [Cross-Site Scripting (XSS) Mitigation](#7-cross-site-scripting-xss-mitigation)
8. [Cross-Site Request Forgery (CSRF) Mitigation](#8-cross-site-request-forgery-csrf-mitigation)
9. [Recommended Content Security Policy (CSP)](#9-recommended-content-security-policy-csp)
10. [Recommended HTTP Security Headers](#10-recommended-http-security-headers)
11. [API Rate Limiting & Throttling](#11-api-rate-limiting--throttling)
12. [Multi-Tenancy & Database Access Controls](#12-multi-tenancy--database-access-controls)
13. [Audit Trails & Regulatory Non-Repudiation](#13-audit-trails--regulatory-non-repudiation)
14. [Healthcare & Regulatory Compliance (CDSCO / DISHA)](#14-healthcare--regulatory-compliance-cdsco--disha)
15. [Third-Party Dependency Audit & Maintenance](#15-third-party-dependency-audit--maintenance)
16. [Production Deployment Checklist](#16-production-deployment-checklist)
17. [Responsible Vulnerability Disclosure Policy](#17-responsible-vulnerability-disclosure-policy)

---

## 1. Security Architecture & Trust Boundaries

The core security principle governing this application is **Zero Client Trust**:
```
┌────────────────────────────────────────────────────────┐
│               UNTRUSTED CLIENT REALM                   │
│  React SPA (Vite)                                     │
│  - UX validation, input sanitization                   │
│  - Role-based UI rendering (Sidebar, Actions)         │
│  - Fault isolation (React ErrorBoundaries)            │
│  - Self-healing localStorage parsing                  │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (TLS 1.3)
                           │ HttpOnly SameSite=Strict Cookies
                           ▼
┌────────────────────────────────────────────────────────┐
│                TRUSTED BACKEND REALM                   │
│  API Gateway / WAF (Cloudflare / Kong / AWS API GW)    │
│  - Rate Limiting, DDoS shielding, TLS termination      │
│  - IP reputation & Geo-fencing                        │
│                                                        │
│  Application Services (Node.js / Go / Java)           │
│  - Authoritative Schema Validation (Zod / Joi)         │
│  - Cryptographic Session & JWT Verification            │
│  - Server-Side RBAC & ABAC Access Evaluation           │
│  - Transaction ACID Locks & Atomic State Transitions   │
│                                                        │
│  Database Layer (PostgreSQL / Redis)                   │
│  - Row-Level Security (RLS) tenant isolation          │
│  - Immutable, Append-Only Audit Logging               │
│  - Encrypted At Rest (AES-256)                         │
└────────────────────────────────────────────────────────┘
```

- **Client Responsibility:** Provide seamless UX, instant feedback, optimistic updates, fault isolation, and prevent accidental malformed data submissions.
- **Server Responsibility:** Authoritatively validate every payload, authenticate every request, evaluate role permissions, enforce multi-tenant isolation, and guarantee state transition finality.

---

## 2. Authentication: Prototype vs Production

### Current Prototype Implementation
- Authenticates against simulated credential stores (`sms_auth_session` in `localStorage`).
- Features role separation: `hospital` and `admin` (supervisory authority).
- Credentials are stripped immediately upon login; passwords and tokens are never preserved in the user session object.
- Session structures are validated on every boot via `validateSession()`; malformed or tampered sessions are immediately purged and the user is redirected safely to `/login`.
- Audit logs record all authentication attempts, successes, and logouts (`AUTH_LOGIN`, `AUTH_LOGOUT`).

### Production Authentication Roadmap
1. **Protocol:** Modern OpenID Connect (OIDC) / OAuth 2.0 with Authorization Code Flow + Proof Key for Code Exchange (PKCE).
2. **Identity Providers:** Enterprise SAML 2.0 / OIDC integrations for hospital Active Directory, Okta, or Keycloak.
3. **Multi-Factor Authentication (MFA):** Mandatory Time-based One-Time Password (TOTP) or FIDO2/WebAuthn hardware security keys for all hospital pharmacy officers and supervisory admins.
4. **Brute Force Protection:** Account lockout policies after 5 failed attempts with exponential backoff and IP-level captcha challenges.

---

## 3. Session Storage & Token Security

### The Problem with Browser `localStorage`
While convenient for rapid prototypes, storing access tokens or sensitive credentials in browser `localStorage` or `sessionStorage` exposes them to theft if any Cross-Site Scripting (XSS) vulnerability exists anywhere on the domain.

### Production Session Standard
```
┌─────────────────────────┬───────────────────────────────┬──────────────────────────────┐
│ Token Type              │ Storage Mechanism             │ Lifespan & Rotation          │
├─────────────────────────┼───────────────────────────────┼──────────────────────────────┤
│ Access Token            │ Private In-Memory JS Variable │ Short (5 - 15 minutes)       │
│ Refresh Token           │ HttpOnly, Secure, SameSite    │ 24 hours with automatic      │
│                         │ HTTP Cookie                   │ rotation on every refresh    │
└─────────────────────────┴───────────────────────────────┴──────────────────────────────┘
```

- **Cookie Flags Required:**
  - `HttpOnly`: Inaccessible via JavaScript `document.cookie`, defeating XSS token exfiltration.
  - `Secure`: Transmitted only over encrypted TLS (HTTPS) connections.
  - `SameSite=Strict`: Completely suppresses cookie transmission on cross-site requests, mitigating CSRF.
  - `Path=/api/v1/auth/refresh`: Restricts cookie visibility exclusively to the refresh endpoint.

---

## 4. Role-Based Access Control (RBAC)

Access control rules are centralized in [`src/utils/rbac.js`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/utils/rbac.js) and applied across routing, navigation, and page actions.

### Client-Side RBAC Matrix

| Role | Admin Portal | Hospital Marketplace | Hospital Inventory | Biowaste Disposal | Approve Requests |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **HOSPITAL** | ❌ Blocked | ✅ Full Access | ✅ Hospital-Scoped | ✅ Hospital-Scoped | ✅ Provider-Scoped |
| **ADMIN** | ✅ Supervisory View | ❌ View Only | ❌ View Only | ❌ View Only | ❌ Blocked |
| **GUEST** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |

### Enforcement Points in Code
1. **Navigation:** [`ProtectedRoute.jsx`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/components/common/ProtectedRoute.jsx) evaluates `hasRequiredRole()` before rendering child views. Unauthorized role access triggers a descriptive toast notice and redirects to the user's appropriate default dashboard.
2. **UI Controls:** [`Sidebar.jsx`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/components/common/Sidebar.jsx) filters visible navigation links based on user role.
3. **Backend Requirement:** In production, every API route must independently verify the JWT claims:
   ```javascript
   // Production Express/Fastify Middleware Example
   const requireRole = (allowedRoles) => (req, res, next) => {
     if (!req.user || !allowedRoles.includes(req.user.role)) {
       return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient role permissions' });
     }
     next();
   };
   ```

---

## 5. Input Validation & Defense-in-Depth

All user inputs pass through centralized validation and sanitization utilities in [`src/utils/validation.js`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/utils/validation.js).

### Implemented Validation Safeguards
- **Quantity & Price Validation:**
  - `validateQuantity`: Enforces integer values, strictly $> 0$, and caps single transaction quantities at realistic thresholds (e.g. 100,000 units).
  - `validatePrice`: Rejects negative values, non-numeric strings, and verifies realistic unit pricing ($> ₹0$).
- **Pharmaceutical Lot Date Rules:**
  - `validateDates`: Validates that Manufacturing Date $\le$ Expiration Date, and strictly blocks listing expired stock as active/usable inventory.
- **Search & Text Sanitization:**
  - `sanitizeText` & `sanitizeSearchInput`: Strips HTML tags, trims whitespace, and limits text length to prevent DOM injection and memory abuse.
- **Requisition Validation:**
  - `validateRequisition`: Validates quantity $> 0$, verifies stock availability, checks expiration date, and blocks self-trading.

### Production Schema Validation (Backend)
The backend must re-validate all inputs using an authoritative schema parser (such as Zod):
```typescript
import { z } from 'zod';

export const MedicineSubmissionSchema = z.object({
  brandName: z.string().trim().min(2).max(100),
  genericName: z.string().trim().min(2).max(150),
  batchNo: z.string().trim().regex(/^[A-Z0-9\-\/]{3,30}$/i, 'Invalid batch format'),
  quantity: z.number().int().positive().max(100000),
  mfgDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unitOriginalPrice: z.number().positive().max(1000000),
}).refine(data => new Date(data.mfgDate) <= new Date(data.expiryDate), {
  message: 'Manufacturing date must precede expiry date',
  path: ['expiryDate'],
});
```

---

## 6. State Integrity & Business Rule Enforcement

Pharmaceutical supply chains demand strict state transition invariants:

### A. Immutable Biowaste Destruction
- When an expired batch is flagged for biomedical disposal via [`HospitalWasteManagement.jsx`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/pages/hospital/HospitalWasteManagement.jsx) or [`hospitalService.js`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/services/hospitalService.js), its status transitions permanently to `disposed`.
- `usableQuantity` is immediately set to `0`.
- The batch is permanently locked: edits, stock increments, reactivation, and requisitions are unconditionally blocked.

### B. Request Workflow State Machine
- Inter-hospital requisitions follow a strict finite state machine:
  ```
  [PENDING] ────► [ACCEPTED] ────► [PAYMENT_ESCROWED] ────► [IN_TRANSIT] ────► [FULFILLED]
     │
     └────────► [REJECTED]
  ```
- Terminal states (`ACCEPTED`, `REJECTED`) are strictly immutable. Double-deciding or reverting an already decided request is programmatically rejected.

### C. Self-Trading Prevention
- A hospital node is prevented from purchasing or requisitioning its own listed inventory.
- Validated at both the UI layer ([`Marketplace.jsx`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/pages/hospital/Marketplace.jsx)) and service layer ([`hospitalService.js`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/services/hospitalService.js)).

---

## 7. Cross-Site Scripting (XSS) Mitigation

1. **JSX Auto-Escaping:** React natively escapes variable content in JSX text nodes (`<div>{userInput}</div>`), mitigating simple HTML injection.
2. **Zero `dangerouslySetInnerHTML`:** The codebase has been audited and contains zero instances of `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, or `document.write`.
3. **Zero Dynamic Evaluation:** No `eval()`, `new Function()`, or `setTimeout("string")` constructs exist in the project.
4. **Link Sanitization:** All anchor tags with external links include `rel="noopener noreferrer"` and `target="_blank"` to protect against `window.opener` tabnabbing.

---

## 8. Cross-Site Request Forgery (CSRF) Mitigation

Because this is a frontend prototype communicating with local state, CSRF is not currently exploitable. However, the production backend must enforce:
1. **SameSite Cookies:** Set `SameSite=Strict` (or `SameSite=Lax` for top-level navigation) on all authentication cookies.
2. **Anti-CSRF Tokens:** For state-changing operations (`POST`, `PUT`, `DELETE`, `PATCH`), issue a cryptographically random anti-CSRF token via a `X-CSRF-Token` header (Double-Submit Cookie or Synchronizer Token Pattern).
3. **Origin & Referer Verification:** Verify that the incoming `Origin` and `Referer` HTTP headers match the expected trusted frontend domain.

---

## 9. Recommended Content Security Policy (CSP)

When serving the built application in production, configure the web server or CDN (Nginx, Caddy, Cloudflare) with the following strict CSP:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com; connect-src 'self' https://api.medex.in; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;
```

### Policy Breakdown
- `default-src 'self'`: Only load resources from the origin domain by default.
- `script-src 'self'`: Disallow inline scripts and `eval()`.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`: Allow Google Fonts stylesheets and Tailwind generated styles.
- `font-src 'self' https://fonts.gstatic.com data:`: Allow Google Fonts and embedded data fonts.
- `img-src 'self' data: blob: https://images.unsplash.com`: Allow local assets, SVG data URIs, and medicine photo mock assets.
- `frame-ancestors 'none'`: Completely prevent embedding in `<iframe>` tags, mitigating clickjacking.
- `object-src 'none'`: Disable Flash, Java applets, and other obsolete plugins.
- `upgrade-insecure-requests`: Automatically upgrade HTTP requests to HTTPS.

---

## 10. Recommended HTTP Security Headers

In addition to CSP, production web servers must return the following security headers on every response:

```http
# Strict Transport Security (HSTS) - enforce TLS for 1 year including subdomains
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Prevent MIME sniffing attacks
X-Content-Type-Options: nosniff

# Legacy clickjacking protection for older browsers
X-Frame-Options: DENY

# Control referrer leakage
Referrer-Policy: strict-origin-when-cross-origin

# Restrict sensitive browser APIs
Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()

# Isolate cross-origin browsing contexts
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

*Note: The local Vite dev server and preview server have been configured in `vite.config.js` with development-compatible subsets of these headers (`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, and `Permissions-Policy`).*

---

## 11. API Rate Limiting & Throttling

To protect backend APIs from brute force attacks, scraping, and denial-of-service, implement layered rate limiting:

1. **Edge / WAF Layer:**
   - 100 requests per minute per IP for general browsing.
   - 5 requests per minute per IP on authentication endpoints (`/api/v1/auth/login`).
2. **Application Layer:**
   - Token bucket algorithm keyed by authenticated `hospital_id` (e.g. 300 requests/min for standard hospital nodes).
   - Specialized throttles on requisition creation and inventory imports (max 20 creations per minute).

---

## 12. Multi-Tenancy & Database Access Controls

In a production inter-hospital network, tenant boundaries must be strictly isolated at the database level:

```sql
-- PostgreSQL Row-Level Security (RLS) Example
ALTER TABLE hospital_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY hospital_inventory_isolation ON hospital_inventory
  FOR ALL
  USING (hospital_id = current_setting('app.current_hospital_id')::uuid);

CREATE POLICY admin_supervisory_read ON hospital_inventory
  FOR SELECT
  USING (current_setting('app.user_role') = 'ADMIN');
```

- Every database query must include the authenticated tenant context.
- Admin users should only possess read-only supervisory access, never direct write access to hospital inventory records without cryptographic audit authorization.

---

## 13. Audit Trails & Regulatory Non-Repudiation

Under CDSCO (Central Drugs Standard Control Organisation) Rule 65 and the Bio-Medical Waste Management Rules (2016), all pharmaceutical movements must maintain an unbroken audit trail.

### Prototype Implementation
- Centralized via [`auditService.js`](file:///c:/Users/rishi/OneDrive/Desktop/MedStock/MedStock/src/services/auditService.js).
- Tracks `AUTH_LOGIN`, `AUTH_LOGOUT`, `INVENTORY_ADD`, `INVENTORY_UPDATE`, `INVENTORY_DISPOSE`, `REQUEST_CREATE`, `REQUEST_DECIDE`, `ESCROW_PAYMENT`.
- Automatically strips credentials and sensitive payloads.
- Flags each entry with `isDemoAudit: true` and disclaimer.

### Production Audit Architecture
- Logs must be streamed via append-only, tamper-evident protocols (e.g., AWS CloudTrail, Google Cloud Audit Logs, or Write-Once-Read-Many storage).
- Each audit entry must be signed with the submitting node's digital certificate (PKI) for non-repudiation.
- Retained for a minimum of 5 years to meet regulatory retention requirements.

---

## 14. Healthcare & Regulatory Compliance (CDSCO / DISHA)

### India Digital Information Security in Healthcare Act (DISHA) & CDSCO Rule 65
- **Zero Real Patient Data:** The application exchanges only B2B institutional lots, batch numbers, and manufacturer certificates. Patient health records (EHR/EMR) are out of scope.
- **Provenance Verification:** Medicine lots are tracked by manufacturer batch number, manufacturing date, and expiry date.
- **De-Identification:** All demonstration invoices, receipts, and certificates render the explicit notice:  
  `DEMO / SAMPLE DOCUMENT - NO REAL PATIENT DATA`.

---

## 15. Third-Party Dependency Audit & Maintenance

Run routine dependency vulnerability audits:
```bash
npm audit
```

### Current Status & Accepted Deviations:
- **`esbuild <= 0.24.2`** (via `vite`): Development-only web server vulnerability. Does not affect production static builds. Remediation planned with Vite 6/7 upgrade during next release cycle.
- **`react-router-dom <= 6.28.0`**: Advisories relate to open redirect / SSR constructor injection. MedEx is a purely client-rendered SPA without SSR, making these vectors non-exploitable in this setup.

### Automated Monitoring
- Integrate GitHub Dependabot or Snyk into the CI/CD pipeline to automatically block pull requests introducing CVEs with CVSS score $\ge 7.0$.

---

## 16. Production Deployment Checklist

Before moving MedEx from prototype to production:

- [ ] **Backend Service:** Replace client-side mock services with an authenticated REST/GraphQL API.
- [ ] **HTTPS:** Enforce TLS 1.3 with automated certificate renewal (Let's Encrypt / Cloudflare).
- [ ] **Cookies:** Migrate from `localStorage` to `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- [ ] **MFA:** Enforce TOTP or WebAuthn for hospital admin accounts.
- [ ] **Subresource Integrity (SRI):** Inject SRI hashes for all external CDN scripts or fonts.
- [ ] **CSP & Headers:** Deploy strict Content Security Policy and HTTP security headers.
- [ ] **Database RLS:** Implement Row-Level Security on all multi-tenant tables.
- [ ] **Secrets Management:** Ensure zero secrets or API keys are committed; use AWS Secrets Manager or HashiCorp Vault.
- [ ] **Audit Streaming:** Stream audit logs to a secure SIEM / immutable cold storage.
- [ ] **Penetration Testing:** Conduct third-party web application penetration testing (OWASP Top 10).

---

## 17. Responsible Vulnerability Disclosure Policy

If you discover a security vulnerability in MedEx, please report it responsibly:

- **Email:** `security@medex.demo`
- **Response SLA:** Initial acknowledgment within 24 business hours; triaged fix timeline within 72 hours.
- **Safe Harbor:** We will not pursue legal action against security researchers who conduct testing in good faith, do not access other users' data, and allow reasonable time for remediation before public disclosure.
