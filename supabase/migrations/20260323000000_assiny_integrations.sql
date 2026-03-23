-- Integrações com Assiny por usuário
CREATE TABLE IF NOT EXISTS public.assiny_integrations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL DEFAULT 'Assiny',
  form_id    uuid REFERENCES public.saved_forms(id) ON DELETE SET NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assiny_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assiny integrations"
  ON public.assiny_integrations FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Campos de compra Assiny nos leads
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS assiny_purchased  boolean     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assiny_checked_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assiny_amount     numeric     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assiny_product_name text      DEFAULT NULL;
