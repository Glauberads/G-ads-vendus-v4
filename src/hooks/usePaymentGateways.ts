import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentSettings {
  id?: string;
  organization_id: string;
  mp_access_token?: string | null;
  mp_public_key?: string | null;
  asaas_api_key?: string | null;
  asaas_wallet_id?: string | null;
  stripe_secret_key?: string | null;
  stripe_publishable_key?: string | null;
  stripe_webhook_secret?: string | null;
  stripe_enabled?: boolean | null;
  pagarme_api_key?: string | null;
  pagarme_encryption_key?: string | null;
  pagarme_webhook_secret?: string | null;
  pagarme_enabled?: boolean | null;
}

export function usePaymentGateways(orgId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-gateways-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (error) throw error;
      return data as PaymentSettings | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<PaymentSettings>) => {
      if (!orgId) throw new Error('ID da Organização é obrigatório');

      const { data, error } = await supabase
        .from('payment_settings')
        .upsert({
          organization_id: orgId,
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-gateways-settings', orgId] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
