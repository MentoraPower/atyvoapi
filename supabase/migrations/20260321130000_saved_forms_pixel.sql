-- Pixel e API de Conversões por formulário
ALTER TABLE public.saved_forms
  ADD COLUMN IF NOT EXISTS meta_pixel_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_capi_token text DEFAULT NULL;
