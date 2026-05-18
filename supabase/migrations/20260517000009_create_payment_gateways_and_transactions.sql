-- Migration: Criar Tabelas de Configuração de Pagamento e Transações de Pix Direct
-- Data: 2026-05-17

-- 1. Tabela para configurações confidenciais de gateways (Mercado Pago e Asaas) por tenant
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  mp_access_token TEXT,
  mp_public_key TEXT,
  asaas_api_key TEXT,
  asaas_wallet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativar Row Level Security
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para payment_settings: Apenas admins/super-admins da organização podem ver ou editar
CREATE POLICY "Org admins can view their payment settings"
ON public.payment_settings FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Org admins can insert their payment settings"
ON public.payment_settings FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Org admins can update their payment settings"
ON public.payment_settings FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Org admins can delete their payment settings"
ON public.payment_settings FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);

-- 2. Tipo ENUM para os gateways de pagamento internos suportados
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_gateway') THEN
    CREATE TYPE public.payment_gateway AS ENUM ('mercadopago', 'asaas');
  END IF;
END $$;

-- 3. Tabela para transações e controle de pagamentos por Pix Direct
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway public.payment_gateway NOT NULL,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL,
  customer_email TEXT NOT NULL,
  produtos_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  qr_code TEXT,
  qr_code_base64 TEXT,
  expiration_date TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, gateway, external_id)
);

-- Ativar Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para transactions: Todos os membros autenticados da organização podem consultar transações
CREATE POLICY "Org members can select transactions"
ON public.transactions FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

-- 4. Triggers de atualização automática da coluna updated_at
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
