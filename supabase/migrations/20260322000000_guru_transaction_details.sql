-- Detalhes da transação Guru por lead
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS guru_amount       numeric  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guru_product_name text     DEFAULT NULL;
