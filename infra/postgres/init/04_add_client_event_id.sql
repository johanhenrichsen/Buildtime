-- Idempotency key for kiosk→API attendance sync.
-- Kiosks generate a UUID per event locally; the server uses this to de-duplicate
-- retried syncs without creating duplicate attendance records.

ALTER TABLE attendance_events
    ADD COLUMN client_event_id TEXT;

CREATE UNIQUE INDEX uix_attendance_client_event_id
    ON attendance_events (kiosk_id, client_event_id)
    WHERE client_event_id IS NOT NULL;
