-- BuildTime — Postgres schema
-- Run order: 01_schema.sql → 02_seed_roles.sql
-- Requires: pgvector extension (included in pgvector/pgvector Docker image)

CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ── Roles & permissions (DB-driven, not hardcoded) ────────────────────────────

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ── Sites ─────────────────────────────────────────────────────────────────────

CREATE TABLE sites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    address     TEXT,
    geo_lat     DOUBLE PRECISION,
    geo_lng     DOUBLE PRECISION,
    -- project_id left as nullable TEXT until a projects table is added in Phase 2
    project_id  UUID,
    status      TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Kiosks ────────────────────────────────────────────────────────────────────

CREATE TABLE kiosks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      UUID        NOT NULL REFERENCES sites(id),
    device_key   TEXT        NOT NULL UNIQUE,  -- used for kiosk-to-API auth (mTLS/token)
    last_sync_at TIMESTAMPTZ,
    status       TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Workers ───────────────────────────────────────────────────────────────────
-- Government ID columns store AES-256 ciphertext (encrypted by the API layer).
-- Raw bytes keep the schema simple; the API owns key management.

CREATE TABLE workers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no         TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    role_id             UUID        NOT NULL REFERENCES roles(id),
    employment_type     TEXT        NOT NULL
                        CHECK (employment_type IN ('regular', 'project-based', 'casual')),
    daily_rate          NUMERIC(10,2) NOT NULL,
    hire_date           DATE        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'terminated')),
    -- Encrypted PII (AES-256, handled at API layer)
    national_id_enc     BYTEA,
    sss_enc             BYTEA,
    philhealth_enc      BYTEA,
    pagibig_enc         BYTEA,
    tin_enc             BYTEA,
    -- Points to the currently active embedding row; maintained by the enrollment service
    face_embedding_ref  UUID,       -- FK added below after face_embeddings is created
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Face embeddings ───────────────────────────────────────────────────────────
-- embedding_vector dimensionality: 512 for ArcFace/InsightFace ONNX models.
-- If you switch to face-api.js FaceNet (128-dim) change the vector size here
-- and re-enroll all workers (no in-place ALTER for pgvector columns).

CREATE TABLE face_embeddings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id        UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    embedding_vector vector(512) NOT NULL,
    quality_score    FLOAT       NOT NULL CHECK (quality_score BETWEEN 0.0 AND 1.0),
    enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    enrolled_by      UUID        NOT NULL REFERENCES workers(id),  -- HR officer who did enrollment
    active           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce one active embedding per worker at DB level.
CREATE UNIQUE INDEX uix_face_embeddings_one_active
    ON face_embeddings(worker_id)
    WHERE active = true;

-- IVFFlat index for fast cosine-similarity search (top-K matching against site roster).
-- lists = 100 is a reasonable starting point for up to ~10 000 enrolled workers.
-- Rebuild with higher lists value if roster grows significantly.
CREATE INDEX idx_face_embeddings_ivfflat
    ON face_embeddings USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

-- Now safe to add the FK from workers → face_embeddings
ALTER TABLE workers
    ADD CONSTRAINT fk_workers_face_embedding
    FOREIGN KEY (face_embedding_ref) REFERENCES face_embeddings(id);

-- ── Attendance events ─────────────────────────────────────────────────────────
-- client_ts is the kiosk device clock — stored for audit only, never used for payroll.
-- server_ts (DEFAULT now()) is the authoritative timestamp.

CREATE TABLE attendance_events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id         UUID        NOT NULL REFERENCES workers(id),
    site_id           UUID        NOT NULL REFERENCES sites(id),
    kiosk_id          UUID        NOT NULL REFERENCES kiosks(id),
    event_type        TEXT        NOT NULL CHECK (event_type IN ('in', 'out')),
    client_ts         TIMESTAMPTZ NOT NULL,   -- device clock, untrusted
    server_ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
    confidence_score  FLOAT       NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    match_method      TEXT        NOT NULL
                      CHECK (match_method IN ('face', 'face_low_confidence', 'manual_exception')),
    flagged_for_review BOOLEAN    NOT NULL DEFAULT false,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_events_worker_ts   ON attendance_events(worker_id, server_ts DESC);
CREATE INDEX idx_attendance_events_site_ts     ON attendance_events(site_id, server_ts DESC);
CREATE INDEX idx_attendance_events_flagged     ON attendance_events(flagged_for_review)
    WHERE flagged_for_review = true;

-- ── Payroll cutoffs ───────────────────────────────────────────────────────────

CREATE TABLE payroll_cutoffs (
    id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE  NOT NULL,
    period_end   DATE  NOT NULL,
    status       TEXT  NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'processing', 'closed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cutoff_dates CHECK (period_end > period_start)
);

-- ── DTR records ───────────────────────────────────────────────────────────────

CREATE TABLE dtr_records (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID         NOT NULL REFERENCES workers(id),
    cutoff_id       UUID         NOT NULL REFERENCES payroll_cutoffs(id),
    date            DATE         NOT NULL,
    regular_hrs     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (regular_hrs >= 0),
    ot_hrs          NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (ot_hrs >= 0),
    night_diff_hrs  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (night_diff_hrs >= 0),
    late_min        INTEGER      NOT NULL DEFAULT 0  CHECK (late_min >= 0),
    undertime_min   INTEGER      NOT NULL DEFAULT 0  CHECK (undertime_min >= 0),
    status          TEXT         NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'disputed')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (worker_id, date)
);

CREATE INDEX idx_dtr_records_worker_date ON dtr_records(worker_id, date DESC);
CREATE INDEX idx_dtr_records_cutoff      ON dtr_records(cutoff_id);

-- ── Payroll runs & lines ──────────────────────────────────────────────────────

CREATE TABLE payroll_runs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cutoff_id    UUID        NOT NULL REFERENCES payroll_cutoffs(id),
    status       TEXT        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'processing', 'approved', 'exported')),
    generated_by UUID        NOT NULL REFERENCES workers(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_lines (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id  UUID          NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    worker_id       UUID          NOT NULL REFERENCES workers(id),
    gross_pay       NUMERIC(12,2) NOT NULL,
    sss             NUMERIC(10,2) NOT NULL DEFAULT 0,
    philhealth      NUMERIC(10,2) NOT NULL DEFAULT 0,
    pagibig         NUMERIC(10,2) NOT NULL DEFAULT 0,
    withholding_tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_pay         NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (payroll_run_id, worker_id)
);

-- ── Audit log (immutable — no UPDATE/DELETE on this table) ───────────────────

CREATE TABLE audit_log (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id  UUID        NOT NULL REFERENCES workers(id),
    action    TEXT        NOT NULL,   -- e.g. 'edit_attendance', 'approve_dtr'
    entity    TEXT        NOT NULL,   -- table name, e.g. 'attendance_events'
    entity_id UUID        NOT NULL,
    before    JSONB,
    after     JSONB,
    ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity    ON audit_log(entity, entity_id, ts DESC);
CREATE INDEX idx_audit_log_actor     ON audit_log(actor_id, ts DESC);
