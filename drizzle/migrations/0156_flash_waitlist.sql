-- CARONAA F07 / Casca Unica: non-location Flash interest list
-- No precise GPS, route path, home address or payment fields are retained.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flash_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_municipality text NOT NULL,
  destination_municipality text,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('CAR','MOTO')),
  service_mode text NOT NULL CHECK (service_mode IN ('ON_ROUTE','EXCLUSIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flash_waitlist_unique_interest UNIQUE
    (user_id,origin_municipality,vehicle_type,service_mode)
);
ALTER TABLE public.flash_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flash_waitlist FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.flash_waitlist TO authenticated;

DROP POLICY IF EXISTS flash_waitlist_own_select ON public.flash_waitlist;
CREATE POLICY flash_waitlist_own_select ON public.flash_waitlist
 FOR SELECT TO authenticated USING (user_id=auth.uid());
DROP POLICY IF EXISTS flash_waitlist_own_insert ON public.flash_waitlist;
CREATE POLICY flash_waitlist_own_insert ON public.flash_waitlist
 FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS flash_waitlist_own_update ON public.flash_waitlist;
CREATE POLICY flash_waitlist_own_update ON public.flash_waitlist
 FOR UPDATE TO authenticated
 USING (user_id=auth.uid())
 WITH CHECK (user_id=auth.uid());

CREATE INDEX IF NOT EXISTS flash_waitlist_created_at_idx
  ON public.flash_waitlist (created_at DESC);
NOTIFY pgrst, 'reload schema';
COMMIT;
