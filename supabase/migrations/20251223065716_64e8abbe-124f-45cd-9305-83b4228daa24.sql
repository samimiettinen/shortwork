-- Create storage bucket for social media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  104857600, -- 100MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
);

-- RLS policy: workspace members can upload files
CREATE POLICY "Workspace members can upload social media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-media' 
  AND (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- RLS policy: public can view files (needed for social media publishing)
CREATE POLICY "Social media files are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'social-media');

-- RLS policy: workspace members can delete their files
CREATE POLICY "Workspace members can delete social media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-media'
  AND (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM public.workspace_members WHERE user_id = auth.uid()
  )
);