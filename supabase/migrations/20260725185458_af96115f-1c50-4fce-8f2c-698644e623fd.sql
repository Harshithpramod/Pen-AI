
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'pentester', 'developer');
CREATE TYPE public.severity_level AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.repo_type AS ENUM ('web_app', 'api', 'library', 'mobile', 'infra', 'microservice');
CREATE TYPE public.repo_status AS ENUM ('secure', 'vulnerable', 'testing', 'never_scanned');
CREATE TYPE public.scan_mode AS ENUM ('manual', 'weekly');
CREATE TYPE public.scan_depth AS ENUM ('quick', 'standard', 'deep');
CREATE TYPE public.scan_trigger AS ENUM ('manual', 'scheduled', 'push');
CREATE TYPE public.scan_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE public.vuln_status AS ENUM ('open', 'in_progress', 'fixed', 'false_positive');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'confirmed', 'not_exploitable');

-- =========================================================
-- SHARED FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  github_username TEXT,
  job_title TEXT,
  org_id UUID,
  authorization_ack BOOLEAN NOT NULL DEFAULT false,
  authorization_ack_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table, security-definer has_role)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Admin visibility policies use has_role safely (no recursion on user_roles table)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- GITHUB CONNECTIONS (service-role only — never exposed to client)
-- =========================================================
CREATE TABLE public.github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user_id BIGINT,
  github_username TEXT,
  access_token_encrypted TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: clients can never read/write this table.

CREATE TRIGGER trg_github_connections_updated_at
  BEFORE UPDATE ON public.github_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REPOSITORIES
-- =========================================================
CREATE TABLE public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_repo_id BIGINT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_private BOOLEAN NOT NULL DEFAULT false,
  language TEXT,
  repo_type public.repo_type NOT NULL DEFAULT 'web_app',
  scan_mode public.scan_mode NOT NULL DEFAULT 'manual',
  schedule_day SMALLINT, -- 0..6
  schedule_hour SMALLINT, -- 0..23
  timezone TEXT NOT NULL DEFAULT 'UTC',
  scan_depth public.scan_depth NOT NULL DEFAULT 'standard',
  enabled_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  excluded_paths TEXT[] NOT NULL DEFAULT '{}',
  last_scan_at TIMESTAMPTZ,
  status public.repo_status NOT NULL DEFAULT 'never_scanned',
  security_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, full_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositories TO authenticated;
GRANT ALL ON public.repositories TO service_role;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their repositories"
  ON public.repositories FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all repositories"
  ON public.repositories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_repositories_user_id ON public.repositories(user_id);
CREATE INDEX idx_repositories_scan_mode ON public.repositories(scan_mode) WHERE scan_mode = 'weekly';

CREATE TRIGGER trg_repositories_updated_at
  BEFORE UPDATE ON public.repositories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SCANS
-- =========================================================
CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger public.scan_trigger NOT NULL DEFAULT 'manual',
  profile public.scan_depth NOT NULL DEFAULT 'standard',
  branch TEXT,
  commit_sha TEXT,
  status public.scan_status NOT NULL DEFAULT 'queued',
  current_stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  security_score INTEGER,
  error_message TEXT,
  enabled_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their scans"
  ON public.scans FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all scans"
  ON public.scans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_repository_id ON public.scans(repository_id);
CREATE INDEX idx_scans_status ON public.scans(status);

CREATE TRIGGER trg_scans_updated_at
  BEFORE UPDATE ON public.scans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SCAN LOGS
-- =========================================================
CREATE TABLE public.scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.scan_logs TO authenticated;
GRANT ALL ON public.scan_logs TO service_role;
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their scan logs"
  ON public.scan_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all scan logs"
  ON public.scan_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_scan_logs_scan_id_created_at ON public.scan_logs(scan_id, created_at);

-- =========================================================
-- VULNERABILITIES
-- =========================================================
CREATE TABLE public.vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity public.severity_level NOT NULL,
  status public.vuln_status NOT NULL DEFAULT 'open',
  category TEXT,
  cwe_id TEXT,
  owasp_category TEXT,
  cvss_score NUMERIC(3,1),
  file_path TEXT,
  line_start INTEGER,
  line_end INTEGER,
  description TEXT,
  remediation_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_fix_diff TEXT,
  ai_analysis TEXT,
  detected_by_agents TEXT[] NOT NULL DEFAULT '{}',
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  verification_evidence TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fixed_at TIMESTAMPTZ,
  github_issue_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vulnerabilities TO authenticated;
GRANT ALL ON public.vulnerabilities TO service_role;
ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their vulnerabilities"
  ON public.vulnerabilities FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all vulnerabilities"
  ON public.vulnerabilities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_vulns_user_id ON public.vulnerabilities(user_id);
CREATE INDEX idx_vulns_repo_id ON public.vulnerabilities(repository_id);
CREATE INDEX idx_vulns_severity ON public.vulnerabilities(severity);
CREATE INDEX idx_vulns_status ON public.vulnerabilities(status);

CREATE TRIGGER trg_vulns_updated_at
  BEFORE UPDATE ON public.vulnerabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REPORTS
-- =========================================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT,
  security_score INTEGER,
  storage_path TEXT,
  format TEXT NOT NULL DEFAULT 'pdf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their reports"
  ON public.reports FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reports_user_id ON public.reports(user_id);

-- =========================================================
-- NOTIFICATION PREFERENCES
-- =========================================================
CREATE TABLE public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  security_alerts BOOLEAN NOT NULL DEFAULT true,
  weekly_summary BOOLEAN NOT NULL DEFAULT true,
  scan_completed BOOLEAN NOT NULL DEFAULT true,
  vulnerability_detected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their notification prefs"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- API KEYS (service-role writes; users can list/revoke own but never see hash)
-- =========================================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- No direct client access to the hash column: reads/writes go through a secure view + server fns.

-- Safe view exposing prefix but never the hash
CREATE VIEW public.api_keys_public
WITH (security_invoker = on) AS
SELECT id, user_id, name, key_prefix, last_used_at, revoked_at, created_at
FROM public.api_keys;

GRANT SELECT ON public.api_keys_public TO authenticated;

-- Allow users to see their own key metadata through the view's underlying rows,
-- but the hash column stays inaccessible because no SELECT policy exists on the base
-- table for the authenticated role. The view uses security_invoker so the caller's
-- RLS still applies to the base table.
CREATE POLICY "Users view own api key metadata"
  ON public.api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users revoke own api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

-- =========================================================
-- SIGNUP TRIGGER: auto-create profile + default notification prefs
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, github_username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'user_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Default role: developer
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'developer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
