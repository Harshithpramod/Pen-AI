
-- Explicit deny for github_connections to authenticated/anon (server-only table)
CREATE POLICY "No client access to github_connections"
  ON public.github_connections FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- Trigger-only functions: no user should call them directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is invoked by RLS policies; authenticated users must be able to execute it,
-- but anon/public should not.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
