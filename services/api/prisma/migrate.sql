-- BuildTime combined idempotent schema migration.
-- Safe to run on every deploy: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Roles & permissions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ── Sites ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
    id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT             NOT NULL,
    address    TEXT,
    geo_lat    DOUBLE PRECISION,
    geo_lng    DOUBLE PRECISION,
    project_id UUID,
    status     TEXT             NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- ── Kiosks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kiosks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      UUID        NOT NULL REFERENCES sites(id),
    device_key   TEXT        NOT NULL UNIQUE,
    last_sync_at TIMESTAMPTZ,
    status       TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Workers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_no        TEXT          NOT NULL UNIQUE,
    name               TEXT          NOT NULL,
    role_id            UUID          NOT NULL REFERENCES roles(id),
    employment_type    TEXT          NOT NULL
                       CHECK (employment_type IN ('regular', 'project-based', 'casual')),
    daily_rate         NUMERIC(10,2) NOT NULL,
    hire_date          DATE          NOT NULL,
    status             TEXT          NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'inactive', 'terminated')),
    national_id_enc    BYTEA,
    sss_enc            BYTEA,
    philhealth_enc     BYTEA,
    pagibig_enc        BYTEA,
    tin_enc            BYTEA,
    face_embedding_ref UUID,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Face embeddings ───────────────────────────────────────────────────────────
