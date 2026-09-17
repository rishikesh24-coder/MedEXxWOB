# MedEx Production Deployment Guide

This guide provides the complete, authoritative operational instructions for deploying the **MedEx National Healthcare Logistics & Inter-Hospital Exchange Platform** into production.

---

## 1. System Architecture Overview

MedEx is packaged as a **Unified Production Container** containing:
1. **Frontend**: React 18.3 SPA compiled into optimized static assets (`/app/dist`).
2. **Backend**: Node.js 20 LTS Express REST API running on port `5000` (`/app/backend`).
3. **Database & Auth**: Supabase PostgreSQL instance with Row Level Security (RLS).
4. **Payment Gateway**: Razorpay Live Mode with HMAC-SHA256 signature verification.
5. **Cold-Chain & Telemetry**: Schedule M statutory temperature monitoring (2.0°C – 8.0°C).

```
                      +------------------------------------------+
                      |         TLS / CDN / Reverse Proxy         |
                      |   (Cloudflare / AWS ALB / GCP LB / PaaS) |
                      +------------------------------------------+
                                           |
                                           v
                              +-------------------------+
                              |   Docker Container      |
                              |   (node:20-alpine:5000) |
                              +-------------------------+
                              |  Static Frontend SPA    |
                              |  (/app/dist)            |
                              |-------------------------|
                              |  Express REST API       |
                              |  (/app/backend/server)  |
                              +-------------------------+
                                    |              |
                +-------------------+              +--------------------+
                |                                                       |
                v                                                       v
+-------------------------------+                       +-------------------------------+
|     Supabase PostgreSQL       |                       |    Razorpay Payment Gateway   |
|   (Auth, RLS, Storage)        |                       |   (Orders, Escrow, Webhooks)  |
+-------------------------------+                       +-------------------------------+
```

---

## 2. Production Environment Variables Reference

All production settings must be configured in the container runtime environment or container orchestration secret manager:

| Environment Variable | Required | Description | Example / Recommended Value |
|---|---|---|---|
| `NODE_ENV` | **Yes** | Enforces production security, strict CORS, and rate limits | `production` |
| `PORT` | **Yes** | Port Express binds to (default: 5000) | `5000` |
| `SUPABASE_URL` | **Yes** | Canonical Supabase project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | **Yes** | Public anonymous client API key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Secret service role key (strictly server-side) | `eyJhbGciOi...` |
| `CORS_ORIGINS` | **Yes** | Comma-separated list of allowed browser origins | `https://medex.health.gov.in` |
| `TRUST_PROXY` | **Yes** | Enables proxy header inspection behind reverse proxy | `true` |
| `PAYMENT_PROVIDER` | **Yes** | Active payment provider adapter | `razorpay` |
| `PAYMENT_PROVIDER_KEY` | **Yes** | Razorpay Key ID | `rzp_live_xxxxxxxxxxxxxx` |
| `PAYMENT_PROVIDER_SECRET` | **Yes** | Razorpay Key Secret | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `PAYMENT_WEBHOOK_SECRET` | **Yes** | Secret configured in Razorpay Webhook dashboard | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `MAX_DOCUMENT_SIZE_MB` | No | Max PDF verification document size (default: 5MB) | `5` |
| `ABDM_CLIENT_ID` | No | National Health Authority ABDM Client ID | `abdm_client_xxxxxxxx` |
| `ABDM_CLIENT_SECRET` | No | ABDM Gateway secret | `abdm_secret_xxxxxxxx` |

---

## 3. Database Provisioning (Supabase PostgreSQL)

1. **Create Supabase Project**:
   - Region: Select `ap-south-1` (Mumbai, India) to adhere to CDSCO and Digital Personal Data Protection (DPDP) data residency standards.
2. **Execute Schema**:
   - In the Supabase Dashboard, open **SQL Editor**.
   - Paste and run the entire contents of [`backend/schema.sql`](backend/schema.sql).
   - This creates the 17 core entity tables, foreign keys, status enum types, check constraints, and Row Level Security (RLS) policies.
3. **Provision Storage Bucket**:
   - Navigate to **Storage** -> **New Bucket**.
   - Bucket Name: `hospital-documents`
   - Privacy: **Private** (Not public).
   - Add storage RLS policy granting read/write to authenticated users for their own hospital directory, and read-all to administrators.
4. **Bootstrap Administrator Account**:
   - Run the initial seed script from [`backend/seed.sql`](backend/seed.sql) or invite the initial administrator through Supabase Auth dashboard with metadata `{"role": "admin"}`.

---

## 4. Payment Gateway Provisioning (Razorpay)

1. **Activate Live Mode**:
   - Access Razorpay Merchant Dashboard and complete KYC verification.
2. **Generate API Keys**:
   - Navigate to **Settings** -> **API Keys** -> **Generate Key**.
   - Copy `Key ID` into `PAYMENT_PROVIDER_KEY`.
   - Copy `Key Secret` into `PAYMENT_PROVIDER_SECRET`.
3. **Configure Webhook**:
   - Navigate to **Settings** -> **Webhooks** -> **Add New Webhook**.
   - Webhook URL: `https://<your-domain>/api/payments/webhook`
   - Secret: Generate a strong random 32-character string and set it in `PAYMENT_WEBHOOK_SECRET`.
   - Active Events:
     - `payment.captured`
     - `payment.failed`
     - `order.paid`
     - `refund.processed`

---

## 5. Deployment Options

Because the repository provides a multi-stage `Dockerfile`, MedEx can be deployed to any container runtime:

### Option A: Google Cloud Run (Recommended for India Data Residency)
```bash
# 1. Build and push image to Google Artifact Registry
gcloud builds submit --tag asia-south1-docker.pkg.dev/$PROJECT_ID/medex/medex-platform:latest

# 2. Deploy to Cloud Run in Mumbai (asia-south1)
gcloud run deploy medex-platform \
  --image asia-south1-docker.pkg.dev/$PROJECT_ID/medex/medex-platform:latest \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 5000 \
  --set-env-vars NODE_ENV=production,TRUST_PROXY=true,PAYMENT_PROVIDER=razorpay \
  --set-secrets SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,PAYMENT_PROVIDER_KEY=RAZORPAY_KEY_ID:latest,PAYMENT_PROVIDER_SECRET=RAZORPAY_KEY_SECRET:latest,PAYMENT_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest
```

### Option B: AWS ECS Fargate / App Runner
1. Push image to Amazon ECR (`ap-south-1` Mumbai).
2. Create ECS Task Definition using `node:20-alpine` container on port 5000.
3. Attach Application Load Balancer (ALB) with ACM TLS certificate.
4. Set `TRUST_PROXY=true` in container environment.

### Option C: PaaS Container Deployment (Render / Railway)
1. Link GitHub repository to service.
2. Select **Docker** as environment.
3. Add environment variables in the Dashboard.
4. Configure health check path to `/api/health`.

---

## 6. Pre-Launch Verification Checklist

Before directing live DNS traffic to the deployment:
- [ ] `GET /api/health` returns HTTP 200 with `status: "healthy"` and `supabase.connected: true`.
- [ ] `GET /` serves the compiled React application (`<!doctype html>`).
- [ ] `GET /marketplace` loads cleanly without 404.
- [ ] Login with verified credentials returns JWT token.
- [ ] Unauthenticated access to `/api/hospitals` returns HTTP 401.
- [ ] Document upload validates magic bytes and blocks non-PDF files.
- [ ] Razorpay webhook HMAC verification succeeds with test event.
