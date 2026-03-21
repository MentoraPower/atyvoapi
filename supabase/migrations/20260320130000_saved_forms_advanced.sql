-- Adiciona colunas de opções avançadas adicionais na tabela saved_forms
ALTER TABLE public.saved_forms
  ADD COLUMN IF NOT EXISTS hide_faturamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_area boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_redirect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_email boolean NOT NULL DEFAULT false;