-- Uses 128-dim (face-api.js FaceRecognitionNet / FaceNet).
CREATE TABLE IF NOT EXISTS face_embeddings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id        UUID        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    embedding_vector vector(128) NOT NULL,
    quality_score    FLOAT       NOT NULL CHECK (quality_score BETWEEN 0.0 AND 1.0),
    enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    enrolled_by      UUID        NOT NULL REFERENCES workers(id),
    active           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_face_embeddings_one_active
    ON face_embeddings(worker_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_face_embeddings_ivfflat
    ON face_embeddings USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

DO $$ BEGIN
    ALTER TABLE workers
        ADD CONSTRAINT fk_workers_face_embedding
        FOREIGN KEY (face_embedding_ref) REFERENCES face_embeddings(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Attendance events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_events (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id          UUID        NOT NULL REFERENCES workers(id),
    site_id            UUID        NOT NULL REFERENCES sites(id),
    kiosk_id           UUID        NOT NULL REFERENCES kiosks(id),
    event_type         TEXT        NOT NULL CHECK (event_type IN ('in', 'out')),
    client_ts          TIMESTAMPTZ NOT NULL,
    server_ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confidence_score   FLOAT       NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    match_method       TEXT        NOT NULL
                       CHECK (match_method IN ('face', 'face_low_confidence', 'manual_exception')),
    flagged_for_review BOOLEAN     NOT NULL DEFAULT false,
    synced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_worker_ts
    ON attendance_events(worker_id, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_events_site_ts
    ON attendance_events(site_id, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_events_flagged
    ON attendance_events(flagged_for_review) WHERE flagged_for_review = true;

-- ── Payroll cutoffs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_cutoffs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE        NOT NULL,
    period_end   DATE        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'processing', 'closed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cutoff_dates CHECK (period_end > period_start)
);

-- ── DTR records ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dtr_records (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id      UUID          NOT NULL REFERENCES workers(id),
    cutoff_id      UUID          NOT NULL REFERENCES payroll_cutoffs(id),
    date           DATE          NOT NULL,
    regular_hrs    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (regular_hrs >= 0),
    ot_hrs         NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (ot_hrs >= 0),
    night_diff_hrs NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (night_diff_hrs >= 0),
    late_min       INTEGER       NOT NULL DEFAULT 0  CHECK (late_min >= 0),
    undertime_min  INTEGER       NOT NULL DEFAULT 0  CHECK (undertime_min >= 0),
    status         TEXT          NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'approved', 'disputed')),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (worker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_dtr_records_worker_date ON dtr_records(worker_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dtr_records_cutoff      ON dtr_records(cutoff_id);

-- ── Payroll runs & lines ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cutoff_id    UUID        NOT NULL REFERENCES payroll_cutoffs(id),
    status       TEXT        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'processing', 'approved', 'exported')),
    generated_by UUID        NOT NULL REFERENCES workers(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_lines (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID          NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    worker_id      UUID          NOT NULL REFERENCES workers(id),
    gross_pay      NUMERIC(12,2) NOT NULL,
    sss            NUMERIC(10,2) NOT NULL DEFAULT 0,
    philhealth     NUMERIC(10,2) NOT NULL DEFAULT 0,
    pagibig        NUMERIC(10,2) NOT NULL DEFAULT 0,
    withholding_tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_pay        NUMERIC(12,2) NOT NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (payroll_run_id, worker_id)
);

-- ── Audit log (immutable) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id  UUID        NOT NULL REFERENCES workers(id),
    action    TEXT        NOT NULL,
    entity    TEXT        NOT NULL,
    entity_id UUID        NOT NULL,
    before    JSONB,
    after     JSONB,
    ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor  ON audit_log(actor_id, ts DESC);

-- ── Incremental column additions (idempotent) ─────────────────────────────────

-- 03: worker login credentials
DO $$ BEGIN
    ALTER TABLE workers ADD COLUMN email TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE workers ADD COLUMN password_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 04: kiosk event idempotency key
DO $$ BEGIN
    ALTER TABLE attendance_events ADD COLUMN client_event_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uix_attendance_client_event_id
    ON attendance_events (kiosk_id, client_event_id)
    WHERE client_event_id IS NOT NULL;

-- ── Cash advances ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_advances (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id    UUID          NOT NULL REFERENCES workers(id),
    amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason       TEXT          NOT NULL,
    status       TEXT          NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'deducted')),
    requested_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    reviewed_by  UUID          REFERENCES workers(id),
    reviewed_at  TIMESTAMPTZ,
    review_note  TEXT,
    cutoff_id    UUID          REFERENCES payroll_cutoffs(id),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_advances_worker  ON cash_advances(worker_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_advances_status  ON cash_advances(status) WHERE status = 'pending';

-- 05: make kiosk_id nullable to allow manual admin attendance entries
DO $$ BEGIN
    ALTER TABLE attendance_events ALTER COLUMN kiosk_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Seed: roles & permissions ─────────────────────────────────────────────────
INSERT INTO permissions (name) VALUES
    ('checkin_kiosk'),
    ('view_own_dtr'),
    ('approve_ot_leave_crew'),
    ('approve_ot_leave_all'),
    ('edit_attendance'),
    ('manage_workers_site'),
    ('manage_workers_all'),
    ('run_payroll'),
    ('view_labor_cost_site'),
    ('view_labor_cost_all'),
    ('system_config')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name) VALUES
    ('laborer'),
    ('foreman'),
    ('site_engineer'),
    ('safety_officer'),
    ('site_manager'),
    ('hr_officer'),
    ('payroll_accounting'),
    ('admin_it')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE
    (r.name = 'laborer'            AND p.name IN ('checkin_kiosk', 'view_own_dtr'))
 OR (r.name = 'foreman'            AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_crew'))
 OR (r.name = 'site_engineer'      AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_all', 'view_labor_cost_site'))
 OR (r.name = 'safety_officer'     AND p.name IN ('checkin_kiosk', 'view_own_dtr'))
 OR (r.name = 'site_manager'       AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_all',
                                                    'edit_attendance', 'manage_workers_site', 'view_labor_cost_site'))
 OR (r.name = 'hr_officer'         AND p.name IN ('edit_attendance', 'manage_workers_all'))
 OR (r.name = 'payroll_accounting' AND p.name IN ('run_payroll', 'view_labor_cost_all'))
 OR (r.name = 'admin_it'           AND p.name IN ('edit_attendance', 'manage_workers_all', 'system_config'))
ON CONFLICT DO NOTHING;
