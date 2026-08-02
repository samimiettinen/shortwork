CREATE POLICY "social_media_workspace_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'social-media'
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'social-media'
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = (storage.foldername(name))[1]
  )
);