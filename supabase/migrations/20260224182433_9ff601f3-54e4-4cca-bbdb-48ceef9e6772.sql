CREATE TABLE public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google',
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.oauth_tokens
  FOR ALL USING (false);
