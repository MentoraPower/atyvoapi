import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

// Eventos de compra aprovada confirmados pela Assiny
const APPROVED_EVENTS = new Set([
  "approved_purchase",
  "transaction_approved",
  "purchase_approved",
  "order_completed",
  "sale_approved",
]);

function isApproved(event: string, status: string): boolean {
  const e = (event ?? "").toLowerCase();
  const s = (status ?? "").toLowerCase();
  return (
    APPROVED_EVENTS.has(e) ||
    s === "approved" || s === "paid" || s === "complete" || s === "completed"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const integrationId = url.searchParams.get("id");
    const debugMode = url.searchParams.get("debug") === "1";

    if (!integrationId) {
      return new Response(JSON.stringify({ error: "integration id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Modo debug: retorna o payload completo recebido sem processar
    if (debugMode) {
      return new Response(JSON.stringify({ received: body }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: string = body.event ?? "";
    const transaction = body.data?.transaction ?? {};
    const client = body.data?.client ?? {};
    const offer = body.data?.offer ?? {};

    const txStatus: string = transaction.status ?? transaction.payment_status ?? "";

    if (!isApproved(event, txStatus)) {
      return new Response(
        JSON.stringify({ received: true, skipped: true, event, status: txStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientEmail = (client.email ?? "").trim().toLowerCase();
    const clientPhone = normalizePhone(client.phone ?? "");
    const clientName = (client.full_name ?? client.name ?? "").trim().toLowerCase();
    // Assiny envia amount em centavos
    const rawAmount = offer.amount ?? offer.client_amount ?? transaction.amount ?? null;
    const amount: number | null = rawAmount != null ? Number(rawAmount) / 100 : null;
    // offer.product.name = nome do produto; offer.name = nome da oferta ("Entrada", etc)
    const productName: string | null = offer.product?.name ?? offer.name ?? null;

    if (!clientEmail && !clientPhone && !clientName) {
      return new Response(JSON.stringify({ error: "no client data to match" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integration, error: intErr } = await supabase
      .from("assiny_integrations")
      .select("user_id, form_id, active")
      .eq("id", integrationId)
      .single();

    if (intErr || !integration) {
      return new Response(JSON.stringify({ error: "integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!integration.active) {
      return new Response(
        JSON.stringify({ received: true, skipped: true, reason: "integration inactive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("form_submissions")
      .select("id, email, phone, name")
      .eq("owner_id", integration.user_id);

    if (integration.form_id) query = query.eq("form_id", integration.form_id);

    const { data: leads } = await query;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ received: true, matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matches = leads.filter((lead) => {
      if (clientEmail && lead.email?.trim().toLowerCase() === clientEmail) return true;
      if (clientPhone && normalizePhone(lead.phone ?? "") === clientPhone) return true;
      if (clientName && lead.name?.trim().toLowerCase() === clientName) return true;
      return false;
    });

    if (matches.length === 0) {
      return new Response(JSON.stringify({ received: true, matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = matches.map((m) => m.id);
    await supabase
      .from("form_submissions")
      .update({
        assiny_purchased: true,
        assiny_checked_at: new Date().toISOString(),
        assiny_amount: amount,
        assiny_product_name: productName,
      })
      .in("id", ids);

    return new Response(
      JSON.stringify({ received: true, matched: ids.length, ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
