-- Permite que o form gerado (anon key) leia sua própria config do banco
CREATE POLICY "saved_forms_public_select" ON public.saved_forms
  FOR SELECT USING (true);
