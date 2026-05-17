-- =============================================================================
-- Migration: Dashboard de Produto + At-Risk Leads + Squad Performance RPCs
-- Fase 2 e 3 da refatoração de performance.
-- =============================================================================

-- =============================================================================
-- RPC 5: get_dashboard_product_metrics
-- Substitui 4 queries (leads, pipeline_stages, deals, commissions) + toda a
-- lógica JS de stats(), conversionData(), trends() em useDashboardData.ts.
-- Valida que o produto pertence à organização do usuário autenticado.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_dashboard_product_metrics(
  p_product_id uuid,
  p_user_id    uuid DEFAULT NULL  -- NULL = admin/manager (vê todos)
)
RETURNS TABLE (
  active_leads_count   bigint,
  won_deals_count      bigint,
  won_deals_value      numeric,
  lost_deals_count     bigint,
  conversion_rate      numeric,
  total_commissions    numeric,
  pending_commissions  numeric,
  at_risk_leads_count  bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id  uuid;
  v_product_org  uuid;
  v_won_stage_ids uuid[];
  v_lost_stage_ids uuid[];
BEGIN
  -- Validação: produto pertence à organização do usuário
  v_user_org_id := get_user_organization_id();

  SELECT organization_id INTO v_product_org
  FROM products WHERE id = p_product_id;

  IF v_product_org IS DISTINCT FROM v_user_org_id THEN
    RAISE EXCEPTION 'Acesso negado: produto de outra organização';
  END IF;

  -- Cache dos IDs de estágios won/lost para evitar subqueries repetidas
  SELECT ARRAY_AGG(id) INTO v_won_stage_ids
  FROM pipeline_stages
  WHERE product_id = p_product_id AND is_won = true;

  SELECT ARRAY_AGG(id) INTO v_lost_stage_ids
  FROM pipeline_stages
  WHERE product_id = p_product_id AND is_lost = true;

  -- Subqueries escalares independentes: cada métrica calculada separadamente,
  -- sem produto cartesiano. Padrão correto para agregar fontes disjuntas.
  RETURN QUERY
  SELECT
    -- Leads ativos (não won, não lost)
    (SELECT COUNT(*)
     FROM leads l
     WHERE l.product_id = p_product_id
       AND (p_user_id IS NULL OR l.assigned_to = p_user_id)
       AND l.current_stage_id IS NOT NULL
       AND (v_won_stage_ids  IS NULL OR l.current_stage_id != ALL(v_won_stage_ids))
       AND (v_lost_stage_ids IS NULL OR l.current_stage_id != ALL(v_lost_stage_ids))
    )::bigint AS active_leads_count,

    -- Deals ganhos (count)
    (SELECT COUNT(*)
     FROM deals d
     WHERE d.product_id = p_product_id
       AND (p_user_id IS NULL OR d.seller_id = p_user_id)
       AND d.status = 'won'
    )::bigint AS won_deals_count,

    -- Deals ganhos (value)
    COALESCE(
      (SELECT SUM(d.deal_value)
       FROM deals d
       WHERE d.product_id = p_product_id
         AND (p_user_id IS NULL OR d.seller_id = p_user_id)
         AND d.status = 'won'), 0) AS won_deals_value,

    -- Deals perdidos
    (SELECT COUNT(*)
     FROM deals d
     WHERE d.product_id = p_product_id
       AND (p_user_id IS NULL OR d.seller_id = p_user_id)
       AND d.status = 'lost'
    )::bigint AS lost_deals_count,

    -- Taxa de conversão: won / (won + lost)
    CASE
      WHEN (SELECT COUNT(*) FROM deals d
            WHERE d.product_id = p_product_id
              AND (p_user_id IS NULL OR d.seller_id = p_user_id)
              AND d.status IN ('won','lost')) > 0
      THEN ROUND(
        (SELECT COUNT(*) FROM deals d
         WHERE d.product_id = p_product_id
           AND (p_user_id IS NULL OR d.seller_id = p_user_id)
           AND d.status = 'won')::numeric
        / NULLIF(
          (SELECT COUNT(*) FROM deals d
           WHERE d.product_id = p_product_id
             AND (p_user_id IS NULL OR d.seller_id = p_user_id)
             AND d.status IN ('won','lost')), 0) * 100, 0)
      ELSE 0
    END AS conversion_rate,

    -- Total de comissões
    COALESCE(
      (SELECT SUM(c.amount)
       FROM commissions c
       WHERE c.product_id = p_product_id
         AND (p_user_id IS NULL OR c.user_id = p_user_id)), 0) AS total_commissions,

    -- Comissões pendentes
    COALESCE(
      (SELECT SUM(c.amount)
       FROM commissions c
       WHERE c.product_id = p_product_id
         AND (p_user_id IS NULL OR c.user_id = p_user_id)
         AND c.status = 'pending'), 0) AS pending_commissions,

    -- At-risk leads: sem contato há 3+ dias
    (SELECT COUNT(*)
     FROM leads l
     WHERE l.product_id = p_product_id
       AND (p_user_id IS NULL OR l.assigned_to = p_user_id)
       AND l.current_stage_id IS NOT NULL
       AND (v_won_stage_ids  IS NULL OR l.current_stage_id != ALL(v_won_stage_ids))
       AND (v_lost_stage_ids IS NULL OR l.current_stage_id != ALL(v_lost_stage_ids))
       AND (l.last_contact_at IS NULL OR l.last_contact_at < NOW() - INTERVAL '3 days')
    )::bigint AS at_risk_leads_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_product_metrics(uuid, uuid) TO authenticated;


-- =============================================================================
-- RPC 6: get_at_risk_leads
-- Retorna lista detalhada de leads em risco (sem contato ≥ 3 dias).
-- Usada no card "Leads em Risco" de ProductDashboard e MobileProductDashboard.
-- Separada de get_dashboard_product_metrics para ser chamada sob demanda.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_at_risk_leads(
  p_product_id uuid,
  p_user_id    uuid DEFAULT NULL,
  p_limit      int  DEFAULT 5
)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  company              text,
  days_without_contact integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_product_org uuid;
  v_won_stage_ids  uuid[];
  v_lost_stage_ids uuid[];
BEGIN
  v_user_org_id := get_user_organization_id();

  SELECT organization_id INTO v_product_org
  FROM products WHERE id = p_product_id;

  IF v_product_org IS DISTINCT FROM v_user_org_id THEN
    RAISE EXCEPTION 'Acesso negado: produto de outra organização';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_won_stage_ids
  FROM pipeline_stages WHERE product_id = p_product_id AND is_won = true;

  SELECT ARRAY_AGG(id) INTO v_lost_stage_ids
  FROM pipeline_stages WHERE product_id = p_product_id AND is_lost = true;

  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.company,
    CASE
      WHEN l.last_contact_at IS NULL THEN 999
      ELSE EXTRACT(DAY FROM NOW() - l.last_contact_at)::integer
    END AS days_without_contact
  FROM leads l
  WHERE l.product_id = p_product_id
    AND (p_user_id IS NULL OR l.assigned_to = p_user_id)
    AND l.current_stage_id IS NOT NULL
    AND (v_won_stage_ids  IS NULL OR l.current_stage_id != ALL(v_won_stage_ids))
    AND (v_lost_stage_ids IS NULL OR l.current_stage_id != ALL(v_lost_stage_ids))
    AND (
      l.last_contact_at IS NULL
      OR l.last_contact_at < (NOW() - INTERVAL '3 days')
    )
  ORDER BY
    CASE WHEN l.last_contact_at IS NULL THEN 0 ELSE 1 END,
    l.last_contact_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_at_risk_leads(uuid, uuid, int) TO authenticated;


-- =============================================================================
-- RPC 7: get_monthly_commissions
-- Retorna comissões agrupadas por mês para o gráfico CommissionsChart.
-- Substitui a query que baixava todas as comissões do produto sem limite.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_monthly_commissions(
  p_product_id uuid,
  p_user_id    uuid DEFAULT NULL,
  p_months     int  DEFAULT 6
)
RETURNS TABLE (
  month_key   text,
  month_label text,
  amount      numeric,
  status      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_product_org uuid;
  v_start_date  date;
BEGIN
  v_user_org_id := get_user_organization_id();

  SELECT organization_id INTO v_product_org
  FROM products WHERE id = p_product_id;

  IF v_product_org IS DISTINCT FROM v_user_org_id THEN
    RAISE EXCEPTION 'Acesso negado: produto de outra organização';
  END IF;

  v_start_date := date_trunc('month', NOW() - (p_months - 1 || ' months')::interval)::date;

  RETURN QUERY
  SELECT
    to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS month_key,
    to_char(date_trunc('month', c.created_at), 'Mon')     AS month_label,
    COALESCE(SUM(c.amount), 0)                            AS amount,
    c.status
  FROM commissions c
  WHERE c.product_id = p_product_id
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
    AND c.created_at >= v_start_date
  GROUP BY date_trunc('month', c.created_at), c.status
  ORDER BY date_trunc('month', c.created_at), c.status;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_commissions(uuid, uuid, int) TO authenticated;


-- =============================================================================
-- RPC 8: get_squad_performance
-- Substitui 5 queries + aggregation JS em useSquadPerformance().
-- Retorna KPIs do squad + array JSON de memberPerformances.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_squad_performance(
  p_squad_id    uuid,
  p_month_start date,
  p_month_end   date
)
RETURNS TABLE (
  members_count       bigint,
  total_deals         bigint,
  total_value         numeric,
  target_value        numeric,
  progress_percent    numeric,
  conversion_rate     numeric,
  top_seller_id       uuid,
  top_seller_name     text,
  top_seller_value    numeric,
  member_performances jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id  uuid;
  v_squad_org_id uuid;
BEGIN
  v_user_org_id := get_user_organization_id();

  SELECT organization_id INTO v_squad_org_id
  FROM sales_squads WHERE id = p_squad_id;

  IF v_squad_org_id IS DISTINCT FROM v_user_org_id THEN
    RAISE EXCEPTION 'Acesso negado: squad de outra organização';
  END IF;

  RETURN QUERY
  WITH
  squad_members_cte AS (
    SELECT sm.user_id, sm.role
    FROM squad_members sm
    WHERE sm.squad_id = p_squad_id
  ),
  member_ids AS (
    SELECT ARRAY_AGG(user_id) AS ids FROM squad_members_cte
  ),
  member_deals AS (
    SELECT
      d.seller_id,
      COUNT(d.id)             AS deals_count,
      COALESCE(SUM(d.deal_value), 0) AS total_val
    FROM deals d, member_ids mi
    WHERE d.seller_id = ANY(mi.ids)
      AND d.status = 'won'
      AND d.closed_at::date BETWEEN p_month_start AND p_month_end
    GROUP BY d.seller_id
  ),
  member_goals AS (
    SELECT
      sg.user_id,
      COALESCE(SUM(sg.target_value), 0) AS target_val
    FROM sales_goals sg, member_ids mi
    WHERE sg.user_id = ANY(mi.ids)
      AND sg.period_end   >= p_month_start
      AND sg.period_start <= p_month_end
      AND sg.is_active    = true
    GROUP BY sg.user_id
  ),
  member_profiles AS (
    SELECT p.id, p.full_name, p.avatar_url
    FROM profiles p, member_ids mi
    WHERE p.id = ANY(mi.ids)
  ),
  -- Leads para taxa de conversão do squad
  squad_leads AS (
    SELECT l.id, l.current_stage_id, l.assigned_to
    FROM leads l, member_ids mi
    WHERE l.assigned_to = ANY(mi.ids)
  ),
  won_stages AS (
    SELECT ARRAY_AGG(ps.id) AS ids
    FROM pipeline_stages ps
    WHERE ps.is_won = true
  ),
  -- Performance por membro (agregada em JSON para evitar múltiplas linhas)
  per_member AS (
    SELECT
      sm.user_id,
      mp.full_name,
      mp.avatar_url,
      sm.role,
      COALESCE(md.deals_count, 0)  AS deals_count,
      COALESCE(md.total_val,   0)  AS member_total,
      COALESCE(mg.target_val,  0)  AS member_target
    FROM squad_members_cte sm
    LEFT JOIN member_profiles mp ON mp.id = sm.user_id
    LEFT JOIN member_deals    md ON md.seller_id = sm.user_id
    LEFT JOIN member_goals    mg ON mg.user_id   = sm.user_id
  )
  SELECT
    (SELECT COUNT(*) FROM squad_members_cte)::bigint              AS members_count,
    COALESCE(SUM(pm.deals_count), 0)::bigint                      AS total_deals,
    COALESCE(SUM(pm.member_total), 0)                             AS total_value,
    COALESCE(SUM(pm.member_target), 0)                            AS target_value,
    CASE WHEN COALESCE(SUM(pm.member_target), 0) > 0
         THEN LEAST(ROUND(
               (COALESCE(SUM(pm.member_total),0) / SUM(pm.member_target)) * 100, 2
              ), 100)
         ELSE 0
    END                                                            AS progress_percent,
    -- Conversão: leads em estágio won / total leads do squad
    CASE WHEN (SELECT COUNT(*) FROM squad_leads) > 0
         THEN ROUND(
           (SELECT COUNT(*) FROM squad_leads sl, won_stages ws
            WHERE sl.current_stage_id = ANY(ws.ids))::numeric
           / (SELECT COUNT(*) FROM squad_leads) * 100, 2)
         ELSE 0
    END                                                            AS conversion_rate,
    -- Top seller
    (SELECT pm2.user_id  FROM per_member pm2 ORDER BY pm2.member_total DESC LIMIT 1) AS top_seller_id,
    (SELECT pm2.full_name FROM per_member pm2 ORDER BY pm2.member_total DESC LIMIT 1) AS top_seller_name,
    (SELECT pm2.member_total FROM per_member pm2 ORDER BY pm2.member_total DESC LIMIT 1) AS top_seller_value,
    -- Array de performances por membro como JSONB
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'userId',         pm.user_id,
        'userName',       COALESCE(pm.full_name, 'Usuário'),
        'userAvatar',     pm.avatar_url,
        'role',           pm.role,
        'dealsCount',     pm.deals_count,
        'totalValue',     pm.member_total,
        'targetValue',    pm.member_target,
        'progressPercent', CASE WHEN pm.member_target > 0
                                THEN LEAST(ROUND((pm.member_total / pm.member_target) * 100, 2), 100)
                                ELSE 0 END
      )
    )                                                             AS member_performances
  FROM per_member pm;
END;
$$;

GRANT EXECUTE ON FUNCTION get_squad_performance(uuid, date, date) TO authenticated;


-- =============================================================================
-- RPC 9: get_all_squads_performance
-- Substitui fetch de squads + members + deals + goals + cruzamento JS em
-- useAllSquadsPerformance().
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
