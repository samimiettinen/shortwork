DELETE FROM public.oauth_tokens t
USING public.oauth_tokens newer
WHERE t.social_account_id = newer.social_account_id
  AND (
    newer.updated_at > t.updated_at
    OR (newer.updated_at = t.updated_at AND newer.id > t.id)
  );

ALTER TABLE public.oauth_tokens
ADD CONSTRAINT oauth_tokens_social_account_unique UNIQUE (social_account_id);