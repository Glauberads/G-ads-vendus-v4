import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SuperAdminUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  organization_id?: string | null;
  created_at: string;
  organizations?: { id: string; name: string } | null;
  user_roles?: { user_id: string; role: string; organization_id?: string | null }[];
}

export function useSuperAdminUsers() {
  return useQuery<SuperAdminUser[]>({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }
      if (!profiles || profiles.length === 0) return [];

      const orgIds = [...new Set(profiles.map(p => p.organization_id).filter(Boolean))] as string[];
      let organizations: { id: string; name: string }[] = [];

      if (orgIds.length > 0) {
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);

        if (orgsError) {
          console.error('Error fetching organizations:', orgsError);
        } else {
          organizations = orgsData || [];
        }
      }

      const userIds = profiles.map(p => p.id);
      let roles: { user_id: string; role: string; organization_id?: string | null }[] = [];

      if (userIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role, organization_id')
          .in('user_id', userIds);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else {
          roles = rolesData || [];
        }
      }

      return profiles.map(profile => ({
        ...profile,
        organizations: organizations.find(o => o.id === profile.organization_id) || null,
        user_roles: roles.filter(r => r.user_id === profile.id) || []
      }));
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useUpdateUserRoleBySuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
      organizationId,
    }: {
      userId: string;
      role: string;
      organizationId: string | null;
    }) => {
      const { data, error } = await supabase.rpc('update_user_role_by_super_admin', {
        p_user_id: userId,
        p_role: role,
        p_organization_id: organizationId,
      });

      if (error) {
        console.error('Error in update_user_role_by_super_admin RPC:', error);
        throw error;
      }

      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(data.error || 'Falha ao atualizar permissões');
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Permissões atualizadas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['organization-details'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar permissões do usuário');
    },
  });
}
