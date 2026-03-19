-- Remove duplicate appointments keeping only the most recent one per date+time
DELETE FROM public.appointments a
USING public.appointments b
WHERE a.appointment_date = b.appointment_date
  AND a.appointment_time = b.appointment_time
  AND a.created_at < b.created_at;

-- Now add unique constraint
ALTER TABLE public.appointments ADD CONSTRAINT unique_appointment_slot UNIQUE (appointment_date, appointment_time);