-- Extensions used by the scheduler
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Internal config table; only the service role can read it.
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → totally locked to service_role.

-- Seed a random scheduler token if missing.
INSERT INTO public.app_config (key, value)
VALUES ('scheduler_token', encode(gen_random_bytes(48), 'hex'))
ON CONFLICT (key) DO NOTHING;
