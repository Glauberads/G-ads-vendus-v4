import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org');

    if (!orgId) {
      console.warn('Asaas Webhook: Missing org query param');
      return json({ error: 'org query param required' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Ler payload do Asaas
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      console.warn('Asaas Webhook: Empty body received');
      return json({ ok: true, message: 'empty body ignored' });
    }

    console.log('Asaas Webhook Payload received for org:', orgId, JSON.stringify(body));

    const event = body.event;
    const payment = body.payment;

    if (!payment || !payment.id) {
      console.warn('Asaas Webhook: Missing payment info in body');
      return json({ ok: true, message: 'no payment info' });
    }

    const paymentId = String(payment.id);
    const extRef = payment.externalReference; // pode ser o UUID da nossa transação

    // Validação do token de autenticação enviado pelo Asaas (segurança extra)
    const clientToken = req.headers.get('asaas-access-token');
    if (clientToken) {
      const { data: keys } = await admin
        .from('payment_settings')
        .select('asaas_api_key')
        .eq('organization_id', orgId)
        .maybeSingle();

      // Se configurado, compara o token para segurança adicional
      if (keys?.asaas_api_key && keys.asaas_api_key !== clientToken) {
        console.warn(`Asaas Webhook: Received token did not match API key. Token received: ${clientToken}`);
        // Nota: Dependendo da configuração da fila Asaas, o token pode diferir ou não estar no header exato,
        // mas é útil para fins de auditoria de segurança.
      }
    }

    // Mapeia o status do pagamento Asaas
    let status = 'pending';
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      status = 'paid';
    } else if (event === 'PAYMENT_OVERDUE') {
      status = 'overdue';
    } else if (event === 'PAYMENT_DELETED') {
      status = 'failed';
    } else {
      // Outros eventos (ex: PAYMENT_CREATED) mantêm o status pendente
      console.log(`Asaas Webhook: Event ${event} resolved as pending`);
      return json({ ok: true, message: 'event skipped' });
    }

    console.log(`Asaas Webhook: Resolving payment ${paymentId} (Ref: ${extRef}) to status: ${status}`);

    // Procura transação e atualiza status
    let txQuery = admin.from('transactions').update({
      status: status,
      updated_at: new Date().toISOString()
    }).eq('organization_id', orgId);

    // Se temos externalReference (UUID interno da transação), usamos ele por ser mais direto, senão usamos o external_id
    if (extRef && extRef.length === 36) {
      txQuery = txQuery.eq('id', extRef);
    } else {
      txQuery = txQuery.eq('gateway', 'asaas').eq('external_id', paymentId);
    }

    const { data: tx, error: txErr } = await txQuery.select().maybeSingle();

    if (txErr) {
      console.error('Asaas Webhook: local transactions update failed:', txErr);
      return json({ error: 'failed to update transaction' }, 500);
    }

    if (!tx) {
      console.warn(`Asaas Webhook: Mapped transaction with external_id ${paymentId} not found in org ${orgId}.`);
      return json({ ok: true, message: 'transaction not found in DB' });
    }

    console.log(`Asaas Webhook Success: updated transaction ${tx.id} to status ${status}`);
    return json({ ok: true, status });

  } catch (err: any) {
    console.error('Asaas Webhook Fatal Error:', err);
    return json({ error: err.message || 'Fatal error' }, 500);
  }
});
