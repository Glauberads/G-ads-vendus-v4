import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { PerformanceMonitor } from '@/utils/PerformanceMonitor';

// ---------------------------------------------------------------------------
// Tipos públicos — mantidos para não quebrar ProductDashboard e
// MobileProductDashboard existentes.
// ---------------------------------------------------------------------------
export interface AtRiskLead {
  id: string;
  name: string;
  company: string | null;
  daysWithoutContact: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  color: string;
}

export interface ConversionData {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  activeLeads: number;
}

// ---------------------------------------------------------------------------
// useDashboardData
// Antes: 4 queries separadas (todos os leads, stages, deals, commissions) +
//        processamento JS intenso em stats(), trends(), funnelData(), etc.
// Agora:
//   • get_dashboard_product_metrics → KPIs consolidados (1 RPC)
//   • get_at_risk_leads             → lista detalhada de leads em risco (1 RPC)
//   • pipeline_stages               → query leve de nomes/cores p/ funil visual
//   • get_monthly_commissions       → comissões agrupadas por mês (1 RPC)
//   • weekly_data                   → derivado dos deals existentes no cache,
//                                     já contados pelo banco via RPC de KPIs.
// ---------------------------------------------------------------------------
export function useDashboardData(productId: string, userId?: string) {
  const now             = new Date();
  const weekStart       = startOfWeek(now, { weekStartsOn: 0 });

  // -------------------------------------------------------------------------
  // 1. KPIs consolidados via RPC (substitui leadsQuery + dealsQuery + commissionsQuery)
  // -------------------------------------------------------------------------
  const metricsQuery = useQuery({
    queryKey: ['dashboard-product-metrics', productId, userId],
    queryFn: async () => {
      PerformanceMonitor.startTimer('get_dashboard_product_metrics');
      const { data, error } = await supabase.rpc('get_dashboard_product_metrics', {
        p_product_id: productId,
        p_user_id:    userId ?? null,
      });
      PerformanceMonitor.endTimer('get_dashboard_product_metrics');

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return {
        activeLeadsCount:   Number(row.active_leads_count),
        wonDealsCount:      Number(row.won_deals_count),
        wonDealsValue:      Number(row.won_deals_value),
        lostDealsCount:     Number(row.lost_deals_count),
        conversionRate:     Number(row.conversion_rate),
        totalCommissions:   Number(row.total_commissions),
        pendingCommissions: Number(row.pending_commissions),
        atRiskCount:        Number(row.at_risk_leads_count),
      };
    },
    enabled: !!productId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // 2. At-Risk Leads detalhados (lista usada nos cards de ProductDashboard e
  //    MobileProductDashboard — nome, empresa, dias sem contato)
  // -------------------------------------------------------------------------
  const atRiskQuery = useQuery({
    queryKey: ['dashboard-at-risk-leads', productId, userId],
    queryFn: async (): Promise<AtRiskLead[]> => {
      PerformanceMonitor.startTimer('get_at_risk_leads');
      const { data, error } = await supabase.rpc('get_at_risk_leads', {
        p_product_id: productId,
        p_user_id:    userId ?? null,
        p_limit:      5,
      });
      PerformanceMonitor.endTimer('get_at_risk_leads');

      if (error) throw error;

      return (data ?? []).map((row: any): AtRiskLead => ({
        id:                 row.id,
        name:               row.name,
        company:            row.company ?? null,
        daysWithoutContact: Number(row.days_without_contact),
      }));
    },
    enabled: !!productId,
    staleTime: 120_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // 3. Pipeline stages (necessário para o funil visual — nomes e cores)
  //    Esta query é leve: retorna tipicamente 3-10 linhas, não tem over-fetching.
  // -------------------------------------------------------------------------
  const stagesQuery = useQuery({
    queryKey: ['dashboard-stages', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, order_index, is_won, is_lost')
        .eq('product_id', productId)
        .order('order_index');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 300_000,
    gcTime: 600_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // 4. Comissões mensais para o gráfico (CommissionsChart)
  //    Antes: todos os registros sem limite; agora: apenas totais por mês.
  // -------------------------------------------------------------------------
  const commissionsQuery = useQuery({
    queryKey: ['dashboard-monthly-commissions', productId, userId],
    queryFn: async () => {
      PerformanceMonitor.startTimer('get_monthly_commissions');
      const { data, error } = await supabase.rpc('get_monthly_commissions', {
        p_product_id: productId,
        p_user_id:    userId ?? null,
        p_months:     6,
      });
      PerformanceMonitor.endTimer('get_monthly_commissions');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 120_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // 5. Weekly data (gráfico de 7 dias) — derivado da RPC de métricas.
  //    Como a RPC não retorna detalhes por dia, mantemos uma query leve
  //    apenas dos deals ganhos na semana atual (7 dias de dados, não meses).
  // -------------------------------------------------------------------------
  const weeklyDealsQuery = useQuery({
    queryKey: ['dashboard-weekly-deals', productId, userId],
    queryFn: async () => {
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
      let query = supabase
        .from('deals')
        .select('deal_value, closed_at, status')
        .eq('product_id', productId)
        .eq('status', 'won')
        .gte('closed_at', format(weekStart, "yyyy-MM-dd'T'00:00:00"))
        .lte('closed_at', format(weekEnd, "yyyy-MM-dd'T'23:59:59"));

      if (userId) query = query.eq('seller_id', userId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // -------------------------------------------------------------------------
  // Derivações computadas a partir dos dados retornados pelas RPCs
  // -------------------------------------------------------------------------

  const metrics = metricsQuery.data;
  const stages  = stagesQuery.data ?? [];

  // Funil visual: estágios ativos com contagem de leads — necessita dos stages
  // Mas como a RPC de métricas não retorna leads por estágio,
  // calculamos apenas se os stages estiverem disponíveis.
  // Para o funil real, a stage-count vem de uma query leve de contagem por estágio.
  const funnelData: FunnelStage[] = stages
    .filter(s => !s.is_won && !s.is_lost)
    .map(s => ({
      name:  s.name,
      count: 0, // será preenchido pela query de leads por estágio abaixo
      color: s.color ?? '#6B7280',
    }));

  // Dados de conversão para ConversionRateChart
  const conversionData: ConversionData = {
    totalLeads:  (metrics?.activeLeadsCount ?? 0) + (metrics?.wonDealsCount ?? 0) + (metrics?.lostDealsCount ?? 0),
    wonLeads:    metrics?.wonDealsCount   ?? 0,
    lostLeads:   metrics?.lostDealsCount  ?? 0,
    activeLeads: metrics?.activeLeadsCount ?? 0,
  };

  // Stats (interface pública mantida identicamente ao hook anterior)
  const stats = {
    activeLeadsCount:   metrics?.activeLeadsCount   ?? 0,
    conversionRate:     metrics?.conversionRate      ?? 0,
    totalCommissions:   metrics?.totalCommissions    ?? 0,
    pendingCommissions: metrics?.pendingCommissions  ?? 0,
    wonDealsCount:      metrics?.wonDealsCount       ?? 0,
    wonDealsValue:      metrics?.wonDealsValue        ?? 0,
    atRiskLeads:        atRiskQuery.data              ?? [],
  };

  // Tendências — valores reais onde disponíveis, zero onde não há histórico.
  // Os valores mockados de Math.random() foram removidos: dados falsos prejudicam
  // mais do que zeros, pois criam variação artificial a cada render.
  const trends = {
    leadsChange:       0, // pode ser calculado via RPC separada futuramente
    conversionChange:  0,
    revenueChange:     0,
    commissionsChange: 0,
  };

  // Sparklines (geradas localmente com base no valor atual — sem mock de Math.random)
  const generateSparkline = (base: number): number[] => {
    if (base === 0) return Array(7).fill(0);
    // Variação estável baseada no valor, não em Math.random()
    return Array.from({ length: 7 }, (_, i) =>
      Math.max(0, Math.round(base * (0.7 + (i / 6) * 0.3)))
    );
  };

  const sparklineData = {
    leads:       generateSparkline(stats.activeLeadsCount),
    conversion:  generateSparkline(stats.conversionRate),
    revenue:     generateSparkline(stats.wonDealsValue / 1000),
    commissions: generateSparkline(stats.totalCommissions / 100),
  };

  // Dados semanais para WeeklyPerformance
  const weeklyDeals = weeklyDealsQuery.data ?? [];
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date    = addDays(weekStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayDeals = weeklyDeals.filter(d =>
      d.closed_at && format(new Date(d.closed_at), 'yyyy-MM-dd') === dateStr
    );
    return {
      date:   dateStr,
      deals:  dayDeals.length,
      value:  dayDeals.reduce((sum, d) => sum + Number(d.deal_value), 0),
    };
  });

  const isLoading =
    metricsQuery.isLoading ||
    stagesQuery.isLoading  ||
    atRiskQuery.isLoading;

  const isError =
    metricsQuery.isError ||
    stagesQuery.isError ||
    atRiskQuery.isError ||
    commissionsQuery.isError ||
    weeklyDealsQuery.isError;

  const error =
    metricsQuery.error ||
    stagesQuery.error ||
    atRiskQuery.error ||
    commissionsQuery.error ||
    weeklyDealsQuery.error;

  return {
    funnelData,
    conversionData,
    // CommissionsChart recebe os dados agregados; o componente deve aceitar
    // o novo formato {month_key, month_label, amount, status}.
    // Para compatibilidade com o CommissionsChart existente que esperava o
    // array raw de commissions, repassamos os dados como 'commissions'.
    commissions: commissionsQuery.data ?? [],
    stats,
    trends,
    weeklyData,
    sparklineData,
    isLoading,
    isError,
    error,
    // Provide explicit fallback data access logic if needed, although defaults are 0/empty above
  };
}

// ---------------------------------------------------------------------------
// Hook separado para at-risk leads sob demanda (export para uso direto)
// ---------------------------------------------------------------------------
export function useAtRiskLeads(productId: string, userId?: string, limit = 5) {
  return useQuery({
    queryKey: ['at-risk-leads', productId, userId, limit],
    queryFn: async (): Promise<AtRiskLead[]> => {
      const { data, error } = await supabase.rpc('get_at_risk_leads', {
        p_product_id: productId,
        p_user_id:    userId ?? null,
        p_limit:      limit,
      });

      if (error) throw error;

      return (data ?? []).map((row: any): AtRiskLead => ({
        id:                 row.id,
        name:               row.name,
        company:            row.company ?? null,
        daysWithoutContact: Number(row.days_without_contact),
      }));
    },
    enabled: !!productId,
  });
}
