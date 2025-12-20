-- Fix 1: Workspace Join Policy - Only allow first member (workspace creator) to join
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;

CREATE POLICY "Users can join only new workspaces"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
    )
  );

-- Fix 2: Profiles - Restrict visibility to own profile, workspace members, or admins
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view limited profiles"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_app_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
      AND wm2.user_id = profiles.user_id
    )
  );