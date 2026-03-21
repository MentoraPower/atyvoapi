-- Adiciona coluna redirect_url para redirecionamento personalizado após envio
ALTER TABLE public.saved_forms
  ADD COLUMN IF NOT EXISTS redirect_url text NOT NULL DEFAULT '';
