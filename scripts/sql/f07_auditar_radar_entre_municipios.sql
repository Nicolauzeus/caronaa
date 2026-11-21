-- CARONAA - Inspect the deployed Flash radar RPC before declaring cross-city dispatch complete.
-- Read only. Run in Supabase SQL Editor as admin. Does not alter fares, rides or access.
SELECT p.oid::regprocedure::text AS function_signature,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS deployed_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'get_flash_driver_radar_orders',
    'quick_ride_driver_queue',
    'quick_ride_view_request',
    'quick_ride_accept',
    'respond_flash_order'
  )
ORDER BY p.proname;
-- Inspect get_flash_driver_radar_orders for equality comparisons between
-- passenger/driver municipality, coverage tables, GPS freshness and <= 15 km.
-- A read-only function listing cannot prove notification delivery to clients.
