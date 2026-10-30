-- Additive saved places. Precise coordinates are private; no public or CRM grants.
CREATE TABLE IF NOT EXISTS public.user_favorite_places (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('HOME','SCHOOL_WORK')),
 label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 120),
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,kind)
);
ALTER TABLE public.user_favorite_places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_favorite_places FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_places TO authenticated;
GRANT ALL ON public.user_favorite_places TO service_role;
CREATE POLICY favorite_places_own_select ON public.user_favorite_places FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY favorite_places_own_insert ON public.user_favorite_places FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY favorite_places_own_update ON public.user_favorite_places FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY favorite_places_own_delete ON public.user_favorite_places FOR DELETE TO authenticated USING(user_id=auth.uid());
-- Location must only be requested by explicit UI action. No background tracking.
