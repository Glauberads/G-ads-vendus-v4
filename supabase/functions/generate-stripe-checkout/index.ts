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

    // 4. Buscar credenciais Stripe do tenant correspondente
    const { data: settings, error: settingsError } = await supabaseClient
      .from("payment_settings")
      .select("stripe_secret_key, stripe_enabled")
      .eq("organization_id", orgId)
      .single();

    if (settingsError || !settings || !settings.stripe_secret_key || !settings.stripe_enabled) {
      return new Response(JSON.stringify({ error: "Stripe não está configurado ou ativo para esta organização." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = settings.stripe_secret_key;
    const amountInCents = Math.round(amount * 100);
    const firstProductName = produtos[0]?.name || "Pedido Scale";

    // 5. Chamar a API do Stripe via HTTP POST para criar Checkout Session
    const stripeParams = new URLSearchParams();
    stripeParams.append("mode", "payment");
    stripeParams.append("success_url", `${req.headers.get("origin") || "https://scale.glauberads.com.br"}/admin?status=success`);
    stripeParams.append("cancel_url", `${req.headers.get("origin") || "https://scale.glauberads.com.br"}/admin?status=cancel`);
    stripeParams.append("customer_email", customer_email);
    stripeParams.append("payment_method_types[0]", "card");
    stripeParams.append("line_items[0][price_data][currency]", "brl");
    stripeParams.append("line_items[0][price_data][product_data][name]", firstProductName);
    stripeParams.append("line_items[0][price_data][unit_amount]", String(amountInCents));
    stripeParams.append("line_items[0][quantity]", "1");
    stripeParams.append("metadata[organization_id]", orgId);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeParams.toString(),
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok || stripeData.error) {
      console.error("Erro na API do Stripe:", stripeData.error);
      return new Response(JSON.stringify({ error: stripeData.error?.message || "Erro ao conectar com a API do Stripe." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutSessionId = stripeData.id;
    const checkoutUrl = stripeData.url;

    // 6. Registrar a transação como pendente na base local
    const { data: transaction, error: txError } = await supabaseClient
      .from("transactions")
      .insert({
        organization_id: orgId,
        gateway: "stripe",
        external_id: checkoutSessionId,
        status: "pending",
        amount,
        customer_email,
        produtos_details: produtos,
        invoice_url: checkoutUrl,
      })
      .select()
      .single();

    if (txError) {
      console.error("Erro ao salvar transação Stripe:", txError);
      return new Response(JSON.stringify({ error: "Erro ao registrar transação no banco local." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transactionId: transaction.id,
      checkout_url: checkoutUrl,
      payment_id: checkoutSessionId,
      status: "pending",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erro interno na Deno Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno do servidor." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
