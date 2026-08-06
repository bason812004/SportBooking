ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(30),
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_response_json JSONB;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_provider_tx_id
  ON withdrawal_requests (provider_transaction_id);
