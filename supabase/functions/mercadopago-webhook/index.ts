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
      console.warn('MP Webhook: Missing org query param');
      return json({ error: 'org param required' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Ler payload do Mercado Pago
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      // Alguns testes ou requisições IPN em branco
      console.warn('MP Webhook: Empty body received');
      return json({ ok: true, message: 'empty body ignored' });
    }

    console.log('MP Webhook Payload received for org:', orgId, JSON.stringify(body));

    // Determina o ID do pagamento
    // Webhook envia body.data.id. IPN envia body.resource com topic = payment
    let paymentId = '';
    const topic = body.topic || body.type;

    if (body.data?.id) {
      paymentId = String(body.data.id);
    } else if (body.resource && topic === 'payment') {
      const parts = body.resource.split('/');
      paymentId = parts[parts.length - 1];
    } else if (body.id) {
      paymentId = String(body.id);
    }

    if (!paymentId || paymentId === 'undefined') {
      console.warn('MP Webhook: Could not extract payment ID, ignoring');
      return json({ ok: true, message: 'no payment ID found' });
    }

    // Busca credenciais do Mercado Pago para esta organização
    const { data: keys } = await admin
      .from('payment_settings')
      .select('mp_access_token')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!keys?.mp_access_token) {
      console.error('MP Webhook Error: Access token not configured for org:', orgId);
      return json({ error: 'merchant access token not found' }, 404);
    }

    // Consulta os detalhes do pagamento diretamente na API do Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${keys.mp_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error(`MP Webhook: Failed to fetch payment details from MP API for ID: ${paymentId}. Error:`, errText);
      return json({ error: 'failed to fetch payment info from Gateway' }, 400);
    }

    const mpData = await mpRes.json();
    const rawStatus = mpData.status; // approved, pending, rejected, cancelled, in_process, refunded

    let status = 'pending';
    if (rawStatus === 'approved') {
      status = 'paid';
    } else if (rawStatus === 'rejected' || rawStatus === 'cancelled') {
      status = 'failed';
    } else if (rawStatus === 'refunded') {
      status = 'refunded';
    }

    console.log(`MP Webhook: Payment details resolved for ID ${paymentId} -> Raw status: ${rawStatus}, mapped: ${status}`);

    // Atualiza a transação correspondente no banco
    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', orgId)
      .eq('gateway', 'mercadopago')
      .eq('external_id', paymentId)
      .select()
      .maybeSingle();

    if (txErr) {
      console.error('MP Webhook: local transactions update failed:', txErr);
      return json({ error: 'failed to update transaction' }, 500);
    }

    if (!tx) {
      console.warn(`MP Webhook: Mapped transaction with external_id ${paymentId} not found in org ${orgId}. It might be a platform payment or external checkout.`);
      return json({ ok: true, message: 'transaction not found in DB' });
    }

    console.log(`MP Webhook Success: updated transaction ${tx.id} to status ${status}`);
    return json({ ok: true, status });

  } catch (err: any) {
    console.error('MP Webhook Fatal Error:', err);
    return json({ error: err.message || 'Fatal error' }, 500);
  }
});
