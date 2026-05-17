import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { PerformanceMonitor } from '@/utils/PerformanceMonitor';

// ---------------------------------------------------------------------------
// Tipos públicos — mantidos idênticos para não quebrar componentes existentes
// ---------------------------------------------------------------------------

export interface SquadPerformance {
  squadId: string;
  squadName: string;
  squadColor: string | null;
  squadIcon: string | null;
  membersCount: number;
  totalDeals: number;
  totalValue: number;
  targetValue: number;
  progressPercent: number;
  conversionRate: number;
  topSeller?: {
    id: string;
    name: string;
    value: number;
  };
}

export interface MemberPerformance {
  userId: string;
  userName: string;
  userAvatar: string | null;
  role: string;
  dealsCount: number;
  totalValue: number;
  targetValue: number;
  progressPercent: number;
}

// ---------------------------------------------------------------------------
// useSquadPerformance
// Antes: 5 queries sequenciais (members, deals, leads, goals, profiles, wonStages)
//        + aggregation e cross-referencing em JS.
// Agora: 1 chamada RPC que faz todos os JOINs e agregações no PostgreSQL.
//        memberPerformances vem como JSONB e é desserializado aqui.
// ---------------------------------------------------------------------------
export function useSquadPerformance(squadId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['squad-performance', squadId],
    queryFn: async (): Promise<(SquadPerformance & { memberPerformances: MemberPerformance[] }) | null> => {
      if (!squadId) return null;

      const now        = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_squad_performance');
      const { data, error } = await supabase.rpc('get_squad_performance', {
        p_squad_id:    squadId,
        p_month_start: monthStart,
        p_month_end:   monthEnd,
      });
      PerformanceMonitor.endTimer('get_squad_performance');

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      // Desserializa o array JSONB de membros retornado pela RPC
      const memberPerformances: MemberPerformance[] = (
        (row.member_performances as any[]) ?? []
      ).map((m: any): MemberPerformance => ({
        userId:          m.userId,
        userName:        m.userName    ?? 'Usuário',
        userAvatar:      m.userAvatar  ?? null,
        role:            m.role        ?? 'member',
        dealsCount:      Number(m.dealsCount),
        totalValue:      Number(m.totalValue),
        targetValue:     Number(m.targetValue),
        progressPercent: Number(m.progressPercent),
      }));

      return {
        squadId,
        squadName:       '',        // Preenchido pelo componente via squads list
        squadColor:      null,
        squadIcon:       null,
        membersCount:    Number(row.members_count),
        totalDeals:      Number(row.total_deals),
        totalValue:      Number(row.total_value),
        targetValue:     Number(row.target_value),
        progressPercent: Number(row.progress_percent),
        conversionRate:  Number(row.conversion_rate),
        topSeller: row.top_seller_id ? {
          id:    row.top_seller_id,
          name:  row.top_seller_name  ?? 'Usuário',
          value: Number(row.top_seller_value),
        } : undefined,
        memberPerformances,
      };
    },
    enabled: !!squadId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// useAllSquadsPerformance
// Antes: 4 queries separadas (squads, allMembers, deals, goals)
//        + cruzamento JS por squad_id.
// Agora: 1 chamada RPC com JOINs e GROUP BY no PostgreSQL.
// ---------------------------------------------------------------------------
export function useAllSquadsPerformance() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['all-squads-performance', organizationId],
    queryFn: async (): Promise<SquadPerformance[]> => {
      if (!organizationId) return [];

      const now        = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');

      PerformanceMonitor.startTimer('get_all_squads_performance');
      const { data, error } = await supabase.rpc('get_all_squads_performance', {
        p_organization_id: organizationId,
        p_month_start:     monthStart,
        p_month_end:       monthEnd,
      });
      PerformanceMonitor.endTimer('get_all_squads_performance');

      if (error) throw error;

      return (data ?? []).map((row: any): SquadPerformance => ({
        squadId:         row.squad_id,
        squadName:       row.squad_name        ?? '',
        squadColor:      row.squad_color        ?? null,
        squadIcon:       row.squad_icon         ?? null,
        membersCount:    Number(row.members_count),
        totalDeals:      Number(row.total_deals),
        totalValue:      Number(row.total_value),
        targetValue:     Number(row.target_value),
        progressPercent: Number(row.progress_percent),
        conversionRate:  0, // overview simplificado — sem cálculo por squad aqui
      }));
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
