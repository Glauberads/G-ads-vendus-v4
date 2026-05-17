import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DEFAULT_EMAILS = ['superadmin@vendus.com.br', 'admin@vendus.com.br'];

/**
 * Detecta se o super admin atual está usando credenciais padrão de instalação
 * (email padrão OU senha ainda não trocada). Usado para forçar o modal de
 * primeiro acesso após o seed inicial em um remix.
 */
export function useSuperAdminFirstAccess() {
  const { user, isSuperAdmin } = useAuth();

  const query = useQuery({
    queryKey: ['platform-settings', 'first-access'],
    enabled: !!user?.id && isSuperAdmin(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('default_password_changed, remix_setup_completed')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const usingDefaultEmail = !!user?.email && DEFAULT_EMAILS.includes(user.email.toLowerCase());
  // Se a query terminou e não há registro em platform_settings, força o wizard
  // (cenário de remix novo onde a tabela ainda está vazia).
  const noSettingsRow = !query.isLoading && !query.isError && query.data == null;
  const passwordNotChanged =
    noSettingsRow || (query.data as any)?.default_password_changed === false;
  const setupNotCompleted =
    noSettingsRow || (query.data as any)?.remix_setup_completed === false;

  // Wizard abre enquanto a configuração inicial (senha + obrigatórios) não estiver concluída.
  const shouldForceSetup =
    !!user?.id &&
    isSuperAdmin() &&
    !query.isLoading &&
    (passwordNotChanged || setupNotCompleted);

  return {
    shouldForceSetup,
    usingDefaultEmail,
    passwordNotChanged,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
