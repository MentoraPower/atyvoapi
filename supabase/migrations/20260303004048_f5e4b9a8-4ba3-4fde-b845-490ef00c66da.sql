
CREATE TABLE public.blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous reads" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Allow anonymous inserts" ON public.blocked_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous deletes" ON public.blocked_dates FOR DELETE USING (true);
