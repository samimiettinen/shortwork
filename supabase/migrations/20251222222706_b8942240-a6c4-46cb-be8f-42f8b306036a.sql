-- Add unique constraint for social_accounts upsert
ALTER TABLE public.social_accounts 
ADD CONSTRAINT social_accounts_workspace_platform_user_unique 
UNIQUE (workspace_id, platform, platform_user_id);