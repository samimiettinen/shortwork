ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'partial';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'needs_user_action';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS posts_client_request_id
  ON public.posts (workspace_id, created_by, client_request_id);
ALTER TABLE public.post_targets ADD COLUMN IF NOT EXISTS remote_post_url text;
