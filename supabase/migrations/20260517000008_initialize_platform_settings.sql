-- Migration to initialize platform_settings and mark default password as changed
-- This resolves the infinite first-access password loop on production systems

-- 1. Insert a default row if none exists, marking the password as changed (true)
INSERT INTO public.platform_settings (platform_name, default_password_changed, remix_setup_completed)
SELECT 'Scale', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- 2. If a row already exists but has default_password_changed = false, update it to true
UPDATE public.platform_settings
SET default_password_changed = true
WHERE default_password_changed = false;
