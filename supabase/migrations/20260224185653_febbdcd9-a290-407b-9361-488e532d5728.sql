CREATE POLICY "Allow anonymous deletes"
ON public.appointments
FOR DELETE
USING (true);

CREATE POLICY "Allow anonymous updates"
ON public.appointments
FOR UPDATE
USING (true);