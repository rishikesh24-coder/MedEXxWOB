# MedEx Production Maintenance & Operational Checklist

This document provides a practical, standard operating checklist for system administrators, devops engineers, and compliance liaisons managing the **MedEx National Healthcare Logistics Platform** in production.

---

## 1. Daily Health & Telemetry Monitoring
- [ ] **Health Endpoint Inspection**:
  Verify `/api/health` returns HTTP 200 with `status: "healthy"`. Confirm that the Supabase database connection and Razorpay payment gateway adapters are initialized.
- [ ] **Cold-Chain Telemetry Breaches**:
  Query the active alerts ledger (`/api/alerts?severity=CRITICAL`) to detect any transit temperature excursions (> 8.0°C or < 2.0°C) requiring immediate clinical quarantine or drug inspector notification.
- [ ] **Pending Verification Queue**:
  Review pending hospital onboarding dossiers in the administrative verification queue (`/admin/verification`) to ensure compliance with the 24-hour verification SLA.

---

## 2. Weekly Error & Log Auditing
- [ ] **HTTP 5xx & Unhandled Exceptions**:
  Inspect container stdout/stderr or CloudWatch/Datadog logs for unhandled errors. Confirm that client error boundaries successfully isolate rendering anomalies without leaking technical stack traces.
- [ ] **Rate-Limiting & Intrusion Attempts**:
  Review HTTP 429 status code rates on sensitive endpoints (`/api/auth/login`, `/api/hospital-verification`) to verify rate limiters are blocking brute-force or credential stuffing attempts.
- [ ] **Unresolved Institutional Feedback**:
  Review unresolved support and service complaints in `/admin/feedback` and ensure administrative resolution notes are provided within statutory timelines.

---

## 3. Database Backups & State Integrity
- [ ] **Point-In-Time Recovery (PITR)**:
  Ensure PostgreSQL WAL archiving and automated daily PITR backups are active in Supabase/AWS RDS with a retention window of at least 30 days.
- [ ] **Cold-Storage Verification**:
  Perform a test restore of the database schema and data from the weekly backup snapshot into an isolated staging environment to verify backup integrity.
- [ ] **Document Storage Audits**:
  Verify that the `hospital-documents` private storage bucket retains all active institutional licenses and that expired certificates are archived rather than deleted.

---

## 4. Performance & Resource Optimization
- [ ] **Query Latency Benchmarks**:
  Inspect database `pg_stat_statements` for queries with execution times exceeding 250ms (e.g. large cross-hospital inventory scans or aggregated ledger summaries).
- [ ] **Container Memory & CPU**:
  Monitor Docker runtime utilization (`docker stats`). The Node.js Alpine container should operate steadily under 512MB RAM under normal workloads.
- [ ] **Static Asset Cache Hit Ratio**:
  Verify CDN edge caching for Vite production bundles (`/app/dist/assets/*.js`, `*.css`) with immutable cache-control headers (`max-age=31536000, immutable`).

---

## 5. Security Updates & Patch Management
- [ ] **Dependency Vulnerability Scanning**:
  Run `npm audit` on both root and backend manifests on a monthly schedule. Apply patch and minor updates that resolve identified CVEs.
- [ ] **Secret & Token Rotation**:
  Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `PAYMENT_WEBHOOK_SECRET` semi-annually or immediately following any administrative personnel change.
- [ ] **TLS Certificate Lifecycle**:
  Verify Let's Encrypt / Cloudflare automated renewal status for domain certificates with alerts triggered 15 days prior to expiration.

---

## 6. Bug Fixes & Hotfix Workflow
- [ ] **Hotfix Branching Protocol**:
  Branch directly from the latest verified release tag (`git checkout -b hotfix/<issue> <tag>`), apply surgical repairs, run the automated verification suite (`npm test && npm run build`), and tag the revision upon verification.
- [ ] **Non-Destructive Migrations**:
  Never drop columns or tables in live production. Add nullable columns, backfill data idempotently, and deprecate old fields in phased releases.
