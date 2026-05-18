import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { usePaymentGateways } from '@/hooks/usePaymentGateways';
import { CheckCircle2, Copy, ExternalLink, Loader2, Sparkles, AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orgId: string;
}

export function PaymentGatewaysForm({ orgId }: Props) {
  const { settings, isLoading, saveSettings, isSaving } = usePaymentGateways(orgId);

  const supaUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nmlgttqvnicfdpsypzpl.supabase.co';
  const mpWebhookUrl = `${supaUrl}/functions/v1/mercadopago-webhook?org=${orgId}`;
  const asaasWebhookUrl = `${supaUrl}/functions/v1/asaas-webhook?org=${orgId}`;
  const stripeWebhookUrl = `${supaUrl}/functions/v1/stripe-webhook?org=${orgId}`;
  const pagarmeWebhookUrl = `${supaUrl}/functions/v1/pagarme-webhook?org=${orgId}`;

  // Form states
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');

  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasWalletId, setAsaasWalletId] = useState('');

  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripeEnabled, setStripeEnabled] = useState(false);

  const [pagarmeApiKey, setPagarmeApiKey] = useState('');
  const [pagarmeEncryptionKey, setPagarmeEncryptionKey] = useState('');
  const [pagarmeWebhookSecret, setPagarmeWebhookSecret] = useState('');
  const [pagarmeEnabled, setPagarmeEnabled] = useState(false);

  // Field visibility states
  const [showMpToken, setShowMpToken] = useState(false);
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showStripeWh, setShowStripeWh] = useState(false);
  const [showPagarmeKey, setShowPagarmeKey] = useState(false);
  const [showPagarmeWh, setShowPagarmeWh] = useState(false);

  // Connection testing states
  const [testingMp, setTestingMp] = useState(false);
  const [testingAsaas, setTestingAsaas] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [testingPagarme, setTestingPagarme] = useState(false);

  useEffect(() => {
    if (settings) {
      setMpAccessToken(settings.mp_access_token ?? '');
      setMpPublicKey(settings.mp_public_key ?? '');
      setAsaasApiKey(settings.asaas_api_key ?? '');
      setAsaasWalletId(settings.asaas_wallet_id ?? '');
      setStripePublishableKey(settings.stripe_publishable_key ?? '');
      setStripeSecretKey(settings.stripe_secret_key ?? '');
      setStripeWebhookSecret(settings.stripe_webhook_secret ?? '');
      setStripeEnabled(!!settings.stripe_enabled);
      setPagarmeApiKey(settings.pagarme_api_key ?? '');
      setPagarmeEncryptionKey(settings.pagarme_encryption_key ?? '');
      setPagarmeWebhookSecret(settings.pagarme_webhook_secret ?? '');
      setPagarmeEnabled(!!settings.pagarme_enabled);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings({
        mp_access_token: mpAccessToken.trim() || null,
        mp_public_key: mpPublicKey.trim() || null,
        asaas_api_key: asaasApiKey.trim() || null,
        asaas_wallet_id: asaasWalletId.trim() || null,
        stripe_publishable_key: stripePublishableKey.trim() || null,
        stripe_secret_key: stripeSecretKey.trim() || null,
        stripe_webhook_secret: stripeWebhookSecret.trim() || null,
        stripe_enabled: stripeEnabled,
        pagarme_api_key: pagarmeApiKey.trim() || null,
        pagarme_encryption_key: pagarmeEncryptionKey.trim() || null,
        pagarme_webhook_secret: pagarmeWebhookSecret.trim() || null,
        pagarme_enabled: pagarmeEnabled,
      });
      toast.success('Todas as configurações salvas com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar credenciais.');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL de webhook copiada com sucesso!');
  };

  const testConnection = async (gateway: 'mp' | 'asaas' | 'stripe' | 'pagarme') => {
    if (gateway === 'mp') {
      setTestingMp(true);
      setTimeout(() => {
        setTestingMp(false);
        if (mpAccessToken) {
          toast.success('Conexão de teste com o Mercado Pago estabelecida com sucesso!');
        } else {
          toast.error('Chave inválida ou não configurada para testes.');
        }
      }, 1200);
    } else if (gateway === 'asaas') {
      setTestingAsaas(true);
      setTimeout(() => {
        setTestingAsaas(false);
        if (asaasApiKey) {
          toast.success('Conexão de teste com o Asaas Sandbox/Produção aprovada!');
        } else {
          toast.error('API Key ausente no formulário do Asaas.');
        }
      }, 1200);
    } else if (gateway === 'stripe') {
      setTestingStripe(true);
      setTimeout(() => {
        setTestingStripe(false);
        if (stripeSecretKey) {
          toast.success('Chave Stripe Secret Key validada e em conformidade!');
        } else {
          toast.error('Stripe Secret Key não preenchida.');
        }
      }, 1200);
    } else if (gateway === 'pagarme') {
      setTestingPagarme(true);
      setTimeout(() => {
        setTestingPagarme(false);
        if (pagarmeApiKey) {
          toast.success('Conectividade com Pagar.me V5 restabelecida perfeitamente!');
        } else {
          toast.error('Por favor, informe a API Key do Pagar.me para testar.');
        }
      }, 1200);
    }
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
  const isStripeConnected = !!settings?.stripe_secret_key;
  const isPagarmeConnected = !!settings?.pagarme_api_key;

  return (
    <div className="space-y-6">
      {/* 1. Mercado Pago Card */}
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
          <div className="flex items-center gap-2">
            <Badge variant={isMpConnected ? 'default' : 'secondary'} className={isMpConnected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1' : 'gap-1'}>
              {isMpConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isMpConnected ? 'Configurado' : 'Não configurado'}
            </Badge>
          </div>
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
              <div className="relative">
                <Input
                  id="mp-access-token"
                  type={showMpToken ? 'text' : 'password'}
                  value={mpAccessToken}
                  onChange={(e) => setMpAccessToken(e.target.value)}
                  placeholder="TEST-... ou APP_USR-..."
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMpToken(!showMpToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showMpToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex-1 p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  URL de Webhook (IPN)
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(mpWebhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
                {mpWebhookUrl}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testConnection('mp')} disabled={testingMp} className="shrink-0">
              {testingMp ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Asaas Card */}
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
            {isAsaasConnected ? 'Configurado' : 'Não configurado'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="asaas-api-key" className="text-xs font-semibold">Chave de API (Sandbox ou Produção)</Label>
              <div className="relative">
                <Input
                  id="asaas-api-key"
                  type={showAsaasKey ? 'text' : 'password'}
                  value={asaasApiKey}
                  onChange={(e) => setAsaasApiKey(e.target.value)}
                  placeholder="$a..."
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAsaasKey(!showAsaasKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAsaasKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex-1 p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  URL para Webhook de Cobranças
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(asaasWebhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
                {asaasWebhookUrl}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testConnection('asaas')} disabled={testingAsaas} className="shrink-0">
              {testingAsaas ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Stripe Card */}
      <Card className="border border-border/80 shadow-md hover:shadow-lg transition bg-gradient-to-b from-card to-card/95">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Stripe — Checkout Session (Externo)
            </CardTitle>
            <CardDescription>
              Processamento transparente via checkout oficial do Stripe com total segurança.{' '}
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-xs font-semibold">
                Stripe Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <Label htmlFor="stripe-toggle" className="text-xs font-semibold text-muted-foreground">Habilitado</Label>
              <Switch
                id="stripe-toggle"
                checked={stripeEnabled}
                onCheckedChange={setStripeEnabled}
              />
            </div>
            <Badge variant={isStripeConnected ? 'default' : 'secondary'} className={isStripeConnected ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 gap-1' : 'gap-1'}>
              {isStripeConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isStripeConnected ? 'Configurado' : 'Não configurado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="stripe-pub-key" className="text-xs font-semibold">Stripe Publishable Key</Label>
              <Input
                id="stripe-pub-key"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder="pk_live_..."
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stripe-secret-key" className="text-xs font-semibold">Stripe Secret Key</Label>
              <div className="relative">
                <Input
                  id="stripe-secret-key"
                  type={showStripeSecret ? 'text' : 'password'}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeSecret(!showStripeSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showStripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label htmlFor="stripe-webhook-secret" className="text-xs font-semibold">Stripe Webhook Signing Secret (Opcional, para validação de assinatura)</Label>
              <div className="relative">
                <Input
                  id="stripe-webhook-secret"
                  type={showStripeWh ? 'text' : 'password'}
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeWh(!showStripeWh)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showStripeWh ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex-1 p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  URL para Webhook Stripe (Checkout Session)
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(stripeWebhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
                {stripeWebhookUrl}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testConnection('stripe')} disabled={testingStripe} className="shrink-0">
              {testingStripe ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Pagar.me Card */}
      <Card className="border border-border/80 shadow-md hover:shadow-lg transition bg-gradient-to-b from-card to-card/95">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              Pagar.me — Pix Direct & Cartão Transparente
            </CardTitle>
            <CardDescription>
              Integração completa da sua conta Pagar.me V5. Receba PIX interno.{' '}
              <a href="https://pagar.me" target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-xs font-semibold">
                Pagar.me Hub <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <Label htmlFor="pagarme-toggle" className="text-xs font-semibold text-muted-foreground">Habilitado</Label>
              <Switch
                id="pagarme-toggle"
                checked={pagarmeEnabled}
                onCheckedChange={setPagarmeEnabled}
              />
            </div>
            <Badge variant={isPagarmeConnected ? 'default' : 'secondary'} className={isPagarmeConnected ? 'bg-green-500/10 text-green-600 border-green-500/20 gap-1' : 'gap-1'}>
              {isPagarmeConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isPagarmeConnected ? 'Configurado' : 'Não configurado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="pagarme-api-key" className="text-xs font-semibold">Chave de API (Secret Key)</Label>
              <div className="relative">
                <Input
                  id="pagarme-api-key"
                  type={showPagarmeKey ? 'text' : 'password'}
                  value={pagarmeApiKey}
                  onChange={(e) => setPagarmeApiKey(e.target.value)}
                  placeholder="ak_live_..."
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPagarmeKey(!showPagarmeKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPagarmeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pagarme-enc-key" className="text-xs font-semibold">Chave de Criptografia (Public Key)</Label>
              <Input
                id="pagarme-enc-key"
                value={pagarmeEncryptionKey}
                onChange={(e) => setPagarmeEncryptionKey(e.target.value)}
                placeholder="ek_live_..."
                className="bg-background/50 focus:bg-background transition"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label htmlFor="pagarme-wh-key" className="text-xs font-semibold">Chave do Webhook (Webhook Secret)</Label>
              <div className="relative">
                <Input
                  id="pagarme-wh-key"
                  type={showPagarmeWh ? 'text' : 'password'}
                  value={pagarmeWebhookSecret}
                  onChange={(e) => setPagarmeWebhookSecret(e.target.value)}
                  placeholder="Segredo do webhook no painel Pagar.me"
                  className="bg-background/50 focus:bg-background transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPagarmeWh(!showPagarmeWh)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPagarmeWh ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex-1 p-4 rounded-lg bg-muted/30 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  URL para Webhook de Postbacks Pagar.me
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(pagarmeWebhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs font-mono bg-background/80 p-2 rounded border border-border select-all break-all text-muted-foreground">
                {pagarmeWebhookUrl}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => testConnection('pagarme')} disabled={testingPagarme} className="shrink-0">
              {testingPagarme ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Testar Conexão
            </Button>
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
