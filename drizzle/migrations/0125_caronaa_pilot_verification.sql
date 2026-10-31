-- CARONAA pilot identities: additive schema change only.
-- No signup email bypass, no privileged browser writes, no automatic badges.
-- The four accounts are provisioned through Supabase Auth admin operations.
-- Assign CARONAA_TEST only to the two approved pilot users by their auth UUID,
-- after checking their exact authenticated email on the server.
ALTER TYPE public.user_verification_type ADD VALUE IF NOT EXISTS 'CARONAA_TEST';
