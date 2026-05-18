import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Copy, Loader2, RefreshCw, Smartphone, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface ProdutoItem {
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gateway: 'mercadopago' | 'asaas';
  amount: number;
  customerEmail: string;
  produtos: ProdutoItem[];
  onPaymentSuccess?: (transaction: any) => void;
  ctaText?: string;
  ctaUrl?: string;
  onCtaClick?: () => void;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  gateway,
  amount,
  customerEmail,
  produtos,
  onPaymentSuccess,
  ctaText = 'Concluir',
  ctaUrl,
  onCtaClick,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pix States
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Timer regressivo
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Gera o Pix no primeiro carregamento do modal
  useEffect(() => {
    if (isOpen) {
      generatePix();
    } else {
      // Reseta todos os estados
      setTransactionId(null);
      setQrCode('');
      setQrCodeBase64('');
      setStatus('pending');
      setExpirationDate(null);
      setInvoiceUrl(null);
      setError(null);
      setSecondsLeft(null);
    }
  }, [isOpen]);

  const generatePix = async () => {
    setLoading(true);
    setError(null);
    setSecondsLeft(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('generate-checkout', {
        body: {
          gateway,
          amount,
          customer_email: customerEmail,
          produtos,
        },
      });

      if (funcError) throw funcError;
      if (data.error) throw new Error(data.error);

      setTransactionId(data.transactionId);
      setQrCode(data.qr_code);
      setQrCodeBase64(data.qr_code_base64);
      setExpirationDate(data.expiration_date);
      setInvoiceUrl(data.invoice_url);
      setStatus(data.status === 'approved' ? 'paid' : 'pending');
    } catch (err: any) {
      console.error('Erro ao gerar Pix Direct:', err);
      setError(err.message || 'Falha ao processar Pix. Verifique se as chaves do gateway estão configuradas.');
    } finally {
      setLoading(false);
    }
  };

  // Cronômetro dinâmico de expiração & marcação de abandono
  useEffect(() => {
    if (!expirationDate || status === 'paid' || status === 'failed') {
      setSecondsLeft(null);
      return;
    }

    const expTime = new Date(expirationDate).getTime();

    const updateCountdown = async () => {
      const now = Date.now();
      const diff = Math.floor((expTime - now) / 1000);

      if (diff <= 0) {
        setSecondsLeft(0);
        setStatus('failed');
        if (transactionId) {
          try {
            await supabase
              .from('transactions')
              .update({ status: 'abandoned', updated_at: new Date().toISOString() })
              .eq('id', transactionId);
            toast.error('Este código Pix expirou.');
          } catch (e) {
            console.error('Erro ao salvar abandono do Pix:', e);
          }
        }
      } else {
        setSecondsLeft(diff);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expirationDate, transactionId, status]);

  // Sincronização híbrida: Realtime Supabase + Polling Fallback
  useEffect(() => {
    if (!transactionId || status === 'paid' || status === 'failed') return;

    // 1. Canal Realtime Supabase para menor latência
    const channel = supabase
      .channel(`transaction-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `id=eq.${transactionId}`,
        },
        (payload: any) => {
          console.log('Update de transação via Realtime:', payload);
          const newStatus = payload.new?.status;
          if (newStatus === 'paid') {
            setStatus('paid');
            toast.success('Pagamento confirmado via Realtime!');
            if (onPaymentSuccess) onPaymentSuccess(payload.new);
          } else if (newStatus === 'abandoned' || newStatus === 'failed') {
            setStatus('failed');
          }
        }
      )
      .subscribe();

    // 2. Polling de velocidade ultra rápida (a cada 4 segundos)
    const polling = setInterval(async () => {
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .maybeSingle();

      if (!queryError && data) {
        if (data.status === 'paid') {
          setStatus('paid');
          toast.success('Pagamento confirmado via Polling!');
          if (onPaymentSuccess) onPaymentSuccess(data);
        } else if (data.status === 'abandoned' || data.status === 'failed') {
          setStatus('failed');
        }
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(polling);
    };
  }, [transactionId, status]);

  const copyPixCode = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    toast.success('Chave Pix copia e cola copiada!');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else if (ctaUrl) {
      window.open(ctaUrl, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] overflow-hidden border border-border/80 bg-gradient-to-b from-card to-card/95 p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="text-center pb-2 border-b border-border/50">
          <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2 text-foreground">
            <Smartphone className="h-5 w-5 text-primary animate-pulse" />
            Pagamento via Pix Direct
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escaneie o código QR ou copie a chave Pix para concluir.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Gerando seu código Pix Direct...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              ❌
            </div>
            <p className="text-sm font-medium text-destructive px-4">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={generatePix} className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : status === 'paid' ? (
          /* Premium Success Screen with CTA */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping scale-110" />
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-500 relative">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Pagamento Confirmado!</h3>
              <p className="text-sm text-muted-foreground max-w-xs px-2">
                O seu pagamento Pix foi processado instantaneamente e a transação está concluída.
              </p>
            </div>
            <Button onClick={handleCtaClick} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2">
              {ctaText}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : status === 'failed' || (secondsLeft !== null && secondsLeft <= 0) ? (
          /* Expired Screen with regeneration option */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-20 w-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <Clock className="h-10 w-10 text-rose-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Código Pix Expirado</h3>
              <p className="text-sm text-muted-foreground max-w-xs px-2">
                O tempo limite estabelecido para efetuar o Pix esgotou. Marcaremos esta transação como não concluída.
              </p>
            </div>
            <Button onClick={generatePix} size="lg" className="w-full bg-primary hover:bg-primary/95 text-white font-semibold">
              Gerar Novo Código Pix
            </Button>
          </div>
        ) : (
          /* Pix QR & Details Screen */
          <div className="space-y-5 pt-3 animate-in fade-in duration-200">
            {/* Resumo do Pedido */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1.5">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Resumo da Venda</span>
                <span className="text-primary font-bold text-sm">R$ {amount.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed max-h-16 overflow-y-auto pr-1">
                {produtos.map((p, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>{p.name} (x{p.quantity})</span>
                    <span>R$ {(p.price * p.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timer Regressivo Display */}
            {secondsLeft !== null && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-semibold bg-rose-500/5 text-rose-600 dark:text-rose-400 py-1.5 px-3 rounded-lg border border-rose-500/10">
                <Clock className="h-4 w-4 animate-spin text-rose-500" />
                <span>Pague em até: </span>
                <span className="font-mono font-bold text-sm">{formatTime(secondsLeft)}</span>
              </div>
            )}

            {/* QR Code Renders */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative p-3 rounded-xl border border-border/80 bg-white shadow-inner flex items-center justify-center h-[200px] w-[200px]">
                {qrCodeBase64 ? (
                  <img
                    src={qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground text-xs text-center space-y-1">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Carregando imagem...</span>
                  </div>
                )}
              </div>

              {/* Glowing Waiting State */}
              <div className="flex items-center gap-2 text-xs font-semibold text-primary/95 bg-primary/5 py-1 px-3.5 rounded-full border border-primary/10 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando confirmação do pagamento...
              </div>
            </div>

            {/* Pix Copia e Cola */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Chave Pix Copia e Cola</span>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/60 p-2 rounded-lg border border-border/80 font-mono text-[10px] break-all select-all text-muted-foreground max-h-16 overflow-y-auto">
                  {qrCode}
                </div>
                <Button size="icon" onClick={copyPixCode} className="h-10 w-10 shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Security Notice / Fallback */}
            <div className="pt-2 border-t border-border/40 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Transação 100% segura monitorada por Scale Pay.
              </span>
              {invoiceUrl && (
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-primary/80 hover:text-primary hover:underline"
                >
                  Problemas com o QR Code? Clique aqui para abrir a fatura reserva.
                </a>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
