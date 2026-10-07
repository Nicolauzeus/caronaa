CREATE OR REPLACE FUNCTION public.are_ride_routes_compatible(
  request_origin text, request_destination text,
  request_origin_lat double precision, request_origin_lng double precision,
  request_destination_lat double precision, request_destination_lng double precision,
  offer_origin text, offer_destination text,
  offer_origin_lat double precision, offer_origin_lng double precision,
  offer_destination_lat double precision, offer_destination_lng double precision,
  tolerance_km double precision DEFAULT 2
)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN public.has_route_coordinates(
      request_origin_lat, request_origin_lng, request_destination_lat, request_destination_lng
    ) AND public.has_route_coordinates(
      offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng
    )
    THEN (
        (request_destination_lat - request_origin_lat) * (offer_destination_lat - offer_origin_lat)
        + (request_destination_lng - request_origin_lng) * (offer_destination_lng - offer_origin_lng)
          * power(cos(radians(offer_origin_lat)), 2)
      ) > 0 AND public.is_point_compatible_with_route(
        request_origin_lat, request_origin_lng,
        offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng,
        offer_origin_lat, offer_origin_lng, tolerance_km
      )
      AND public.is_point_compatible_with_route(
        request_destination_lat, request_destination_lng,
        offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng,
        offer_destination_lat, offer_destination_lng, tolerance_km
      )
      AND public.distance_km(request_origin_lat, request_origin_lng, request_destination_lat, request_destination_lng) > 0
      AND public.distance_km(offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng) > 0
    WHEN (request_origin_lat BETWEEN -90 AND 90 AND request_origin_lng BETWEEN -180 AND 180)
      OR (request_destination_lat BETWEEN -90 AND 90 AND request_destination_lng BETWEEN -180 AND 180)
      OR (offer_origin_lat BETWEEN -90 AND 90 AND offer_origin_lng BETWEEN -180 AND 180)
      OR (offer_destination_lat BETWEEN -90 AND 90 AND offer_destination_lng BETWEEN -180 AND 180)
    THEN false
    ELSE lower(btrim(request_origin)) = lower(btrim(offer_origin))
      AND lower(btrim(request_destination)) = lower(btrim(offer_destination))
      AND lower(btrim(request_origin)) <> lower(btrim(request_destination))
  END;
$$;
