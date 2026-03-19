// script temporário para criar tabela saved_forms no Supabase
// executa via: node scripts/create-saved-forms-table.mjs
import https from 'https';

const SUPABASE_URL = 'https://wenmrdqdmjidloivjycs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlbm1yZHFkbWppZGxvaXZqeWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk0MzYyMiwiZXhwIjoyMDg3NTE5NjIyfQ.vF28_GYVVoijOpXJfLfECi8iU_6HGnDlmKTwbacPV5Q';

const sql = `
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
CREATE INDEX IF NOT EXISTS saved_forms_user_id_idx ON public.saved_forms (user_id);
ALTER TABLE public.saved_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_forms_select" ON public.saved_forms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_forms_insert" ON public.saved_forms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_forms_delete" ON public.saved_forms FOR DELETE USING (auth.uid() = user_id);
`;

const body = JSON.stringify({ query: sql });
const url = new URL('/pg/query', SUPABASE_URL.replace('https://', 'https://'));

const options = {
    hostname: `${SUPABASE_URL.replace('https://', '')}`,
    path: '/pg/query',
    method: 'POST',
    headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    }
};

const endpoint = `${SUPABASE_URL}/pg/query`;
const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
    },
    body
});
const data = await res.json();
console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));
