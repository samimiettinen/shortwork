-- Fix the workspace creation flow by returning the ID with just INSERT
-- The issue is that SELECT policy blocks the .select() after INSERT
-- because user is not yet a member of the workspace

-- Create a function to handle workspace creation atomically
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  workspace_name TEXT,
  workspace_timezone TEXT DEFAULT 'UTC'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Create the workspace
  INSERT INTO public.workspaces (name, timezone)
  VALUES (workspace_name, workspace_timezone)
  RETURNING id INTO new_workspace_id;
  
  -- Add the creator as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, current_user_id, 'owner');
  
  RETURN new_workspace_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner TO authenticated;