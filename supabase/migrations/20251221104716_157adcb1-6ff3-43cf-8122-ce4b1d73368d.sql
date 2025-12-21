-- Allow workspace deletion by admins/owners
CREATE POLICY "Admins can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (public.is_workspace_admin_or_owner(id));