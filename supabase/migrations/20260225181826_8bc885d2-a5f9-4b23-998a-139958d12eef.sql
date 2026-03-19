
-- Tabela de histórico de reagendamentos
CREATE TABLE public.reschedule_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  old_date DATE NOT NULL,
  old_time TEXT NOT NULL,
  new_date DATE NOT NULL,
  new_time TEXT NOT NULL,
  rescheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reschedule_history ENABLE ROW LEVEL SECURITY;

-- Policies (same anonymous access as appointments)
CREATE POLICY "Allow anonymous reads" ON public.reschedule_history FOR SELECT USING (true);
CREATE POLICY "Allow anonymous inserts" ON public.reschedule_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous deletes" ON public.reschedule_history FOR DELETE USING (true);
