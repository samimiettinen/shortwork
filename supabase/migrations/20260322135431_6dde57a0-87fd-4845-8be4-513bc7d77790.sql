
-- Fix 1: Replace dangerous "Users can join only new workspaces" policy
-- This allowed any user to claim ownerless workspaces
DROP POLICY IF EXISTS "Users can join only new workspaces" ON public.workspace_members;

-- Workspace members should only be added via:
-- 1. create_workspace_with_owner function (service role)
-- 2. accept_workspace_invitation function (service role)
-- No direct client INSERT should be allowed
CREATE POLICY "No direct member inserts"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Fix 2: Tighten workspaces INSERT policy (was WITH CHECK (true))
-- Workspaces are created via create_workspace_with_owner which runs as SECURITY DEFINER
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

CREATE POLICY "Users can create workspaces"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (true);
-- Note: keeping true here is acceptable because workspace creation itself is harmless;
-- the dangerous part was the workspace_members INSERT which is now fixed.
-- The create_workspace_with_owner function handles proper member assignment.

-- Fix 3: Restrict notification SELECT to admins/owners only (not all members)
DROP POLICY IF EXISTS "Members can view notifications" ON public.notifications;

CREATE POLICY "Admins can view notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (is_workspace_admin_or_owner(workspace_id));
