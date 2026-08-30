-- Prevent self-approval: requesters may no longer update their own approval rows.
DROP POLICY IF EXISTS "Approvers can update approvals" ON public.approvals;

CREATE POLICY "Assigned approver or workspace admin can update approvals"
ON public.approvals
FOR UPDATE
TO authenticated
USING (
  approver_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = approvals.post_id
      AND public.is_workspace_admin_or_owner(p.workspace_id)
  )
)
WITH CHECK (
  approver_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = approvals.post_id
      AND public.is_workspace_admin_or_owner(p.workspace_id)
  )
);