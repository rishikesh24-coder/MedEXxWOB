# MedEx — National Inter-Hospital Medicine Redistribution & Logistics Platform

[![Production CI](https://github.com/medex/medex-core/actions/workflows/ci.yml/badge.svg)](https://github.com/medex/medex-core/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#)

---

## 1. Executive Summary

**MedEx** is an enterprise-grade digital exchange and real-time cold-chain logistics platform purpose-built for accredited hospitals, healthcare facilities, and national oversight authorities in India. 

The platform resolves critical medicine supply imbalances by enabling:
- **Rapid Inter-Hospital Redistribution**: Fast requisition and fulfillment of life-saving, high-value, or near-expiry medicines between verified healthcare facilities before expiry occurs.
- **Continuous Cold-Chain Telemetry**: Enforcing CDSCO Schedule M statutory temperature ranges (2.0°C – 8.0°C) with real-time GPS tracking and instant temperature breach alerts.
- **Escrow-Backed Settlement**: Financial risk mitigation via automated escrow locks, Razorpay gateway integration, HMAC-SHA256 verification, and standardized refund policies.
- **Statutory Bio-Waste Tracking**: Digital Form-IV bio-medical waste disposal manifests and pollution control board audit certificates.
- **Ayushman Bharat Digital Mission (ABDM) Gateway Readiness**: Preparedness for national health facility registry (HFR) and digital health exchange integration.

---

## 2. Technology Stack & Architecture

### Frontend Layer
- **Framework**: React 18.3 (Single Page Application via Vite 5)
- **State Management**: Redux Toolkit 2.3 (slices for auth, hospital, inventory, requests, payments, tracking, admin)
- **Routing**: React Router DOM v6 with route-level RBAC gating (`ProtectedRoute`, `AdminRoute`, `HospitalRoute`)
- **Styling & UI**: Vanilla CSS + Tailwind CSS 3.4 with custom medical design tokens, glassmorphism, and responsive breakpoints
- **Mapping & Geo**: Leaflet & React-Leaflet with real-time consignment coordinates and delivery corridors
- **Data Visualization**: Recharts for national trading trends, stock breakdown, and cold-chain compliance metrics

### Backend Service Layer
- **Runtime**: Node.js 20 LTS
- **Server Framework**: Express 5.x RESTful APIs
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) and JWT Bearer token authentication
- **Resilience**: Dual-mode data access (authoritative Supabase queries with in-memory store fallback for offline simulations)
- **Security Hardening**: Helmet CSP, CORS domain allowlisting, express-rate-limit throttling, Multer magic-byte document inspection

### Containerization & Deployment
- **Docker**: Multi-stage production container build (Vite static build -> Node.js production runtime)
- **CI/CD**: GitHub Actions workflow validating frontend bundle compilation, 9 backend test suites, and Dockerfile integrity

---

## 3. Authoritative 17-Entity Database Schema

MedEx enforces a relational data model defined in `backend/schema.sql` with PostgreSQL foreign keys, check constraints, and Row Level Security (RLS) policies:

| # | Entity Table | Primary Responsibility |
|---|---|---|
| 1 | `hospitals` | Institutional identity, Clinical Establishment Act registration, status (`pending`, `verified`, `rejected`, `suspended`). |
| 2 | `users` | Role-based accounts (`admin`, `hospital`, `auditor`) linked to hospital tenant IDs. |
| 3 | `hospital_documents` | Verification documents (Drug License, Registration Certificate, GST, Board Authorization) with MIME/byte validation. |
| 4 | `medicines` | Master pharmaceutical catalog (generic name, brand name, formulation, strength, Schedule H/X categorization). |
| 5 | `inventory_lots` | Hospital-held batches, batch numbers, manufacturing/expiry dates, available quantity, MRP, concession rates, storage conditions. |
| 6 | `medicine_categories` | Clinical categorizations (Oncology, Critical Care, Antibiotics, Immunotherapy, Cardiology, Nephrology). |
| 7 | `requests` | Inter-hospital medicine requisitions, first-acceptance-wins concurrency locking, 48-hour SLA expiry counters. |
| 8 | `purchase_orders` | Contractual purchase orders generated upon bilateral requisition acceptance. |
| 9 | `payments` | Financial transactions, escrow balance locks, Razorpay gateway order references, payment status. |
| 10 | `refunds` | 4-tier standardized cancellation refund adjustments (100%, 90%, 50%, 0%) with automatic inventory re-crediting. |
| 11 | `transfers` | Inter-hospital dispatch records, consignment manifests, courier partners, and transit milestones. |
| 12 | `tracking_events` | Continuous telemetry checkpoints, GPS coordinates, current temperature (°C), cold-chain compliance flags, ETA. |
| 13 | `bio_waste_disposals`| Expired medicine disposal declarations under Bio-Medical Waste Management Rules. |
| 14 | `disposal_manifests` | Statutory Form-IV disposal certificates, approved vendor details, and MPCB compliance records. |
| 15 | `notifications` | Role-tailored operational alerts, approval updates, and transfer milestone notifications. |
| 16 | `audit_logs` | Immutable audit trail capturing every system event, actor, IP address, before/after state diff, and timestamp. |
| 17 | `feedback` | Institutional ratings, service reviews, admin resolution replies, and grievance workflows. |

---

## 4. REST API Catalogue

All API endpoints follow standardized JSON envelopes:
```json
{
  "success": true,
  "data": { ... },
  "message": "Human readable message",
  "timestamp": "2026-09-14T11:45:00.000Z"
}
```

### Authentication & Hospital Verification (`/api/auth`, `/api/hospital-verification`)
- `POST /api/auth/register-hospital` — Register hospital with mandatory PDF verification documents.
- `POST /api/auth/login` — Authenticate user and return session token with role/status verification.
- `PUT /api/hospital-verification/:id/approve` — Platform administrator approves pending hospital.
- `PUT /api/hospital-verification/:id/reject` — Reject hospital application with statutory reasons.

### Network Hospital Directory (`/api/hospitals`)
- `GET /api/hospitals/me` — Retrieve profile of current authenticated hospital.
- `PUT /api/hospitals/me` — Update institutional contact and address information.
- `GET /api/hospitals` — Retrieve verified hospital network directory (unverified institutions strictly omitted).

### Medicine Catalog & Inventory Oversight (`/api/inventory`, `/api/medicines`)
- `GET /api/inventory` — Query facility inventory with category, expiry, and stock filters.
- `POST /api/inventory` — List new medicine lot with batch number, shelf-life, and storage parameters.
- `PUT /api/inventory/:id` — Update batch stock quantity or concession rates.
- `DELETE /api/inventory/:id` — Remove or delist stock batch.

### Requisitions & Inter-Hospital Exchange (`/api/requests`, `/api/trades`)
- `GET /api/requests` — View outgoing requisitions and incoming requests for available stock.
- `POST /api/requests` — Create emergency requisition with quantity and delivery priority.
- `PUT /api/requests/:id/accept` — Accept requisition with row-level concurrency lock (prevents double-allocation).
- `PUT /api/requests/:id/reject` — Decline requisition with justification.
- `GET /api/trades` — Centralized trading history with pagination, search, and date-range filters.
- `GET /api/trades/export` — Download tamper-evident CSV report of trading transactions.

### Escrow Payments & Cancellation Refunds (`/api/payments`, `/api/refunds`)
- `POST /api/payments/create-order` — Initialize Razorpay order with server-side amount calculation.
- `POST /api/payments/verify` — Verify cryptographic HMAC-SHA256 signature and lock funds in escrow.
- `POST /api/requests/:id/cancel` — Execute 4-tier cancellation with automatic refund calculation and stock restore.

### Cold-Chain Logistics & Telemetry (`/api/transfers`, `/api/tracking`)
- `POST /api/transfers` — Dispatch inter-hospital transfer consignment with initial temperature.
- `GET /api/transfers` — List transfer consignments with strict tenant isolation.
- `GET /api/tracking/:txnId` — Real-time telemetry lookup by transaction or tracking reference.
- `PATCH /api/transfers/:id/status` — Advance transfer milestone (`DISPATCHED`, `IN_TRANSIT`, `DELIVERED`) with new temperature logger data.

### Institutional Feedback & Moderation (`/api/feedback`)
- `POST /api/feedback` — Submit institutional feedback (rating 1–5, category, commentary).
- `GET /api/feedback` — List hospital's own feedback (or all feedback for administrators).
- `PATCH /api/feedback/:id/reply` — Administrator submits official resolution response.
- `PATCH /api/feedback/:id/status` — Administrator transitions status (`new` -> `under_review` -> `resolved`).

### National Health Gateway (`/api/abdm`)
- `GET /api/abdm/status` — ABDM gateway readiness status, health check, and milestone registry.

---

## 5. Security & Regulatory Compliance Standards

1. **Supabase Row-Level Security (RLS)**:
   - Direct database queries are gated by PostgreSQL RLS policies ensuring hospitals only read/write their own records.
   - Platform administrators possess supervisory oversight through elevated service credentials.
2. **Tenant Isolation**:
   - Every operational query enforces `hospital_id` scoping at controller and service tiers.
   - Cross-tenant requisition inspection without explicit participation returns `403 Forbidden`.
3. **CDSCO Cold-Chain Compliance**:
   - Temperature telemetry outside 2.0°C – 8.0°C immediately flags `tempBreach: true` and dispatches critical alerts to both sender and recipient pharmacy heads.
4. **Cryptographic Payment Integrity**:
   - Razorpay webhook payloads and client verification callbacks are validated via HMAC-SHA256 signatures before escrow state transitions occur.
5. **Defense-in-Depth File Uploads**:
   - Submitted statutory documents (licenses, certificates) are inspected for magic bytes (`%PDF-`), validated for exact MIME types, and scanned against size quotas (max 10MB).
6. **Rate Limiting & Network Shielding**:
   - Express rate limiters protect authentication and sensitive endpoints against brute-force attacks.
   - Strict CORS policy blocks unapproved origin headers.

---

## 6. Automated Test Suites & Quality Assurance

MedEx includes an end-to-end regression test suite covering all operational modules:

```bash
# Run the complete CI verification suite (all 9 suites)
npm run test:ci
```

### Individual Test Suites
| Test Suite Script | Focus Area | Assertions |
|---|---|---|
| `test-schema-integrity.js` | 17 Core SQL Tables, Foreign Keys, RLS Policies | 17 Tables Verified |
| `test-phase11-cors.js` | CORS Preflight, Domain Allowlist, Strict Origin Gating | 12 Tests |
| `test-phase11-security-ratelimit.js` | Rate Limiting, Brute Force Protection, Security Headers | 16 Tests |
| `test-document-security.js` | Document Uploads, Magic Bytes, PDF Validation, Sanitization | 18 Tests |
| `test-phase6-cancellation-refund.js` | 4-Tier Cancellation Policy, Escrow Refunds, Stock Restores | 20 Tests |
| `test-phase7-payments.js` | Razorpay Orders, HMAC Verification, Webhook Idempotency | 22 Tests |
| `test-phase10-trading-reports.js` | Trading History, CSV Export, Date Filters, Boundary Testing | 17 Tests |
| `test-phase11-concurrency.js` | First-Acceptance-Wins, High Concurrency Requisitions | 15 Tests |
| `test-phase12-logistics-feedback.js`| Cold-Chain Telemetry, Inter-Hospital Transfers, Feedback, ABDM | 16 Tests |

---

## 7. Setup & Local Development

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- Supabase account (or local Supabase CLI instance)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/medex/medex-core.git
cd medex-core

# 2. Install root & frontend dependencies
npm install

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Configure environment variables
cp .env.example .env
cp backend/.env.example backend/.env
```

### Running Locally
```bash
# Run backend development server (Port 5000)
npm run start:backend

# Run frontend development server (Port 5173) in a separate terminal
npm run dev
```

### Production Build
```bash
# Build optimized Vite bundle
npm run build

# Preview production build locally
npm run preview
```

### Docker Multi-Stage Deployment
```bash
# Build container image
docker build -t medex-platform:latest .

# Run container
docker run -p 5000:5000 --env-file backend/.env medex-platform:latest
```
