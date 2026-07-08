# BuildTime — Face-Recognition Check-In System
## Technical Specification & Architecture

---

## 1. Problem & Goals

- Construction sites currently rely on manual/buddy sign-in → time theft ("buddy punching," inflated hours).
- Need: kiosk-based face recognition at site entrance, full role hierarchy, and a clean pipe from raw attendance → payroll → accounting.
- Philippine context: must produce a legally valid **Daily Time Record (DTR)**, support **overtime, night differential, holiday/rest-day pay** per the Labor Code, and feed SSS/PhilHealth/Pag-IBIG/withholding-tax deduction logic.

---

## 2. High-Level Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│  Site Kiosk App  │ ───▶  │  API Gateway /     │ ───▶  │  Core Services       │
│ (tablet, offline- │       │  Auth (JWT, mTLS   │        │  - Attendance        │
│  first PWA)      │ ◀───  │  for kiosks)       │ ◀───  │  - Face Match        │
└─────────────────┘        └──────────────────┘        │  - Worker/HR         │
                                                          │  - Project/Site     │
┌─────────────────┐                                     │  - Payroll Engine    │
│  Admin Web App    │ ───▶  same gateway  ────────────▶ │  - Reporting         │
│ (office roles)    │                                     └─────────┬───────────┘
└─────────────────┘                                                 │
                                                          ┌─────────▼───────────┐
                                                          │  Accounting Export   │
                                                          │  (payroll run, GL,   │
                                                          │  gov't remittances)  │
                                                          └─────────────────────┘
```

**Key design decision — offline-first kiosk:** sites often have weak connectivity. Kiosk does on-device face detection + liveness, queues encrypted check-in events locally, syncs when online. Server timestamp is authoritative for payroll (kiosk device clock is untrusted).

---

## 3. Roles & Permission Matrix

| Role | Check-in kiosk | View own DTR | Approve OT/leave | Edit attendance | Manage workers | Run payroll | View labor cost/accounting |
|---|---|---|---|---|---|---|---|
| Laborer/Rank-and-file | ✅ (face only) | ✅ | – | – | – | – | – |
| Foreman/Lead Person | ✅ | ✅ | ✅ (own crew) | – | – | – | – |
| Site Engineer | ✅ | ✅ | ✅ | – | – | – | View site-level |
| Safety Officer | ✅ | ✅ | – | – | – | – | – |
| Site/Project Manager | ✅ | ✅ | ✅ | ✅ (with audit log) | ✅ (own site) | – | ✅ site |
| HR Officer | – | – | – | ✅ | ✅ (all sites) | – | – |
| Payroll/Accounting | – | – | – | – | – | ✅ | ✅ |
| Admin/IT | – | – | – | ✅ | ✅ | – | System config only |

All roles are DB-driven (`roles`, `permissions`, `role_permissions`), not hardcoded, so BuildTime can add roles (e.g., Subcontractor Supervisor) without redeploying.

---

## 4. Core Modules

### 4.1 Enrollment
- One-time HR-supervised enrollment per worker: capture 3–5 face angles + liveness check.
- Store only **face embeddings (vectors)**, never raw enrollment photos in the matching path (raw photo kept encrypted, access-logged, for HR dispute review only).
- Re-enrollment flow for major appearance change, flagged by low-confidence match trend.

### 4.2 Attendance / Kiosk Check-in
- Flow: worker approaches kiosk → camera detects face → **passive liveness check** (texture/depth cues, or active: prompted blink/head-turn) → embedding generated on-device → matched against site's local worker cache (top-K cosine similarity) → match confirmed → event queued/synced with server timestamp, site ID, kiosk ID, confidence score.
- Anti-spoof measures:
  - Liveness detection (reject photos, screens, printed faces).
  - Confidence threshold + fallback: low-confidence match → PIN/ID-card backup with photo captured for HR review flag (never silently accept).
  - No manual "type your ID" bypass without a flagged exception + supervisor confirmation, logged.
  - Rate-limit: one check-in per worker per direction per X minutes to prevent replay.
- Geofencing optional (kiosk GPS fixed, so mostly a non-issue) — mainly useful if you later allow mobile check-in for site engineers who roam multiple sites.

### 4.3 Time & Attendance Rules Engine
- Configurable per project: shift schedule, grace periods, rounding rules.
- Computes: regular hours, overtime (>8hrs/day per Labor Code), night differential (10PM–6AM, +10%), rest day/holiday premiums, tardiness/undertime deductions.
- Produces **DTR** per worker per cutoff (semi-monthly typical in PH).

### 4.4 Worker / Project / Site Management
- Worker profile: employment type (regular/project-based/casual), assigned site(s), rate, government IDs (SSS/PhilHealth/Pag-IBIG/TIN — encrypted at rest).
- Site/project: location, kiosk devices registered to it, active worker roster, budget/labor cost tracking.

### 4.5 Payroll Engine → Accounting
- Consumes DTR + rate + rules engine output → gross pay.
- Statutory deductions: SSS, PhilHealth, Pag-IBIG (table-driven, updatable as gov't tables change), withholding tax (BIR).
- 13th-month accrual tracking.
- Export: payroll register, GL journal entries, per-project labor cost report, government remittance files (SSS/PhilHealth/Pag-IBIG contribution files, BIR alphalist support).
- Integration options: direct DB view for accounting team, or export to existing accounting software (QuickBooks, Xero, or PH-specific like JuanTax) via CSV/API.

### 4.6 Audit & Reporting
- Every manual attendance edit requires reason + approver, immutable audit log (important for DOLE labor disputes and for trust in the face-rec system itself).
- Dashboards: attendance %, late/absent trends, labor cost per site, overtime hotspots.

---

## 5. Data Model (core tables)

```
workers(id, name, national_id_enc, employee_no, role_id, employment_type,
        daily_rate, hire_date, status, face_embedding_ref)

face_embeddings(id, worker_id, embedding_vector, quality_score,
                 enrolled_at, enrolled_by, active)

sites(id, name, address, geo_lat, geo_lng, project_id, status)

kiosks(id, site_id, device_key, last_sync_at, status)

attendance_events(id, worker_id, site_id, kiosk_id, event_type[in/out],
                   client_ts, server_ts, confidence_score, match_method,
                   flagged_for_review, synced_at)

dtr_records(id, worker_id, cutoff_id, date, regular_hrs, ot_hrs,
            night_diff_hrs, late_min, undertime_min, status)

payroll_runs(id, cutoff_id, status, generated_by, generated_at)
payroll_lines(id, payroll_run_id, worker_id, gross_pay, sss, philhealth,
              pagibig, withholding_tax, net_pay)

roles(id, name) / permissions(id, name) / role_permissions(role_id, permission_id)
audit_log(id, actor_id, action, entity, entity_id, before, after, ts)
```

---

## 6. Tech Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Kiosk app | PWA (offline-capable, IndexedDB queue) or lightweight Electron on cheap Android tablet | No app store friction, works on budget hardware common at PH sites |
| Face detection/embedding (on-device) | face-api.js (TF.js) or MediaPipe + a lightweight ArcFace-style ONNX model | Keeps raw biometric processing local, cuts cloud cost, works with intermittent internet |
| Server-side re-verification (optional) | AWS Rekognition or Azure Face API for high-value disputes only | Avoid recurring per-scan cloud cost; use cloud only as a fallback/audit layer |
| Backend | Node.js (NestJS) or Python (FastAPI) | Either fine; pick based on your team's existing skillset |
| DB | PostgreSQL + pgvector (for embedding similarity search) | One DB for relational + vector search, simpler ops |
| Sync/queue | Simple REST + idempotent event upload, retry queue on kiosk | Handles flaky site internet |
| Hosting | Cloud (AWS/GCP/Azure) with a region close to PH, or local DC if data residency is a concern | See compliance note below |

---

## 7. Security & Philippine Data Privacy Compliance

- Face biometric data = **sensitive personal information** under the **Data Privacy Act of 2012 (RA 10173)**.
- Required: explicit written consent at enrollment, registration of the processing system with the **National Privacy Commission** (biometric processing typically requires this), a documented data retention/deletion policy, and breach notification procedure.
- Encrypt embeddings and PII at rest (AES-256) and in transit (TLS/mTLS from kiosk to gateway).
- Access to raw photos/embeddings restricted and logged; workers should be able to request their data (DPA data subject rights).
- Recommend a formal Privacy Impact Assessment before rollout — this is normally a legal/compliance step, not something to skip given it's biometric data on employees.

---

## 8. Anti-Cheating Design Summary (your core ask)

1. **Liveness detection** — blocks photo/video spoofing.
2. **1:N match against enrolled site roster only** (not open-world) — fast, accurate, no manual entry needed.
3. **Server-authoritative timestamp** — kiosk clock never trusted.
4. **No silent fallback** — low-confidence match always creates a flagged review event, never auto-approved.
5. **Immutable audit trail** on any manual override.
6. **Single active embedding per worker** — prevents multiple identities/duplicate enrollment ("hours farming").
7. **Rate limiting** — blocks rapid repeat scans/replay tricks.

---

## 9. Suggested Build Phases

1. **Phase 1 (MVP):** Kiosk check-in/out with face match + liveness, single site, manual payroll export (CSV).
2. **Phase 2:** Multi-site, rules engine (OT/night diff/holiday), DTR generation, role-based admin web app.
3. **Phase 3:** Full payroll engine with statutory deductions, accounting export/integration, audit dashboards, NPC compliance documentation finalized.
4. **Phase 4:** Analytics (labor cost per project, attendance trends), possible mobile check-in for roaming roles (engineers/managers across sites).

---

## 10. Open Questions to Resolve Before Build

- Number of sites at launch, and expected worker count per kiosk (affects on-device 1:N match speed).
- Existing accounting system to integrate with (or is payroll export to Excel/CSV sufficient at first)?
- Payroll cutoff schedule (semi-monthly is standard, confirm).
- Preferred cloud provider / any data residency requirement (some PH companies require local hosting).
- Tablet hardware budget (affects camera quality → match accuracy).
