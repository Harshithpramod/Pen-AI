-- The sandbox callback previously flattened verdict.details into the same
-- verification_evidence TEXT column as the human-readable evidence sentence
-- (JSON.stringify'd and concatenated), so the UI could only ever show one
-- undifferentiated blob of text. Store the structured payload separately so
-- the vulnerability detail view can render actual findings (rule, CWE tags,
-- file/line) instead of a wall of raw text, and record how long
-- verification took and when it finished.
ALTER TABLE public.vulnerabilities
  ADD COLUMN IF NOT EXISTS verification_details JSONB,
  ADD COLUMN IF NOT EXISTS verification_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ;
