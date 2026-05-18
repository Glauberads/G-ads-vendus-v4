import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Valida o chamador utilizando o cliente anônimo do Supabase
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Busca o perfil do chamador para obter a organização
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', caller.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada para o usuário' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = profile.organization_id;

    // Recebe o payload do checkout
    const body = await req.json();
    const { gateway, amount, customer_email, produtos } = body;

    if (!gateway || !amount || !customer_email || !produtos) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes: gateway, amount, customer_email, produtos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (gateway !== 'mercadopago' && gateway !== 'asaas') {
      return new Response(JSON.stringify({ error: 'Gateway inválido. Escolha mercadopago ou asaas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca chaves de pagamento da organização
    const { data: keys } = await admin
      .from('payment_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!keys) {
      return new Response(JSON.stringify({ error: 'As credenciais de pagamento deste tenant não foram configuradas. Acesse as Configurações de Pagamento.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transactionId = crypto.randomUUID();
    const desc = `Compra de produtos: ${produtos.map((p: any) => p.name).join(', ')}`;

    let paymentId = '';
    let status = 'pending';
    let qrCode = '';
    let qrCodeBase64 = '';
    let expirationDate = null;
    let invoiceUrl = null;

    if (gateway === 'mercadopago') {
      if (!keys.mp_access_token) {
        return new Response(JSON.stringify({ error: 'Token de acesso do Mercado Pago não configurado.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Chamada Pix Direct no Mercado Pago
      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keys.mp_access_token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': transactionId,
        },
        body: JSON.stringify({
          transaction_amount: Number(amount),
          description: desc.substring(0, 150),
          payment_method_id: 'pix',
          notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook?org=${orgId}`,
          payer: {
            email: customer_email,
            first_name: 'Cliente',
            last_name: 'Scale',
          }
        }),
      });

      const mpData = await mpResponse.json();
      if (!mpResponse.ok || mpData.status === 'rejected' || mpData.error) {
        console.error('MP Pix Error:', mpData);
        return new Response(JSON.stringify({ error: mpData.message || 'Falha ao gerar Pix no Mercado Pago' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      paymentId = String(mpData.id);
      status = mpData.status; // pending
      expirationDate = mpData.date_of_expiration;
      qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || '';
      qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
    } else {
      // Asaas Pix Direct
      if (!keys.asaas_api_key) {
        return new Response(JSON.stringify({ error: 'Chave de API do Asaas não configurada.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Procurar ou criar cliente no Asaas
      const clientHeaders = {
        'access_token': keys.asaas_api_key,
        'Content-Type': 'application/json',
      };

      const cleanEmail = encodeURIComponent(customer_email.trim().toLowerCase());
      const searchRes = await fetch(`https://api.asaas.com/v3/customers?email=${cleanEmail}`, {
        method: 'GET',
        headers: clientHeaders,
      });
      const searchData = await searchRes.json();

      let customerId = '';
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      } else {
        const createRes = await fetch('https://api.asaas.com/v3/customers', {
          method: 'POST',
          headers: clientHeaders,
          body: JSON.stringify({
            name: 'Cliente Scale',
            email: customer_email.trim().toLowerCase(),
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.id) {
          console.error('Asaas Customer Create Error:', createData);
          return new Response(JSON.stringify({ error: createData.errors?.[0]?.description || 'Falha ao criar cliente no Asaas' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        customerId = createData.id;
      }

      // 2. Criar cobrança PIX no Asaas
      const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const payRes = await fetch('https://api.asaas.com/v3/payments', {
        method: 'POST',
        headers: clientHeaders,
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: Number(amount),
          dueDate: nextDay,
          description: desc.substring(0, 150),
          externalReference: transactionId,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData.id) {
        console.error('Asaas Pay Create Error:', payData);
        return new Response(JSON.stringify({ error: payData.errors?.[0]?.description || 'Falha ao gerar cobrança no Asaas' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      paymentId = payData.id;
      invoiceUrl = payData.invoiceUrl; // Fallback
      status = 'pending';

      // 3. Obter QR Code e cópia-e-cola do Asaas
      const qrRes = await fetch(`https://api.asaas.com/v3/payments/${paymentId}/pixQrCode`, {
        method: 'GET',
        headers: clientHeaders,
      });

      const qrData = await qrRes.json();
      if (!qrRes.ok || !qrData.payload) {
        console.error('Asaas Pix QR Error:', qrData);
        return new Response(JSON.stringify({ error: qrData.errors?.[0]?.description || 'Falha ao ler QR Code Pix no Asaas' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      qrCode = qrData.payload; // copia e cola
      qrCodeBase64 = qrData.encodedImage; // base64 da imagem
      expirationDate = qrData.expirationDate || nextDay;
    }

    // 4. Salvar transação no banco de dados local
    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .insert({
        id: transactionId,
        organization_id: orgId,
        gateway,
        external_id: paymentId,
        status,
        amount: Number(amount),
        customer_email,
        produtos_details: produtos,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        expiration_date: expirationDate,
        invoice_url: invoiceUrl,
      })
      .select()
      .single();

    if (txErr) {
      console.error('Transaction Record Insert Error:', txErr);
      return new Response(JSON.stringify({ error: 'Erro ao registrar transação no banco local' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transactionId: tx.id,
      paymentId,
      gateway,
      status,
      amount: tx.amount,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      expiration_date: expirationDate,
      invoice_url: invoiceUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('generate-checkout fatal error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro fatal' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
