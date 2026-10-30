-- A SELECT policy alone does not make an existing public bucket private.
UPDATE storage.buckets SET public = false, file_size_limit = 104857600
WHERE id = 'social-media';
