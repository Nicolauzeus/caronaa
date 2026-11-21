-- Diagnostico read-only: compare persistent flags vs genuinely recent server signals.
-- Execute in Supabase SQL Editor. Does not return exact coordinates or Pix.
WITH source AS (
 SELECT u.user_id,
   coalesce(f.is_online,false) AS flash_flag,
   coalesce(p.is_available,false) AS presence_flag,
   coalesce(f.is_online,false) AND coalesce(f.last_gps_at>now()-interval '90 seconds',false) AS flash_fresh,
   coalesce(p.is_available,false) AND coalesce(p.last_seen_at>now()-interval '90 seconds',false) AS presence_fresh,
   coalesce(f.last_sampled_at>now()-interval '90 seconds' AND f.last_gps_at>now()-interval '90 seconds'
       AND f.last_accuracy_m BETWEEN 0.0001 AND 150,false) AS flash_gps_valid,
   coalesce(l.sampled_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds'
       AND l.accuracy_m BETWEEN 0.0001 AND 150,false) AS standard_gps_valid,
   greatest(f.last_gps_at,p.last_seen_at,l.updated_at) AS latest_signal_at
 FROM (
  SELECT user_id FROM public.flash_driver_presence
  UNION SELECT user_id FROM public.professional_presence
 ) u
 LEFT JOIN public.flash_driver_presence f USING(user_id)
 LEFT JOIN public.professional_presence p USING(user_id)
 LEFT JOIN public.professional_driver_locations l USING(user_id)
)
SELECT
 count(*) FILTER(WHERE flash_flag OR presence_flag) AS legacy_marked_online,
 count(*) FILTER(WHERE flash_fresh OR presence_fresh) AS online_now,
 count(*) FILTER(WHERE (flash_fresh OR presence_fresh) AND (flash_gps_valid OR standard_gps_valid)) AS online_with_valid_gps,
 count(*) FILTER(WHERE (flash_flag OR presence_flag) AND NOT (flash_fresh OR presence_fresh)) AS phantom_online_stale_flag,
 count(*) FILTER(WHERE (flash_fresh OR presence_fresh) AND NOT (flash_gps_valid OR standard_gps_valid)) AS online_gps_needs_attention
FROM source;
