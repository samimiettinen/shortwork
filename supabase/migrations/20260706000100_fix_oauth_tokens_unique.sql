-- oauth_tokens had no unique constraint on social_account_id, and social-auth
-- "upserted" without a conflict target. Every reconnect inserted a duplicate
-- row, and publishing read an arbitrary one (often a stale token). Fix by
-- deduplicating (keep the most recently updated row per account) and adding
-- the missing constraint so upserts actually update in place.

DELETE FROM public.oauth_tokens t
USING public.oauth_tokens newer
WHERE t.social_account_id = newer.social_account_id
  AND (
    newer.updated_at > t.updated_at
    OR (newer.updated_at = t.updated_at AND newer.id > t.id)
  );

ALTER TABLE public.oauth_tokens
ADD CONSTRAINT oauth_tokens_social_account_unique UNIQUE (social_account_id);
