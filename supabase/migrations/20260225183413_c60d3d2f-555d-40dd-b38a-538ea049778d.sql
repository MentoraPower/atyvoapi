
-- Tabela de bloqueios recorrentes por dia da semana
CREATE TABLE public.blocked_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- Policies (admin access, same pattern as appointments)
CREATE POLICY "Allow anonymous reads" ON public.blocked_slots FOR SELECT USING (true);
CREATE POLICY "Allow anonymous inserts" ON public.blocked_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous updates" ON public.blocked_slots FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous deletes" ON public.blocked_slots FOR DELETE USING (true);

-- Index for quick lookups by day
CREATE INDEX idx_blocked_slots_day ON public.blocked_slots (day_of_week);
