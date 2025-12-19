-- Add Threads platform to the enum
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'threads';

-- Create social_posts table for tracking published content
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  link_url TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  target_accounts JSONB NOT NULL DEFAULT '[]',
  publish_results JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'publishing', 'published', 'partial', 'failed')),
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_id ON public.social_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON public.social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON public.social_posts(scheduled_at);

-- Enable RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_posts
CREATE POLICY "Members can view social posts"
  ON public.social_posts FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create social posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id) AND user_id = auth.uid());

CREATE POLICY "Users can update their own posts"
  ON public.social_posts FOR UPDATE
  USING (user_id = auth.uid() OR public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Admins can delete social posts"
  ON public.social_posts FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id) OR user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_social_posts_updated_at 
  BEFORE UPDATE ON public.social_posts 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();