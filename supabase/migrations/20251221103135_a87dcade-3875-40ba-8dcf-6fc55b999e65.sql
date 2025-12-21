-- Create invitation status enum
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Create workspace invitations table
CREATE TABLE public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for token lookups
CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations(email);

-- Enable RLS
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins/owners can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.workspace_invitations FOR INSERT
  WITH CHECK (is_workspace_admin_or_owner(workspace_id) AND invited_by = auth.uid());

-- Policy: Admins/owners can view invitations for their workspace
CREATE POLICY "Admins can view invitations"
  ON public.workspace_invitations FOR SELECT
  USING (is_workspace_admin_or_owner(workspace_id));

-- Policy: Admins/owners can update (cancel) invitations
CREATE POLICY "Admins can update invitations"
  ON public.workspace_invitations FOR UPDATE
  USING (is_workspace_admin_or_owner(workspace_id));

-- Policy: Admins/owners can delete invitations
CREATE POLICY "Admins can delete invitations"
  ON public.workspace_invitations FOR DELETE
  USING (is_workspace_admin_or_owner(workspace_id));

-- Function to accept invitation (uses service role via edge function)
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(invitation_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the invitation
  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Check if user email matches invitation email
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = v_user_id 
    AND LOWER(email) = LOWER(v_invitation.email)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = v_invitation.workspace_id
    AND user_id = v_user_id
  ) THEN
    -- Update invitation status anyway
    UPDATE workspace_invitations
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = v_invitation.id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add user to workspace
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, v_user_id, v_invitation.role);

  -- Update invitation status
  UPDATE workspace_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true, 
    'workspace_id', v_invitation.workspace_id,
    'role', v_invitation.role
  );
END;
$$;

-- Add updated_at trigger
CREATE TRIGGER update_workspace_invitations_updated_at
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();