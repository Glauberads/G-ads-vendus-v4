import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { PerformanceMonitor } from '@/utils/PerformanceMonitor';

// ---------------------------------------------------------------------------
// Tipos públicos — mantidos idênticos para não quebrar componentes existentes
// ---------------------------------------------------------------------------

export interface AdminKPIs {
  totalSalesThisMonth: number;
  totalSalesLastMonth: number;
  salesGrowth: number;
  totalDeals: number;
  avgTicket: number;
  conversionRate: number;
  totalGoalValue: number;
  goalProgress: number;
  pendingCommissions: number;
  pendingCommissionsCount: number;
}

export interface TopSeller {
  id: string;
  name: string;
  avatar: string | null;
  totalValue: number;
  dealsCount: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  totalValue: number;
  dealsCount: number;
  percentage: number;
}

export interface MonthlySalesData {
  month: string;
  sales: number;
  deals: number;
}

// ---------------------------------------------------------------------------
// useAdminKPIs
// Antes: 5 queries separadas + cálculos JS (todos os leads, deals, comissões).
// Agora: 1 chamada RPC que retorna apenas os valores agregados do PostgreSQL.
// ---------------------------------------------------------------------------
export function useAdminKPIs() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['admin-kpis', organizationId],
    queryFn: async (): Promise<AdminKPIs> => {
      if (!organizationId) throw new Error('Organização não definida');

      const now = new Date();
      const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const thisMonthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');
      const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const lastMonthEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_admin_kpis');
      const { data, error } = await supabase.rpc('get_admin_kpis', {
        p_organization_id:  organizationId,
        p_month_start:      thisMonthStart,
        p_month_end:        thisMonthEnd,
        p_last_month_start: lastMonthStart,
        p_last_month_end:   lastMonthEnd,
      });
      PerformanceMonitor.endTimer('get_admin_kpis');

      if (error) throw error;

      // RPC retorna RETURNS TABLE → Supabase JS entrega como array de 1 linha
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Nenhum dado retornado pela RPC get_admin_kpis');

      return {
        totalSalesThisMonth:    Number(row.total_sales_this_month)    ?? 0,
        totalSalesLastMonth:    Number(row.total_sales_last_month)    ?? 0,
        salesGrowth:            Number(row.sales_growth)              ?? 0,
        totalDeals:             Number(row.total_deals)               ?? 0,
        avgTicket:              Number(row.avg_ticket)                ?? 0,
        conversionRate:         Number(row.conversion_rate)           ?? 0,
        totalGoalValue:         Number(row.total_goal_value)          ?? 0,
        goalProgress:           Number(row.goal_progress)             ?? 0,
        pendingCommissions:     Number(row.pending_commissions)       ?? 0,
        pendingCommissionsCount:Number(row.pending_commissions_count) ?? 0,
      };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// useTopSellers
// Antes: 2 queries (deals → perfis) + aggregation JS + sort.
// Agora: 1 RPC com JOIN e ORDER BY no banco, retornando apenas `limit` linhas.
// ---------------------------------------------------------------------------
export function useTopSellers(limit = 5) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['top-sellers', organizationId, limit],
    queryFn: async (): Promise<TopSeller[]> => {
      if (!organizationId) return [];

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_top_sellers');
      const { data, error } = await supabase.rpc('get_top_sellers', {
        p_organization_id: organizationId,
        p_month_start:     monthStart,
        p_month_end:       monthEnd,
        p_limit:           limit,
      });
      PerformanceMonitor.endTimer('get_top_sellers');

      if (error) throw error;

      return (data ?? []).map((row: any): TopSeller => ({
        id:         row.id,
        name:       row.full_name ?? 'Usuário',
        avatar:     row.avatar_url ?? null,
        totalValue: Number(row.total_value),
        dealsCount: Number(row.deals_count),
      }));
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// useProductSalesDistribution
// Antes: 2 queries (deals → produtos) + aggregation JS.
// Agora: 1 RPC com JOIN + window function para percentagem.
// ---------------------------------------------------------------------------
export function useProductSalesDistribution() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['product-sales-distribution', organizationId],
    queryFn: async (): Promise<ProductSales[]> => {
      if (!organizationId) return [];

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_product_sales_distribution');
      const { data, error } = await supabase.rpc('get_product_sales_distribution', {
        p_organization_id: organizationId,
        p_month_start:     monthStart,
        p_month_end:       monthEnd,
      });
      PerformanceMonitor.endTimer('get_product_sales_distribution');

      if (error) throw error;

      return (data ?? []).map((row: any): ProductSales => ({
        productId:   row.product_id,
        productName: row.product_name ?? 'Produto',
        totalValue:  Number(row.total_value),
        dealsCount:  Number(row.deals_count),
        percentage:  Number(row.percentage),
      }));
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// useMonthlySalesEvolution
// Antes: fetch de TODOS os deals do período + loop e Map em JS.
// Agora: 1 RPC com GROUP BY date_trunc no PostgreSQL.
// O hook preenche os meses sem vendas com zero (para o gráfico não ter buracos).
// ---------------------------------------------------------------------------
export function useMonthlySalesEvolution(months = 6) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['monthly-sales-evolution', organizationId, months],
    queryFn: async (): Promise<MonthlySalesData[]> => {
      if (!organizationId) return [];

      const now        = new Date();
      const startDate  = format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd');
      const endDate    = format(endOfMonth(now), 'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_monthly_sales_evolution');
      const { data, error } = await supabase.rpc('get_monthly_sales_evolution', {
        p_organization_id: organizationId,
        p_start_date:      startDate,
        p_end_date:        endDate,
      });
      PerformanceMonitor.endTimer('get_monthly_sales_evolution');

      if (error) throw error;

      // Inicializa o mapa com TODOS os meses do intervalo (valor zero)
      // para garantir que o gráfico exiba meses sem vendas.
      const monthlyMap = new Map<string, MonthlySalesData>();
      for (let i = months - 1; i >= 0; i--) {
        const target   = subMonths(now, i);
        const key      = format(target, 'yyyy-MM');
        const label    = format(target, 'MMM');
        monthlyMap.set(key, { month: label, sales: 0, deals: 0 });
      }

      // Preenche com os dados reais retornados pelo banco
      (data ?? []).forEach((row: any) => {
        const key = row.month_key as string; // 'yyyy-MM'
        if (monthlyMap.has(key)) {
          monthlyMap.set(key, {
            month:  monthlyMap.get(key)!.month, // mantém label em pt-BR gerado localmente
            sales:  Number(row.sales),
            deals:  Number(row.deals),
          });
        }
      });

      return Array.from(monthlyMap.values());
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
