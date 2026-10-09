-- Contact and relationship data contains personal information. Keep public
-- submissions, but restrict CRM reads and mutations to database admins.
DROP POLICY IF EXISTS "Allow authenticated read pitch_contacts"
  ON public.pitch_contacts;
DROP POLICY IF EXISTS "Allow authenticated update pitch_contacts"
  ON public.pitch_contacts;

CREATE POLICY "Admins can read pitch contacts"
  ON public.pitch_contacts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pitch contacts"
  ON public.pitch_contacts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
