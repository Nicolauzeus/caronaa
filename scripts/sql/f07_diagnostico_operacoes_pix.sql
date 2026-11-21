-- Read-only F07 diagnostic. Run in Supabase SQL editor with administrator privileges.
-- Do not export or expose drivers' raw Pix keys.
SELECT
 COUNT(*) FILTER(WHERE coalesce(f.is_online,false)) AS flash_online,
 COUNT(*) FILTER(WHERE coalesce(p.is_available,false)) AS professional_online,
 COUNT(*) FILTER(WHERE coalesce(f.is_online,false) OR coalesce(p.is_available,false)) AS online_union,
 COUNT(*) FILTER(WHERE coalesce(f.is_online,false) AND coalesce(p.is_available,false)) AS online_both,
 COUNT(*) FILTER(WHERE (coalesce(f.is_online,false) OR coalesce(p.is_available,false))
   AND (l.sampled_at IS NULL OR l.sampled_at < now()-interval '90 seconds')) AS online_with_stale_gps
FROM (
 SELECT user_id FROM public.flash_driver_presence
 UNION SELECT user_id FROM public.professional_presence
) u
LEFT JOIN public.flash_driver_presence f USING(user_id)
LEFT JOIN public.professional_presence p USING(user_id)
LEFT JOIN public.professional_driver_locations l USING(user_id);

SELECT
 status,
 COUNT(*) AS total,
 COUNT(*) FILTER(WHERE driver_id IS NOT NULL) AS assigned
FROM public.professional_quick_rides
GROUP BY status ORDER BY status;

-- Drivers with completed rides but no currently stored Pix key.
-- A missing row cannot prove when/how it was removed.
SELECT q.driver_id,
 COUNT(*) AS completed_trips_without_stored_key,
 MAX(q.completed_at) AS most_recent_completion,
 EXISTS(SELECT 1 FROM public.driver_pix_settings d WHERE d.user_id=q.driver_id) AS pix_row_exists
FROM public.professional_quick_rides q
LEFT JOIN public.driver_pix_settings d ON d.user_id=q.driver_id
WHERE q.status='COMPLETED'
  AND (d.user_id IS NULL OR nullif(btrim(d.pix_key),'') IS NULL)
GROUP BY q.driver_id
ORDER BY completed_trips_without_stored_key DESC,most_recent_completion DESC;
