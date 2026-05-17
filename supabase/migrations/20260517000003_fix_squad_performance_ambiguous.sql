-- =============================================================================
-- Correção RPC 9: get_all_squads_performance
-- Resolve erro "ambiguous column squad_id"
-- =============================================================================
CREATE OR REPLACE FUNCTION get_all_squads_performance(
  p_organization_id uuid,
  p_month_start     date,
  p_month_end       date
)
RETURNS TABLE (
  squad_id         uuid,
  squad_name       text,
  squad_color      text,
  squad_icon       text,
  members_count    bigint,
  total_deals      bigint,
  total_value      numeric,
  target_value     numeric,
  progress_percent numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
BEGIN
  v_user_org_id := get_user_organization_id();
  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Acesso negado: organização inválida';
  END IF;

  RETURN QUERY
  WITH active_squads AS (
    SELECT ss.id, ss.name, ss.color, ss.icon_url
    FROM sales_squads ss
    WHERE ss.organization_id = p_organization_id
      AND ss.is_active = true
  ),
  squad_member_list AS (
    SELECT sm.squad_id, sm.user_id
    FROM squad_members sm
    WHERE sm.squad_id IN (SELECT id FROM active_squads)
  ),
  squad_deals AS (
    SELECT sml.squad_id,
           COUNT(d.id)                    AS deals_count,
           COALESCE(SUM(d.deal_value), 0) AS total_val
    FROM deals d
    JOIN squad_member_list sml ON sml.user_id = d.seller_id
    WHERE d.status = 'won'
      AND d.closed_at::date BETWEEN p_month_start AND p_month_end
    GROUP BY sml.squad_id
  ),
  squad_goals AS (
    SELECT sml.squad_id,
           COALESCE(SUM(sg.target_value), 0) AS target_val
    FROM sales_goals sg
    JOIN squad_member_list sml ON sml.user_id = sg.user_id
    WHERE sg.period_end   >= p_month_start
      AND sg.period_start <= p_month_end
      AND sg.is_active    = true
    GROUP BY sml.squad_id
  ),
  squad_member_counts AS (
    SELECT sml.squad_id, COUNT(*) AS cnt
    FROM squad_member_list sml
    GROUP BY sml.squad_id
  )
  SELECT
    s.id                                    AS squad_id,
    s.name                                  AS squad_name,
    s.color                                 AS squad_color,
    s.icon_url                              AS squad_icon,
    COALESCE(smc.cnt, 0)::bigint            AS members_count,
    COALESCE(sd.deals_count, 0)::bigint     AS total_deals,
    COALESCE(sd.total_val,   0)             AS total_value,
    COALESCE(sg.target_val,  0)             AS target_value,
    CASE WHEN COALESCE(sg.target_val, 0) > 0
         THEN LEAST(ROUND(
               (COALESCE(sd.total_val,0) / sg.target_val) * 100, 2
              ), 100)
         ELSE 0
    END                                     AS progress_percent
  FROM active_squads s
  LEFT JOIN squad_deals         sd  ON sd.squad_id  = s.id
  LEFT JOIN squad_goals         sg  ON sg.squad_id  = s.id
  LEFT JOIN squad_member_counts smc ON smc.squad_id = s.id
  ORDER BY COALESCE(sd.total_val, 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_squads_performance(uuid, date, date) TO authenticated;
