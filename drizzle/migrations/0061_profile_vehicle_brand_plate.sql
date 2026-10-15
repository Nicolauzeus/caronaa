ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_brand text, ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_vehicle_brand_length CHECK (vehicle_brand IS NULL OR char_length(trim(vehicle_brand)) BETWEEN 1 AND 60), ADD CONSTRAINT profiles_vehicle_plate_format CHECK (vehicle_plate IS NULL OR vehicle_plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$');
COMMENT ON COLUMN public.profiles.vehicle_plate IS 'Owner-only vehicle registration; never include in public profile projections.';
NOTIFY pgrst, 'reload schema';