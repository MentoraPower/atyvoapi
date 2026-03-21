-- Configuração dinâmica de campos por formulário
ALTER TABLE public.saved_forms
  ADD COLUMN IF NOT EXISTS fields_config jsonb DEFAULT NULL;

-- Campos customizados nas submissões
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT NULL;
