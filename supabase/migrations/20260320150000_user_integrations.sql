CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url text NOT NULL DEFAULT '',
  meta_pixel_id text NOT NULL DEFAULT '',
  gtm_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_integrations_select" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_integrations_insert" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_integrations_update" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);
