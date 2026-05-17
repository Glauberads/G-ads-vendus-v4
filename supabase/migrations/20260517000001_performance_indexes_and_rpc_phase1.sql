-- =============================================================================
-- Migration: Performance Indexes + Admin Dashboard RPCs (Phase 1)
-- Objetivo: Eliminar over-fetching nos hooks de dashboard admin.
-- Estratégia: Índices compostos + funções SECURITY DEFINER que validam
--             auth.uid() antes de retornar dados da organização.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ÍNDICES DE PERFORMANCE
-- Criados com IF NOT EXISTS para ser seguro em re-execuções.
-- ---------------------------------------------------------------------------

-- leads: filtragem por organização (query mais comum)
CREATE INDEX IF NOT EXISTS idx_leads_organization_id
  ON leads (organization_id);

-- leads: conversão — organização + estágio atual
CREATE INDEX IF NOT EXISTS idx_leads_org_stage
  ON leads (organization_id, current_stage_id);

-- leads: dashboard de produto por vendedor
CREATE INDEX IF NOT EXISTS idx_leads_product_assigned
  ON leads (product_id, assigned_to);

-- leads: at-risk leads — produto + último contato
CREATE INDEX IF NOT EXISTS idx_leads_product_last_contact
  ON leads (product_id, last_contact_at)
  WHERE last_contact_at IS NOT NULL;

-- deals: queries por período e status (mais crítico — vários dashboards)
CREATE INDEX IF NOT EXISTS idx_deals_org_status_closed
  ON deals (organization_id, status, closed_at);

-- deals: dashboard de produto
CREATE INDEX IF NOT EXISTS idx_deals_product_status_closed
  ON deals (product_id, status, closed_at);

-- deals: vendedor — para ranking de top sellers
CREATE INDEX IF NOT EXISTS idx_deals_seller_status_closed
  ON deals (seller_id, status, closed_at);

-- commissions: gráfico de comissões por produto
CREATE INDEX IF NOT EXISTS idx_commissions_product_created
  ON commissions (product_id, created_at);

-- commissions: status pendente por organização
CREATE INDEX IF NOT EXISTS idx_commissions_org_status
  ON commissions (organization_id, status);

-- lead_tag_assignments: filtro de etiquetas (evita URI too long no .in())
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_tag_lead
  ON lead_tag_assignments (tag_id, lead_id);

-- squad_members: busca de membros por squad
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id
  ON squad_members (squad_id);


-- =============================================================================
-- HELPER: get_user_organization_id()
-- Retorna o organization_id do usuário autenticado atual.
-- Usado internamente pelas RPCs para validar acesso.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;


