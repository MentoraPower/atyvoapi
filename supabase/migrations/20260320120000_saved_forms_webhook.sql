-- Adiciona colunas de opções avançadas na tabela saved_forms
ALTER TABLE public.saved_forms
  ADD COLUMN IF NOT EXISTS no_save boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_url text NOT NULL DEFAULT '';

-- Permissão de update para o próprio usuário (caso não exista)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_forms' AND policyname = 'saved_forms_update'
  ) THEN
    EXECUTE 'CREATE POLICY "saved_forms_update" ON public.saved_forms
      FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;
