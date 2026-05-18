import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePaymentGateways } from '@/hooks/usePaymentGateways';
import { CheckCircle2, Copy, ExternalLink, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orgId: string;
}

export function PaymentGatewaysForm({ orgId }: Props) {
  const { settings, isLoading, saveSettings, isSaving } = usePaymentGateways(orgId);

  const supaUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nmlgttqvnicfdpsypzpl.supabase.co';
  const mpWebhookUrl = `${supaUrl}/functions/v1/mercadopago-webhook?org=${orgId}`;
  const asaasWebhookUrl = `${supaUrl}/functions/v1/asaas-webhook?org=${orgId}`;

  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasWalletId, setAsaasWalletId] = useState('');

  useEffect(() => {
    if (settings) {
      setMpAccessToken(settings.mp_access_token ?? '');
      setMpPublicKey(settings.mp_public_key ?? '');
      setAsaasApiKey(settings.asaas_api_key ?? '');
      setAsaasWalletId(settings.asaas_wallet_id ?? '');
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings({
        mp_access_token: mpAccessToken.trim() || null,
        mp_public_key: mpPublicKey.trim() || null,
        asaas_api_key: asaasApiKey.trim() || null,
        asaas_wallet_id: asaasWalletId.trim() || null,
      });
      toast.success('Configurações de gateway salvas com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar credenciais.');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL do webhook copiada para a área de transferência!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
        Carregando configurações de pagamento...
      </div>
    );
  }

  const isMpConnected = !!settings?.mp_access_token;
  const isAsaasConnected = !!settings?.asaas_api_key;

  return (
    <div className="space-y-6">
      {/* Mercado Pago Card */}
      <Card className="border border-border/80 shadow-md hover:shadow-lg transition bg-gradient-to-b from-card to-card/95">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Mercado Pago — Pix Direct
            </CardTitle>
            <CardDescription>
              Receba pagamentos Pix na hora dentro do seu app.{' '}
              <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-xs font-semibold">
                Portal de Desenvolvedores <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <Badge variant={isMpConnected ? 'default' : 'secondary'} className={isMpConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1' : 'gap-1'}>
            {isMpConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
            {isMpConnected ? 'Conectado' : 'Não configurado'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="mp-public-key" className="text-xs font-semibold">Public Key</Label>
              <Input
                id="mp-public-key"
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder="APP_USR-..."
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mp-access-token" className="text-xs font-semibold">Access Token</Label>
              <Input
                id="mp-access-token"
                type="password"
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder="TEST-... ou APP_USR-..."
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                URL de Notificação para Produção (Webhook IPN)
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(mpWebhookUrl)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
              {mpWebhookUrl}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cadastre esta URL em seu painel do Mercado Pago sob **Suas Integrações &gt; Configurações &gt; Webhooks** para receber confirmações instantâneas de pagamento Pix.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Asaas Card */}
      <Card className="border border-border/80 shadow-md hover:shadow-lg transition bg-gradient-to-b from-card to-card/95">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Asaas — Pix Direct
            </CardTitle>
            <CardDescription>
              Integre sua conta Asaas para faturamento direto de Pix.{' '}
              <a href="https://docs.asaas.com" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-xs font-semibold">
                Documentação Oficial <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <Badge variant={isAsaasConnected ? 'default' : 'secondary'} className={isAsaasConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1' : 'gap-1'}>
            {isAsaasConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
            {isAsaasConnected ? 'Conectado' : 'Não configurado'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="asaas-api-key" className="text-xs font-semibold">Chave de API (Produção ou Sandbox)</Label>
              <Input
                id="asaas-api-key"
                type="password"
                value={asaasApiKey}
                onChange={(e) => setAsaasApiKey(e.target.value)}
                placeholder="$a..."
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="asaas-wallet-id" className="text-xs font-semibold">ID da Carteira (Opcional)</Label>
              <Input
                id="asaas-wallet-id"
                value={asaasWalletId}
                onChange={(e) => setAsaasWalletId(e.target.value)}
                placeholder="Identificador da carteira digital"
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                URL para Webhook de Cobranças (Faturamento)
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(asaasWebhookUrl)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
              {asaasWebhookUrl}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configure esta URL no painel do Asaas em **Minha Conta &gt; Integrações &gt; Webhook para Cobranças** com os eventos de **Criada**, **Recebida** e **Confirmada** marcados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Control Buttons */}
      <div className="flex justify-end pt-2">
        <Button size="lg" onClick={handleSave} disabled={isSaving} className="shadow">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </div>
    </div>
  );
}
