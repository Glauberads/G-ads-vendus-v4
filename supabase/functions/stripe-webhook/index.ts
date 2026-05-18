import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função nativa Web Crypto para validar assinaturas do webhook da Stripe de forma segura
async function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string): Promise<boolean> {
  try {
    const parts = signatureHeader.split(",");
    const tPart = parts.find(p => p.startsWith("t="));
    const v1Part = parts.find(p => p.startsWith("v1="));
    if (!tPart || !v1Part) return false;

    const timestamp = tPart.split("=")[1];
    const stripeSig = v1Part.split("=")[1];

    const signedPayload = `${timestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload)
    );
    const sigArray = Array.from(new Uint8Array(sigBuffer));
    const generatedSigHex = sigArray.map(b => b.toString(16).padStart(2, "0")).join("");

    return generatedSigHex === stripeSig;
  } catch (e) {
    console.error("Erro interno ao validar assinatura Stripe:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supaUrl, supaKey, {
      auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const orgId = url.searchParams.get("org");

    if (!orgId) {
      return new Response(JSON.stringify({ error: "Parâmetro 'org' ausente no webhook." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Ler credenciais confidenciais do tenant
    const { data: settings, error: settingsError } = await supabaseClient
      .from("payment_settings")
      .select("stripe_webhook_secret")
      .eq("organization_id", orgId)
      .single();

    if (settingsError || !settings || !settings.stripe_webhook_secret) {
      return new Response(JSON.stringify({ error: "Assinatura do webhook Stripe não configurada para esta organização." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stripeWebhookSecret = settings.stripe_webhook_secret;

    // 2. Extrair corpo cru (raw body) e assinatura da Stripe
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature");

    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: "Assinatura stripe-signature ausente nos cabeçalhos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Validar criptograficamente a assinatura da Stripe
    const isSignatureValid = await verifyStripeSignature(rawBody, signatureHeader, stripeWebhookSecret);

    if (!isSignatureValid) {
      console.warn(`[Webhook Stripe] Assinatura inválida recebida para a organização: ${orgId}`);
      return new Response(JSON.stringify({ error: "Assinatura do webhook inválida." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Processar o payload
    const event = JSON.parse(rawBody);
    console.log(`[Webhook Stripe] Evento recebido: ${event.type} para org: ${orgId}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutSessionId = session.id;

      // Atualizar a transação local correspondente para pago
      const { data, error } = await supabaseClient
        .from("transactions")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("gateway", "stripe")
        .eq("external_id", checkoutSessionId);

      if (error) {
        console.error("Erro ao atualizar status do Pix/Checkout:", error);
        return new Response(JSON.stringify({ error: "Erro ao salvar atualização no banco local." }), { status: 500 });
      }

      console.log(`[Webhook Stripe] Checkout finalizado com sucesso. ID: ${checkoutSessionId}`);
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      // Tenta atualizar caso tenhamos salvo a transação pelo ID do Intent
      const { error } = await supabaseClient
        .from("transactions")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("gateway", "stripe")
        .eq("external_id", paymentIntentId);

      if (error) {
        console.error("Erro ao atualizar pelo ID do Intent:", error);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const { error } = await supabaseClient
        .from("transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("gateway", "stripe")
        .eq("external_id", paymentIntentId);

      if (error) {
        console.error("Erro ao marcar falha do Intent:", error);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erro interno no processamento do webhook da Stripe:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno do servidor." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
