-- Integrações com Guru Manager por usuário
CREATE TABLE IF NOT EXISTS public.guru_integrations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL DEFAULT 'Guru',
  api_token   text NOT NULL DEFAULT '',
  product_id  text NOT NULL DEFAULT '',
  form_id     uuid REFERENCES public.saved_forms(id) ON DELETE SET NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guru_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guru integrations"
  ON public.guru_integrations FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Resultado da verificação Guru por lead
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS guru_purchased  boolean     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guru_checked_at timestamptz DEFAULT NULL;

-- Permite que o usuário dono atualize os campos de verificação Guru
CREATE POLICY IF NOT EXISTS "Users update own submissions guru"
  ON public.form_submissions FOR UPDATE
  USING (auth.uid() = owner_id);
