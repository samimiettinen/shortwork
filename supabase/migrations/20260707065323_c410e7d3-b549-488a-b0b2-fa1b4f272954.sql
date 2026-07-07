
-- audit_logs immutability
DROP POLICY IF EXISTS "Audit logs are immutable" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON public.audit_logs;

CREATE POLICY "Audit logs are immutable"
  ON public.audit_logs FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON public.audit_logs FOR DELETE
  USING (false);

-- notifications: explicit deny for client writes (service role bypasses RLS)
DROP POLICY IF EXISTS "No client inserts to notifications" ON public.notifications;
DROP POLICY IF EXISTS "No client updates to notifications" ON public.notifications;
DROP POLICY IF EXISTS "No client deletes on notifications" ON public.notifications;

CREATE POLICY "No client inserts to notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates to notifications"
  ON public.notifications FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client deletes on notifications"
  ON public.notifications FOR DELETE
  USING (false);

-- workspaces: replace WITH CHECK (true)
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Revoke EXECUTE from public/anon/authenticated on internal SECURITY DEFINER helpers.
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_app_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_publish_scheduled() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_publish_scheduled() TO service_role;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) TO authenticated, service_role;

-- Storage: restrict SELECT on social-media to workspace folder members
DROP POLICY IF EXISTS "Social media files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Workspace members can read social media files" ON storage.objects;

CREATE POLICY "Workspace members can read social media files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] IN (
      SELECT workspace_id::text
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );
