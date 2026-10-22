-- Additive migration: existing court images remain published and unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS court_image_requests (
  id varchar(36) PRIMARY KEY,
  court_id varchar(20) NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  public_id text,
  replace_image_id varchar(20),
  previous_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by varchar(20)
);
CREATE INDEX IF NOT EXISTS idx_court_image_requests_court_status ON court_image_requests(court_id, status);
-- Pending URLs/review history are served only by the authorized backend.
ALTER TABLE court_image_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS ux_court_image_requests_pending_replacement
  ON court_image_requests(replace_image_id) WHERE status = 'PENDING' AND replace_image_id IS NOT NULL;
COMMIT;
