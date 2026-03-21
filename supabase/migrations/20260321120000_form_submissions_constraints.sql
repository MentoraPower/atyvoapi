-- Impede submissões com nome, email ou telefone vazios
-- NOT VALID: aplica apenas a novas linhas, ignora dados históricos já existentes
ALTER TABLE public.form_submissions
  ADD CONSTRAINT name_not_empty  CHECK (name  IS NULL OR trim(name)  <> '') NOT VALID,
  ADD CONSTRAINT email_not_empty CHECK (email IS NULL OR trim(email) <> '') NOT VALID,
  ADD CONSTRAINT phone_not_empty CHECK (phone IS NULL OR trim(phone) <> '') NOT VALID;
