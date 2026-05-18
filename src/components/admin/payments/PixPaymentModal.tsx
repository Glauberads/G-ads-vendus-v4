import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Copy, Loader2, RefreshCw, Smartphone, CreditCard, ShieldCheck } from 'lucide-react';
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
}

export function PixPaymentModal({
  isOpen,
  onClose,
  gateway,
  amount,
  customerEmail,
  produtos,
  onPaymentSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pix States
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  // Gera o Pix no primeiro carregamento do modal
  useEffect(() => {
    if (isOpen) {
      generatePix();
    } else {
      // Reseta estados
      setTransactionId(null);
      setQrCode('');
      setQrCodeBase64('');
      setStatus('pending');
      setInvoiceUrl(null);
      setError(null);
    }
  }, [isOpen]);

  const generatePix = async () => {
    setLoading(true);
    setError(null);
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
      setStatus(data.status === 'approved' ? 'paid' : 'pending');
      setInvoiceUrl(data.invoice_url);
    } catch (err: any) {
      console.error('Erro ao gerar Pix Direct:', err);
      setError(err.message || 'Falha ao processar Pix. Verifique se as chaves do gateway estão configuradas.');
    } finally {
      setLoading(false);
    }
  };

  // Polling dinâmico a cada 4 segundos no banco para confirmar pagamento
  useEffect(() => {
    if (!transactionId || status === 'paid') return;

    const interval = setInterval(async () => {
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', transactionId)
        .maybeSingle();

      if (queryError) {
        console.error('Erro no polling do Pix:', queryError);
        return;
      }

      if (data?.status === 'paid') {
        setStatus('paid');
        clearInterval(interval);
        toast.success('Oba! Pagamento recebido com sucesso!');
        if (onPaymentSuccess) {
          onPaymentSuccess(data);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [transactionId, status]);

  const copyPixCode = () => {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    toast.success('Chave Pix copia e cola copiada!');
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
          /* Success Screen */
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
                Obrigado! O seu Pix foi processado instantaneamente e a transação está concluída.
              </p>
            </div>
            <Button onClick={onClose} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Concluir
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
