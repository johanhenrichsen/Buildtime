-- Seed: roles and permissions per the BuildTime permission matrix.
-- All roles/permissions are data — adding new ones requires no code changes.

INSERT INTO permissions (name) VALUES
    ('checkin_kiosk'),
    ('view_own_dtr'),
    ('approve_ot_leave_crew'),   -- own crew only (Foreman)
    ('approve_ot_leave_all'),    -- any worker on site
    ('edit_attendance'),
    ('manage_workers_site'),     -- own site only
    ('manage_workers_all'),      -- all sites (HR)
    ('run_payroll'),
    ('view_labor_cost_site'),
    ('view_labor_cost_all'),
    ('system_config');

INSERT INTO roles (name) VALUES
    ('laborer'),
    ('foreman'),
    ('site_engineer'),
    ('safety_officer'),
    ('site_manager'),
    ('hr_officer'),
    ('payroll_accounting'),
    ('admin_it');

-- Role → permission assignments (mirrors the matrix in tech-spec.md §3)
WITH r AS (SELECT id, name FROM roles),
     p AS (SELECT id, name FROM permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM r, p WHERE
    (r.name = 'laborer'           AND p.name IN ('checkin_kiosk', 'view_own_dtr'))
 OR (r.name = 'foreman'           AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_crew'))
 OR (r.name = 'site_engineer'     AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_all', 'view_labor_cost_site'))
 OR (r.name = 'safety_officer'    AND p.name IN ('checkin_kiosk', 'view_own_dtr'))
 OR (r.name = 'site_manager'      AND p.name IN ('checkin_kiosk', 'view_own_dtr', 'approve_ot_leave_all',
                                                   'edit_attendance', 'manage_workers_site',
                                                   'view_labor_cost_site'))
 OR (r.name = 'hr_officer'        AND p.name IN ('edit_attendance', 'manage_workers_all'))
 OR (r.name = 'payroll_accounting' AND p.name IN ('run_payroll', 'view_labor_cost_all'))
 OR (r.name = 'admin_it'          AND p.name IN ('edit_attendance', 'manage_workers_all', 'system_config'));
