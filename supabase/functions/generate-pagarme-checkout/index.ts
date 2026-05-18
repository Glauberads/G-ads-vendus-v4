import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // 1. Validar Autenticação do Usuário (JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Falta token de autorização." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Identificar a organização (tenant) do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Perfil da organização não localizado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.organization_id;

    // 3. Ler parâmetros de checkout do body
    const { amount, customer_email, produtos } = await req.json();

    if (!amount || !customer_email || !produtos || !produtos.length) {
      return new Response(JSON.stringify({ error: "Parâmetros de checkout inválidos ou faltantes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Buscar credenciais Pagar.me do tenant correspondente
    const { data: settings, error: settingsError } = await supabaseClient
      .from("payment_settings")
      .select("pagarme_api_key, pagarme_enabled")
      .eq("organization_id", orgId)
      .single();

    if (settingsError || !settings || !settings.pagarme_api_key || !settings.pagarme_enabled) {
      return new Response(JSON.stringify({ error: "Pagar.me não está configurado ou ativo para esta organização." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pagarmeApiKey = settings.pagarme_api_key;
    const amountInCents = Math.round(amount * 100);
    const firstProductName = produtos[0]?.name || "Pedido Scale";

    // 5. Autenticação Basic com API Key do Pagar.me
    const basicAuth = btoa(`${pagarmeApiKey}:`);

    // Criar uma cobrança Pix no Pagar.me V5
    const pagarmeBody = {
      customer: {
        name: "Cliente Pix Scale",
        email: customer_email,
        document: "00000000000",
        type: "individual",
        phones: {
          home_phone: {
            country_code: "55",
            area_code: "11",
            number: "999999999"
          }
        }
      },
      items: [
        {
          amount: amountInCents,
          description: firstProductName,
          quantity: 1
        }
      ],
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: 900 // 15 minutos (900 segundos)
          }
        }
      ],
      metadata: {
        organization_id: orgId
      }
    };

    const pagarmeResponse = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pagarmeBody),
    });

    const pagarmeData = await pagarmeResponse.json();

    if (!pagarmeResponse.ok) {
      console.error("Erro na API do Pagar.me:", pagarmeData);
      return new Response(JSON.stringify({ error: pagarmeData.message || "Erro ao conectar com a API do Pagar.me." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charge = pagarmeData.charges?.[0];
    if (!charge || !charge.last_transaction) {
      return new Response(JSON.stringify({ error: "Nenhuma transação Pix gerada pelo Pagar.me." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargeId = charge.id;
    const qrCode = charge.last_transaction.qr_code;
    const qrCodeUrl = charge.last_transaction.qr_code_url;
    const expDate = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15m expiração

    // 6. Registrar a transação local
    const { data: transaction, error: txError } = await supabaseClient
      .from("transactions")
      .insert({
        organization_id: orgId,
        gateway: "pagarme",
        external_id: chargeId,
        status: "pending",
        amount,
        customer_email,
        produtos_details: produtos,
        qr_code: qrCode,
        qr_code_base64: qrCodeUrl,
        expiration_date: expDate,
      })
      .select()
      .single();

    if (txError) {
      console.error("Erro ao salvar transação Pagar.me:", txError);
      return new Response(JSON.stringify({ error: "Erro ao registrar transação no banco local." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transactionId: transaction.id,
      qr_code: qrCode,
      qr_code_base64: qrCodeUrl,
      expiration_date: expDate,
      payment_id: chargeId,
      status: "pending",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erro interno na Edge Function do Pagar.me:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno do servidor." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