-- =============================================================================
-- RPC 1: get_admin_kpis
-- Substitui 5 queries + cálculos JS em useAdminKPIs().
-- Valida que p_organization_id pertence ao usuário autenticado.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_admin_kpis(
  p_organization_id uuid,
  p_month_start      date,
  p_month_end        date,
  p_last_month_start date,
  p_last_month_end   date
)
RETURNS TABLE (
  total_sales_this_month    numeric,
  total_sales_last_month    numeric,
  sales_growth              numeric,
  total_deals               bigint,
  avg_ticket                numeric,
  conversion_rate           numeric,
  total_goal_value          numeric,
  goal_progress             numeric,
  pending_commissions       numeric,
  pending_commissions_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
  v_this_sales   numeric := 0;
  v_last_sales   numeric := 0;
  v_deals_count  bigint  := 0;
  v_total_leads  bigint  := 0;
  v_won_leads    bigint  := 0;
  v_goal_total   numeric := 0;
  v_pending_amt  numeric := 0;
  v_pending_cnt  bigint  := 0;
BEGIN
  -- Segurança: valida que o usuário autenticado pertence à organização solicitada
  v_user_org_id := get_user_organization_id();
  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Acesso negado: organização inválida';
  END IF;

  -- Vendas do mês atual (deals ganhos)
  SELECT
    COALESCE(SUM(d.deal_value), 0),
    COUNT(*)
  INTO v_this_sales, v_deals_count
  FROM deals d
  WHERE d.organization_id = p_organization_id
    AND d.status = 'won'
    AND d.closed_at::date BETWEEN p_month_start AND p_month_end;

  -- Vendas do mês anterior
  SELECT COALESCE(SUM(d.deal_value), 0)
  INTO v_last_sales
  FROM deals d
  WHERE d.organization_id = p_organization_id
    AND d.status = 'won'
    AND d.closed_at::date BETWEEN p_last_month_start AND p_last_month_end;

  -- Taxa de conversão: leads totais vs leads em estágio "won"
  SELECT COUNT(*) INTO v_total_leads
  FROM leads l
  WHERE l.organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_won_leads
  FROM leads l
  JOIN pipeline_stages ps ON ps.id = l.current_stage_id
  WHERE l.organization_id = p_organization_id
    AND ps.is_won = true;

  -- Metas ativas no período
  SELECT COALESCE(SUM(sg.target_value), 0)
  INTO v_goal_total
  FROM sales_goals sg
  WHERE sg.period_end   >= p_month_start
    AND sg.period_start <= p_month_end
    AND sg.is_active    = true;

  -- Comissões pendentes
  SELECT
    COALESCE(SUM(c.amount), 0),
    COUNT(*)
  INTO v_pending_amt, v_pending_cnt
  FROM commissions c
  WHERE c.organization_id = p_organization_id
    AND c.status = 'pending';

  RETURN QUERY SELECT
    v_this_sales                                                                AS total_sales_this_month,
    v_last_sales                                                                AS total_sales_last_month,
    CASE WHEN v_last_sales > 0
         THEN ROUND(((v_this_sales - v_last_sales) / v_last_sales) * 100, 2)
         ELSE 0
    END                                                                         AS sales_growth,
    v_deals_count                                                               AS total_deals,
    CASE WHEN v_deals_count > 0
         THEN ROUND(v_this_sales / v_deals_count, 2)
         ELSE 0
    END                                                                         AS avg_ticket,
    CASE WHEN v_total_leads > 0
         THEN ROUND((v_won_leads::numeric / v_total_leads) * 100, 2)
         ELSE 0
    END                                                                         AS conversion_rate,
    v_goal_total                                                                AS total_goal_value,
    CASE WHEN v_goal_total > 0
         THEN ROUND((v_this_sales / v_goal_total) * 100, 2)
         ELSE 0
    END                                                                         AS goal_progress,
    v_pending_amt                                                               AS pending_commissions,
    v_pending_cnt                                                               AS pending_commissions_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_kpis(uuid, date, date, date, date) TO authenticated;


-- =============================================================================
-- RPC 2: get_monthly_sales_evolution
-- Substitui fetch massivo de deals + loop JS em useMonthlySalesEvolution().
-- Usa date_trunc e GROUP BY no PostgreSQL para devolver apenas os totais mensais.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_monthly_sales_evolution(
  p_organization_id uuid,
  p_start_date      date,
  p_end_date        date
)
RETURNS TABLE (
  month_key   text,     -- 'yyyy-MM' para ordenação
  month_label text,     -- 'Jan', 'Fev', ... para exibição
  sales       numeric,
  deals       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_org_id uuid;
BEGIN
  -- Segurança: valida organização do usuário autenticado
  v_user_org_id := get_user_organization_id();
  IF v_user_org_id IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Acesso negado: organização inválida';
  END IF;

  RETURN QUERY
  SELECT
    to_char(date_trunc('month', d.closed_at), 'YYYY-MM')                    AS month_key,
    -- Abreviação de mês em português via to_char com template simples
    -- O frontend pode formatar; retornamos 'MM' e o hook usa date-fns.
    to_char(date_trunc('month', d.closed_at), 'Mon')                        AS month_label,
    COALESCE(SUM(d.deal_value), 0)                                          AS sales,
    COUNT(*)                                                                 AS deals
  FROM deals d
  WHERE d.organization_id = p_organization_id
    AND d.status           = 'won'
    AND d.closed_at::date BETWEEN p_start_date AND p_end_date
  GROUP BY date_trunc('month', d.closed_at)
  ORDER BY date_trunc('month', d.closed_at);
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_sales_evolution(uuid, date, date) TO authenticated;


-- =============================================================================
-- RPC 3: get_top_sellers
-- Substitui 2 queries sequenciais + aggregation JS em useTopSellers().
-- JOIN com profiles feito no banco; só devolve `limit` linhas.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_top_sellers(
  p_organization_id uuid,
  p_month_start     date,
  p_month_end       date,
  p_limit           int DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  full_name   text,
  avatar_url  text,
  total_value numeric,
  deals_count bigint
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
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    COALESCE(SUM(d.deal_value), 0) AS total_value,
    COUNT(d.id)                    AS deals_count
  FROM deals d
  JOIN profiles p ON p.id = d.seller_id
  WHERE d.organization_id = p_organization_id
    AND d.status           = 'won'
    AND d.closed_at::date BETWEEN p_month_start AND p_month_end
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY total_value DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_sellers(uuid, date, date, int) TO authenticated;


-- =============================================================================
-- RPC 4: get_product_sales_distribution
-- Substitui 2 queries sequenciais + aggregation JS em useProductSalesDistribution().
-- Window function calcula a percentagem de cada produto no total.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_product_sales_distribution(
  p_organization_id uuid,
  p_month_start     date,
  p_month_end       date
)
RETURNS TABLE (
  product_id   uuid,
  product_name text,
  total_value  numeric,
  deals_count  bigint,
  percentage   numeric
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
  WITH product_sales AS (
    SELECT
      d.product_id,
      pr.name                        AS product_name,
      COALESCE(SUM(d.deal_value), 0) AS total_value,
      COUNT(d.id)                    AS deals_count
    FROM deals d
    JOIN products pr ON pr.id = d.product_id
    WHERE d.organization_id = p_organization_id
      AND d.status           = 'won'
      AND d.closed_at::date BETWEEN p_month_start AND p_month_end
    GROUP BY d.product_id, pr.name
  ),
  total AS (
    SELECT COALESCE(SUM(ps.total_value), 0) AS grand_total
    FROM product_sales ps
  )
  SELECT
    ps.product_id,
    ps.product_name,
    ps.total_value,
    ps.deals_count,
    CASE WHEN t.grand_total > 0
         THEN ROUND((ps.total_value / t.grand_total) * 100, 2)
         ELSE 0
    END AS percentage
  FROM product_sales ps, total t
  ORDER BY ps.total_value DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_product_sales_distribution(uuid, date, date) TO authenticated;
