-- Migration to fix Super Admin First Access RLS / column permission issues
-- Creates SECURITY DEFINER functions with server-side super_admin validation

CREATE OR REPLACE FUNCTION public.get_platform_settings_for_super_admin()
RETURNS SETOF public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can retrieve platform settings';
  END IF;

  RETURN QUERY SELECT * FROM public.platform_settings LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_platform_settings_for_super_admin(settings jsonb)
RETURNS public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_result public.platform_settings;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can update platform settings';
  END IF;

  SELECT id INTO v_id FROM public.platform_settings LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.platform_settings (platform_name, default_password_changed, remix_setup_completed)
    VALUES ('Scale', false, false)
    RETURNING id INTO v_id;
  END IF;

  UPDATE public.platform_settings
  SET
    platform_name = CASE WHEN settings ? 'platform_name' THEN (settings->>'platform_name') ELSE platform_name END,
    logo_url = CASE WHEN settings ? 'logo_url' THEN (settings->>'logo_url') ELSE logo_url END,
    logo_dark_url = CASE WHEN settings ? 'logo_dark_url' THEN (settings->>'logo_dark_url') ELSE logo_dark_url END,
    favicon_url = CASE WHEN settings ? 'favicon_url' THEN (settings->>'favicon_url') ELSE favicon_url END,
    primary_color = CASE WHEN settings ? 'primary_color' THEN (settings->>'primary_color') ELSE primary_color END,
    accent_color = CASE WHEN settings ? 'accent_color' THEN (settings->>'accent_color') ELSE accent_color END,
    gradient_style = CASE WHEN settings ? 'gradient_style' THEN (settings->>'gradient_style') ELSE gradient_style END,
    gradient_custom = CASE WHEN settings ? 'gradient_custom' THEN (settings->'gradient_custom') ELSE gradient_custom END,
    border_radius = CASE WHEN settings ? 'border_radius' THEN (settings->>'border_radius')::integer ELSE border_radius END,
    default_theme = CASE WHEN settings ? 'default_theme' THEN (settings->>'default_theme') ELSE default_theme END,
    font_family = CASE WHEN settings ? 'font_family' THEN (settings->>'font_family') ELSE font_family END,
    font_url = CASE WHEN settings ? 'font_url' THEN (settings->>'font_url') ELSE font_url END,
    base_font_size = CASE WHEN settings ? 'base_font_size' THEN (settings->>'base_font_size')::integer ELSE base_font_size END,
    support_email = CASE WHEN settings ? 'support_email' THEN (settings->>'support_email') ELSE support_email END,
    terms_url = CASE WHEN settings ? 'terms_url' THEN (settings->>'terms_url') ELSE terms_url END,
    privacy_url = CASE WHEN settings ? 'privacy_url' THEN (settings->>'privacy_url') ELSE privacy_url END,
    login_headline = CASE WHEN settings ? 'login_headline' THEN (settings->>'login_headline') ELSE login_headline END,
    login_subheadline = CASE WHEN settings ? 'login_subheadline' THEN (settings->>'login_subheadline') ELSE login_subheadline END,
    login_stats_enabled = CASE WHEN settings ? 'login_stats_enabled' THEN (settings->>'login_stats_enabled')::boolean ELSE login_stats_enabled END,
    login_bg_image_url = CASE WHEN settings ? 'login_bg_image_url' THEN (settings->>'login_bg_image_url') ELSE login_bg_image_url END,
    login_bg_layout = CASE WHEN settings ? 'login_bg_layout' THEN (settings->>'login_bg_layout') ELSE login_bg_layout END,
    login_logo_position = CASE WHEN settings ? 'login_logo_position' THEN (settings->>'login_logo_position') ELSE login_logo_position END,
    powered_by_text = CASE WHEN settings ? 'powered_by_text' THEN (settings->>'powered_by_text') ELSE powered_by_text END,
    hide_widget_branding = CASE WHEN settings ? 'hide_widget_branding' THEN (settings->>'hide_widget_branding')::boolean ELSE hide_widget_branding END,
    widget_accent_color = CASE WHEN settings ? 'widget_accent_color' THEN (settings->>'widget_accent_color') ELSE widget_accent_color END,
    browser_title = CASE WHEN settings ? 'browser_title' THEN (settings->>'browser_title') ELSE browser_title END,
    meta_description = CASE WHEN settings ? 'meta_description' THEN (settings->>'meta_description') ELSE meta_description END,
    og_image_url = CASE WHEN settings ? 'og_image_url' THEN (settings->>'og_image_url') ELSE og_image_url END,
    twitter_handle = CASE WHEN settings ? 'twitter_handle' THEN (settings->>'twitter_handle') ELSE twitter_handle END,
    default_language = CASE WHEN settings ? 'default_language' THEN (settings->>'default_language') ELSE default_language END,
    evolution_go_url = CASE WHEN settings ? 'evolution_go_url' THEN (settings->>'evolution_go_url') ELSE evolution_go_url END,
    evolution_go_global_api_key = CASE WHEN settings ? 'evolution_go_global_api_key' THEN (settings->>'evolution_go_global_api_key') ELSE evolution_go_global_api_key END,
    default_password_changed = CASE WHEN settings ? 'default_password_changed' THEN (settings->>'default_password_changed')::boolean ELSE default_password_changed END,
    remix_setup_completed = CASE WHEN settings ? 'remix_setup_completed' THEN (settings->>'remix_setup_completed')::boolean ELSE remix_setup_completed END,
    updated_at = now()
  WHERE id = v_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
