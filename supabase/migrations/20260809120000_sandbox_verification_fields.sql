-- Add 'pending' and 'failed' to verification_status enum so the UI can
-- distinguish "sandbox job submitted" from "not yet submitted".
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'confirmed';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'failed' AFTER 'not_exploitable';

-- Store the sandbox job ID against each vulnerability so we can correlate
-- callbacks and let users check job status.
ALTER TABLE public.vulnerabilities
  ADD COLUMN IF NOT EXISTS sandbox_job_id TEXT;
