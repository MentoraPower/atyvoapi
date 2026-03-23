import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normaliza telefone: remove tudo que não for dígito
function normalizePhone(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

// Status de transação aprovada na Assiny
function isApproved(status: string): boolean {
  return ["approved", "paid", "APPROVED", "PAID"].includes(status ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ?id=<assiny_integration_id>
    const url = new URL(req.url);
    const integrationId = url.searchParams.get("id");

    if (!integrationId) {
      return new Response(JSON.stringify({ error: "integration id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Extrai dados do payload Assiny
    const event: string = body.event ?? "";
    const transaction = body.data?.transaction ?? {};
    const client = body.data?.client ?? {};
    const offer = body.data?.offer ?? {};

    // Só processa eventos de compra aprovada
    if (!isApproved(transaction.status)) {
      return new Response(JSON.stringify({ received: true, skipped: true, status: transaction.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmail: string = (client.email ?? "").trim().toLowerCase();
    const clientPhone: string = normalizePhone(client.phone ?? "");
    const clientName: string = (client.full_name ?? "").trim().toLowerCase();
    const amount: number | null = offer.amount != null ? Number(offer.amount) / 100 : null; // Assiny envia em centavos
    const productName: string | null = offer.name ?? null;

    if (!clientEmail && !clientPhone && !clientName) {
      return new Response(JSON.stringify({ error: "no client data to match" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase service role (bypassa RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca a integração para obter user_id e form_id
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
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "integration inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca leads do dono filtrados por form_id se configurado
    let query = supabase
      .from("form_submissions")
      .select("id, email, phone, name")
      .eq("owner_id", integration.user_id);

    if (integration.form_id) {
      query = query.eq("form_id", integration.form_id);
    }

    const { data: leads } = await query;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ received: true, matched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encontra leads que batem por email, telefone ou nome
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

    // Atualiza todos os leads encontrados como compra aprovada
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
