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

    const body = await req.json();
    console.log(`[Webhook Pagar.me] Evento recebido: ${body.type} para org: ${orgId}`);

    const charge = body.data;
    if (!charge || !charge.id) {
      return new Response(JSON.stringify({ error: "Payload da cobrança inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const chargeId = charge.id;
    let localStatus = "pending";

    if (body.type === "charge.paid") {
      localStatus = "paid";
    } else if (body.type === "charge.payment_failed" || body.type === "charge.failed") {
      localStatus = "failed";
    } else if (body.type === "charge.refunded") {
      localStatus = "failed"; // ou cancelado/reembolsado
    }

    // Atualizar a transação correspondente no banco local
    const { data: updatedTx, error: updateError } = await supabaseClient
      .from("transactions")
      .update({
        status: localStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("gateway", "pagarme")
      .eq("external_id", chargeId)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar transação Pagar.me via webhook:", updateError);
      return new Response(JSON.stringify({ error: "Transação não encontrada ou erro de escrita." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Webhook Pagar.me] Transação atualizada para '${localStatus}'. ID: ${chargeId}`);
    return new Response(JSON.stringify({ success: true, received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erro interno no processamento do webhook da Pagar.me:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno do servidor." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
