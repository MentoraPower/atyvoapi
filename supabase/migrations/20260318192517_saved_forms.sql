-- Migration: criar tabela saved_forms para a feature "Criar Formulário"
-- Acesso restrito por RLS ao próprio user_id

CREATE TABLE IF NOT EXISTS public.saved_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  product     text NOT NULL,
  bg_color    text NOT NULL DEFAULT '#fafafa',
  text_color  text NOT NULL DEFAULT '#111111',
  html_code   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida por user
CREATE INDEX IF NOT EXISTS saved_forms_user_id_idx ON public.saved_forms (user_id);

-- Habilita RLS
ALTER TABLE public.saved_forms ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio usuário pode ver seus formulários
CREATE POLICY "saved_forms_select" ON public.saved_forms
  FOR SELECT USING (auth.uid() = user_id);

-- Apenas o próprio usuário pode inserir
CREATE POLICY "saved_forms_insert" ON public.saved_forms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Apenas o próprio usuário pode deletar
CREATE POLICY "saved_forms_delete" ON public.saved_forms
  FOR DELETE USING (auth.uid() = user_id);
