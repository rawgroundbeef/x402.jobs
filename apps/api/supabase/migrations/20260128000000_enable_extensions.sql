-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- Grant usage to public schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Create custom enum types
CREATE TYPE public.resource_health_status AS ENUM ('healthy', 'degraded', 'offline');
