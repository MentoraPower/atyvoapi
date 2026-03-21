-- Impede submissões com nome, email ou telefone vazios
ALTER TABLE public.form_submissions
  ADD CONSTRAINT name_not_empty  CHECK (name  IS NULL OR trim(name)  <> ''),
  ADD CONSTRAINT email_not_empty CHECK (email IS NULL OR trim(email) <> ''),
  ADD CONSTRAINT phone_not_empty CHECK (phone IS NULL OR trim(phone) <> '');
