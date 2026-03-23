-- Fila temporária de webhooks recebidos da Assiny
-- Registros são apagados automaticamente após 5 minutos pelo edge function
CREATE TABLE IF NOT EXISTS public.assiny_webhooks (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid NOT NULL,
  payload        jsonb NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  matched        boolean NOT NULL DEFAULT false,
  matched_ids    uuid[] DEFAULT NULL
);

ALTER TABLE public.assiny_webhooks ENABLE ROW LEVEL SECURITY;
