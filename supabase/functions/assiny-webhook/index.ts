import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

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

    if (debugMode) {
      return new Response(JSON.stringify({ received: body }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 0. Limpa webhooks com mais de 5 minutos (auto-limpeza sem cron)
    await supabase
      .from("assiny_webhooks")
      .delete()
      .lt("received_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // 1. Salva o webhook na fila — dados ficam no banco por até 5 minutos
    const { data: queued, error: qErr } = await supabase
      .from("assiny_webhooks")
      .insert({ integration_id: integrationId, payload: body })
      .select("id")
      .single();

    if (qErr || !queued) {
      // Mesmo se falhar ao salvar, tenta processar para não perder o evento
      console.error("Failed to queue webhook:", qErr?.message);
    }

    const webhookQueueId: string | null = queued?.id ?? null;

    // 2. Extrai dados do payload
    const event: string = body.event ?? "";
    const transaction = body.data?.transaction ?? {};
    const client = body.data?.client ?? {};
    const offer = body.data?.offer ?? {};
    const txStatus: string = transaction.status ?? "";

    if (!isApproved(event, txStatus)) {
      return new Response(
        JSON.stringify({ received: true, queued: !!webhookQueueId, skipped: true, event, status: txStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientEmail = (client.email ?? "").trim().toLowerCase();
    const clientPhone = normalizePhone(client.phone ?? "");
    const clientName = (client.full_name ?? client.name ?? "").trim().toLowerCase();
    const rawAmount = offer.amount ?? offer.client_amount ?? transaction.amount ?? null;
    const amount: number | null = rawAmount != null ? Number(rawAmount) / 100 : null;
    const productName: string | null = offer.product?.name ?? offer.name ?? null;

    if (!clientEmail && !clientPhone && !clientName) {
      return new Response(JSON.stringify({ error: "no client data to match", queued: !!webhookQueueId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verifica a integração
    const { data: integration } = await supabase
      .from("assiny_integrations")
      .select("user_id, form_id, active")
      .eq("id", integrationId)
      .single();

    if (!integration?.active) {
      return new Response(
        JSON.stringify({ received: true, queued: !!webhookQueueId, skipped: true, reason: "integration inactive or not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Busca leads e bate por email, telefone ou nome
    let query = supabase
      .from("form_submissions")
      .select("id, email, phone, name")
      .eq("owner_id", integration.user_id);

    if (integration.form_id) query = query.eq("form_id", integration.form_id);

    const { data: leads } = await query;

    const matches = (leads ?? []).filter((lead) => {
      if (clientEmail && lead.email?.trim().toLowerCase() === clientEmail) return true;
      if (clientPhone && normalizePhone(lead.phone ?? "") === clientPhone) return true;
      if (clientName && lead.name?.trim().toLowerCase() === clientName) return true;
      return false;
    });

    const matched = matches.length > 0;
    const ids = matches.map((m) => m.id);

    // 5. Atualiza leads encontrados
    if (matched) {
      await supabase
        .from("form_submissions")
        .update({
          assiny_purchased: true,
          assiny_checked_at: new Date().toISOString(),
          assiny_amount: amount,
          assiny_product_name: productName,
        })
        .in("id", ids);
    }

    // 6. Marca o webhook como processado (será deletado pelo cron em até 5 min)
    if (webhookQueueId) {
      await supabase
        .from("assiny_webhooks")
        .update({ matched, matched_ids: ids.length > 0 ? ids : null })
        .eq("id", webhookQueueId);
    }

    return new Response(
      JSON.stringify({ received: true, queued: !!webhookQueueId, matched: ids.length, ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
