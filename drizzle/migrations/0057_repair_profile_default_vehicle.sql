ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_vehicle_description_length'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_vehicle_description_length
      CHECK (
        vehicle_description IS NULL OR
        (length(btrim(vehicle_description)) BETWEEN 1 AND 160)
      );
  END IF;
END;
$$;