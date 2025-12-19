-- ShortsPublish Database Schema

-- Create enums
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'editor', 'approver', 'viewer');
CREATE TYPE public.platform_type AS ENUM ('instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'bluesky');
CREATE TYPE public.account_type AS ENUM ('page', 'profile', 'business', 'creator', 'personal');
CREATE TYPE public.account_status AS ENUM ('connected', 'needs_refresh', 'disconnected', 'error');
CREATE TYPE public.asset_type AS ENUM ('video', 'image');
CREATE TYPE public.transcode_status AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE public.post_status AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'canceled');
CREATE TYPE public.post_target_status AS ENUM ('queued', 'publishing', 'published', 'needs_user_action', 'failed', 'skipped');
CREATE TYPE public.job_status AS ENUM ('queued', 'processing', 'done', 'failed', 'retry_scheduled');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.notification_status AS ENUM ('queued', 'sent', 'failed');

-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace members table
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Social accounts table
CREATE TABLE public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  account_type account_type NOT NULL DEFAULT 'personal',
  display_name TEXT NOT NULL,
  handle TEXT,
  platform_user_id TEXT,
  avatar_url TEXT,
  autopublish_capable BOOLEAN NOT NULL DEFAULT false,
  status account_status NOT NULL DEFAULT 'connected',
  last_connected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth tokens table (encrypted at rest)
CREATE TABLE public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assets table (media files)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL,
  type asset_type NOT NULL,
  original_storage_path TEXT NOT NULL,
  processed_storage_path TEXT,
  thumbnail_storage_path TEXT,
  mime TEXT NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  checksum_sha256 TEXT,
  transcode_status transcode_status NOT NULL DEFAULT 'pending',
  validation_report JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status post_status NOT NULL DEFAULT 'draft',
  title TEXT,
  body_text TEXT,
  link_url TEXT,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  tags TEXT[] DEFAULT '{}',
  per_channel_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post targets table (one per post x channel)
CREATE TABLE public.post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  status post_target_status NOT NULL DEFAULT 'queued',
  remote_post_id TEXT,
  publish_attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  last_attempt_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Publish jobs table
CREATE TABLE public.publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_target_id UUID NOT NULL REFERENCES public.post_targets(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE NOT NULL,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approvals table
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  approver_user_id UUID,
  status approval_status NOT NULL DEFAULT 'pending',
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table (for notification publishing)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  post_target_id UUID REFERENCES public.post_targets(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_social_accounts_workspace_id ON public.social_accounts(workspace_id);
CREATE INDEX idx_assets_workspace_id ON public.assets(workspace_id);
CREATE INDEX idx_posts_workspace_id ON public.posts(workspace_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_scheduled_at ON public.posts(scheduled_at);
CREATE INDEX idx_post_targets_post_id ON public.post_targets(post_id);
CREATE INDEX idx_post_targets_social_account_id ON public.post_targets(social_account_id);
CREATE INDEX idx_publish_jobs_run_at_status ON public.publish_jobs(run_at, status);
CREATE INDEX idx_publish_jobs_next_retry_at ON public.publish_jobs(next_retry_at);
CREATE INDEX idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  )
$$;

-- Security definer function to check workspace role
CREATE OR REPLACE FUNCTION public.has_workspace_role(ws_id UUID, required_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id 
    AND user_id = auth.uid()
    AND role = required_role
  )
$$;

-- Security definer function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id 
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
$$;

-- Get user's workspaces function
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

-- RLS Policies for workspaces
CREATE POLICY "Users can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.is_workspace_admin_or_owner(id));

-- RLS Policies for workspace_members
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can join workspaces"
  ON public.workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Admins can delete workspace members"
  ON public.workspace_members FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- RLS Policies for social_accounts
CREATE POLICY "Members can view social accounts"
  ON public.social_accounts FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins can manage social accounts"
  ON public.social_accounts FOR INSERT
  WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Admins can update social accounts"
  ON public.social_accounts FOR UPDATE
  USING (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Admins can delete social accounts"
  ON public.social_accounts FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- RLS Policies for oauth_tokens (only admins)
CREATE POLICY "Admins can view tokens"
  ON public.oauth_tokens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.social_accounts sa
    WHERE sa.id = social_account_id
    AND public.is_workspace_admin_or_owner(sa.workspace_id)
  ));

CREATE POLICY "Admins can manage tokens"
  ON public.oauth_tokens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.social_accounts sa
    WHERE sa.id = social_account_id
    AND public.is_workspace_admin_or_owner(sa.workspace_id)
  ));

-- RLS Policies for assets
CREATE POLICY "Members can view assets"
  ON public.assets FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can upload assets"
  ON public.assets FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id) AND uploader_user_id = auth.uid());

CREATE POLICY "Uploaders can update their assets"
  ON public.assets FOR UPDATE
  USING (uploader_user_id = auth.uid());

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- RLS Policies for posts
CREATE POLICY "Members can view posts"
  ON public.posts FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Creators can update their posts"
  ON public.posts FOR UPDATE
  USING (created_by = auth.uid() OR public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Admins can delete posts"
  ON public.posts FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id) OR created_by = auth.uid());

-- RLS Policies for post_targets
CREATE POLICY "Members can view post targets"
  ON public.post_targets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND public.is_workspace_member(p.workspace_id)
  ));

CREATE POLICY "Members can manage post targets"
  ON public.post_targets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND public.is_workspace_member(p.workspace_id)
  ));

-- RLS Policies for publish_jobs
CREATE POLICY "Members can view publish jobs"
  ON public.publish_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.post_targets pt
    JOIN public.posts p ON p.id = pt.post_id
    WHERE pt.id = post_target_id AND public.is_workspace_member(p.workspace_id)
  ));

-- RLS Policies for approvals
CREATE POLICY "Members can view approvals"
  ON public.approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND public.is_workspace_member(p.workspace_id)
  ));

CREATE POLICY "Members can create approvals"
  ON public.approvals FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND public.is_workspace_member(p.workspace_id)
  ));

CREATE POLICY "Approvers can update approvals"
  ON public.approvals FOR UPDATE
  USING (approver_user_id = auth.uid() OR requested_by = auth.uid());

-- RLS Policies for audit_logs
CREATE POLICY "Members can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id) AND actor_user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Members can view notifications"
  ON public.notifications FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON public.oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_targets_updated_at BEFORE UPDATE ON public.post_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_publish_jobs_updated_at BEFORE UPDATE ON public.publish_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();