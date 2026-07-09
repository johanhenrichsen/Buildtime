-- Add login credentials to workers for staff who need API/admin access.
-- Laborers never log in — only HR, managers, payroll, admin_it roles use these.
-- email is the login identifier; password_hash stores bcrypt output.

ALTER TABLE workers
    ADD COLUMN email         TEXT UNIQUE,
    ADD COLUMN password_hash TEXT;
