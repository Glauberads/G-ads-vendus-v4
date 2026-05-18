import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  Ban,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  orgId: string;
}

export function PixDirectDashboard({ orgId }: Props) {
  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pix-direct-dashboard-metrics', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // Busca todas as transações de Pix Direct do tenant
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalGenerated = txs?.length ?? 0;
      const paidTxs = txs?.filter((t) => t.status === 'paid') ?? [];
      const totalPaid = paidTxs.length;

      // KPIs
      const conversion = totalGenerated > 0 ? (totalPaid / totalGenerated) * 100 : 0;
      const totalRevenue = paidTxs.reduce((acc, t) => acc + Number(t.amount), 0);
      const ticketAvg = totalPaid > 0 ? totalRevenue / totalPaid : 0;

      const pendingCount = txs?.filter((t) => t.status === 'pending').length ?? 0;
      const abandonedCount = txs?.filter((t) => t.status === 'abandoned' || t.status === 'failed').length ?? 0;

      // Splits por Gateway
      const mpCount = txs?.filter((t) => t.gateway === 'mercadopago').length ?? 0;
      const asaasCount = txs?.filter((t) => t.gateway === 'asaas').length ?? 0;

      return {
        totalGenerated,
        totalPaid,
        conversion,
        totalRevenue,
        ticketAvg,
        pendingCount,
        abandonedCount,
        mpCount,
        asaasCount,
        recentTransactions: txs?.slice(0, 10) ?? [],
      };
    },
  });

  const fmtBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">Pago</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">Pendente</Badge>;
      case 'abandoned':
      case 'failed':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-semibold">Expirado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getGatewayBadge = (gateway: string) => {
    if (gateway === 'mercadopago') {
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-medium">Mercado Pago</Badge>;
    }
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-medium">Asaas</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted-foreground text-sm space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>Calculando métricas financeiras de Pix Direct...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Control */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            Métricas de Vendas Pix Direct
          </h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe o desempenho de conversão, faturamento e abandono em tempo real.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2 shadow-sm">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? 'Atualizando...' : 'Atualizar Dados'}
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Receita Total */}
        <Card className="border border-border/80 shadow-sm bg-gradient-to-b from-card to-card/95 hover:shadow transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Receita Total</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{fmtBRL(metrics?.totalRevenue ?? 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Soma de todos os Pix pagos</p>
          </CardContent>
        </Card>

        {/* Pix Pagos */}
        <Card className="border border-border/80 shadow-sm bg-gradient-to-b from-card to-card/95 hover:shadow transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Pix Pagos</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{metrics?.totalPaid}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vendas Pix aprovadas</p>
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card className="border border-border/80 shadow-sm bg-gradient-to-b from-card to-card/95 hover:shadow transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Taxa de Conversão</span>
            <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{metrics?.conversion.toFixed(1)}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(metrics?.conversion ?? 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pix Gerados */}
        <Card className="border border-border/80 shadow-sm bg-gradient-to-b from-card to-card/95 hover:shadow transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Pix Gerados</span>
            <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{metrics?.totalGenerated}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total de intenções de compra</p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="border border-border/80 shadow-sm bg-gradient-to-b from-card to-card/95 hover:shadow transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground">Ticket Médio</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{fmtBRL(metrics?.ticketAvg ?? 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Valor médio das vendas Pix</p>
          </CardContent>
        </Card>
      </div>

      {/* Auxiliary Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/60 p-4 flex items-center gap-4 bg-card/60">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Pix Pendentes</div>
            <div className="text-2xl font-bold">{metrics?.pendingCount}</div>
            <p className="text-[10px] text-muted-foreground">Aguardando pagamento no app</p>
          </div>
        </Card>

        <Card className="border border-border/60 p-4 flex items-center gap-4 bg-card/60">
          <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
            <Ban className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Pix Abandonados / Expirados</div>
            <div className="text-2xl font-bold">{metrics?.abandonedCount}</div>
            <p className="text-[10px] text-muted-foreground">Não concluídos dentro do tempo limite</p>
          </div>
        </Card>

        <Card className="border border-border/60 p-4 bg-card/60 flex flex-col justify-center">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Divisão de Gateway Utilizado</div>
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>Mercado Pago: {metrics?.mpCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Asaas: {metrics?.asaasCount}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Transações Pix Direct Recentes
          </CardTitle>
          <CardDescription>
            Últimas 10 cobranças iniciadas na plataforma para o seu tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {metrics?.recentTransactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Nenhuma transação Pix gerada até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-xs text-foreground px-4">Cliente (E-mail)</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Data de Criação</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Gateway</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Valor</TableHead>
                    <TableHead className="font-semibold text-xs text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.recentTransactions.map((tx: any) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30 transition">
                      <TableCell className="px-4 font-medium text-sm text-foreground max-w-[200px] truncate">
                        {tx.customer_email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getGatewayBadge(tx.gateway)}
                      </TableCell>
                      <TableCell className="font-bold text-sm text-foreground">
                        {fmtBRL(Number(tx.amount))}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tx.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
