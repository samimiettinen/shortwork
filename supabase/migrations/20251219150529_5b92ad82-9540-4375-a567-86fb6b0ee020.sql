-- Fix workspace INSERT policy - make it PERMISSIVE
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also fix workspace_members INSERT policy
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;

CREATE POLICY "Users can join workspaces"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());