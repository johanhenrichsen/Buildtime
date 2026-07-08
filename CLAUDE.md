# BuildTime — Project Brief for Claude Code

## What this is
Face-recognition check-in system for a Filipino construction company, starting as a
**single-site pilot**. Full context/rationale in `docs/tech-spec.md`. This file is the
actionable build brief — start here.

## Pilot scope decisions (locked in)
- **1 site, 1 kiosk** at launch. Design should not hard-code "single site" though —
  keep `site_id`/`kiosk_id` as real foreign keys so adding sites later is just data, not code changes.
- **Payroll cutoff: monthly.**
- **Accounting output: CSV/Excel export only** for Phase 1. No live accounting API integration yet.
- **Hosting: undecided.** Build cloud-agnostic — plain Docker Compose (Postgres + API + kiosk static build)
  that can run on a single VM (Railway/Render/DigitalOcean/AWS EC2) or later move to managed services
  with no rearchitecture. Don't lock in a specific cloud SDK.

## Phase 1 (MVP) goal
A worker walks up to a tablet, the kiosk recognizes their face (with liveness check),
logs an IN or OUT event with a server timestamp, and at month-end an admin can export
a CSV with regular hours / OT / late-undertime per worker for the accounting team.

## Repo structure
```
buildtime/
  apps/
    kiosk/          # PWA — camera capture, on-device face embedding, offline queue
    admin/          # Web app — HR enrollment, worker mgmt, DTR review, CSV export
  services/
    api/            # FastAPI or NestJS — auth, attendance, worker, rules engine
  packages/
    shared-types/   # shared TS types/interfaces if using TS across kiosk+admin+api
  infra/
    docker-compose.yml
    postgres/       # init scripts, pgvector extension
  docs/
    tech-spec.md
```

## Build order (do NOT jump ahead — each step should be runnable/testable before the next)

1. ✅ **Data layer**: Postgres schema (workers, face_embeddings, sites, kiosks,
   attendance_events, dtr_records, roles/permissions, audit_log) per the spec's data model.
   Enable `pgvector` for embedding similarity search.
2. **API skeleton**: auth (JWT), CRUD for workers/sites/kiosks, role-based permission checks.
3. **Enrollment flow**: capture endpoint that accepts face embedding + quality score,
   stores it, one active embedding per worker enforced at DB level.
4. **Kiosk app**: camera → on-device face detection/embedding (face-api.js or MediaPipe) →
   liveness check → match against local cached roster (top-K cosine sim) → on success,
   queue attendance_event locally → sync to API when online. Server timestamp is authoritative,
   client timestamp stored separately for audit only.
5. **Low-confidence handling**: any match below threshold creates a `flagged_for_review`
   event — never silent auto-approve, never silent bypass.
6. **Rules engine**: compute regular/OT/night-diff/late/undertime per day from raw
   in/out events, per PH Labor Code basics — output `dtr_records`.
7. **Admin app**: worker management, enrollment UI, DTR review/manual-edit-with-reason
   (writes to audit_log), monthly CSV export (worker, days present, regular hrs, OT hrs,
   night diff hrs, late/undertime).
8. **Audit log** wired into every manual override from day one, not bolted on later.

## Non-negotiables (carry these into every phase of the build)
- No manual "type in your ID to skip face scan" bypass without a flagged, logged exception.
- Face embeddings + PII (SSS/PhilHealth/Pag-IBIG/TIN) encrypted at rest.
- One active face embedding per worker — reject/flag duplicate enrollment attempts.
- Every manual attendance edit requires a reason and is immutable in the audit log.
- Rate-limit repeat scans per worker per kiosk to block replay tricks.

## Explicitly out of scope for Phase 1
- Multi-site support (just don't hard-code against it)
- Payroll statutory deduction computation (SSS/PhilHealth/Pag-IBIG/withholding tax)
- Direct accounting software integration
- Mobile check-in for roaming roles
- Cloud-based face re-verification fallback (Rekognition/Azure Face)
