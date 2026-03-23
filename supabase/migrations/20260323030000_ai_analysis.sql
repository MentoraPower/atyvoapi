-- Coluna para guardar análise de IA por lead
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS ai_analysis      text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_analysis_at   timestamptz  DEFAULT NULL;

-- Permite que usuários autenticados atualizem seus próprios leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'form_submissions'
      AND policyname = 'Users update own submissions'
  ) THEN
    CREATE POLICY "Users update own submissions"
      ON public.form_submissions FOR UPDATE
      USING (auth.uid() = owner_id::uuid);
  END IF;
END $$;
