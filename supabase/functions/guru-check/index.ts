import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GURU_BASE = "https://digitalmanager.guru/api/v2";

async function guruFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`${GURU_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Busca contact_id pelo email no endpoint /contacts
async function findContactIdByEmail(email: string, token: string): Promise<string | null> {
  const data = await guruFetch(`/contacts?contact_email=${encodeURIComponent(email)}&page=1`, token);
  if (!data) return null;
  const items: any[] = Array.isArray(data) ? data : (data.data ?? []);
  return items.length > 0 ? (items[0].id ?? null) : null;
}

// Busca contact_id pelo nome
async function findContactIdByName(name: string, token: string): Promise<string | null> {
  const data = await guruFetch(`/contacts?contact_name=${encodeURIComponent(name)}&page=1`, token);
  if (!data) return null;
  const items: any[] = Array.isArray(data) ? data : (data.data ?? []);
  return items.length > 0 ? (items[0].id ?? null) : null;
}

// Verifica se contact_id tem transação aprovada do produto
async function hasPurchaseByContactId(contactId: string, productId: string, token: string): Promise<boolean> {
  const params = new URLSearchParams({
    contact_id: contactId,
    transaction_status: "approved",
    page: "1",
  });
  if (productId) params.set("product_id", productId);
  const data = await guruFetch(`/transactions?${params}`, token);
  if (!data) return false;
  const items: any[] = Array.isArray(data) ? data : (data.data ?? []);
  return items.length > 0;
}

// Busca direta por email nas transações com janela de 180 dias (fallback)
async function hasPurchaseByEmail(email: string, productId: string, token: string): Promise<boolean> {
  // Cobre os últimos 2 anos em chunks de 180 dias
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 180);
    const start = new Date(end);
    start.setDate(start.getDate() - 179);

    const params = new URLSearchParams({
      contact_email: email.trim(),
      transaction_status: "approved",
      ordered_at_ini: start.toISOString().slice(0, 10),
      ordered_at_end: end.toISOString().slice(0, 10),
      page: "1",
    });
    if (productId) params.set("product_id", productId);

    const data = await guruFetch(`/transactions?${params}`, token);
    if (!data) continue;
    const items: any[] = Array.isArray(data) ? data : (data.data ?? []);
    if (items.length > 0) return true;
  }
  return false;
}

// Busca direta por nome nas transações com janela de 180 dias (fallback)
async function hasPurchaseByName(name: string, productId: string, token: string): Promise<boolean> {
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 180);
    const start = new Date(end);
    start.setDate(start.getDate() - 179);

    const params = new URLSearchParams({
      contact_name: name.trim(),
      transaction_status: "approved",
      ordered_at_ini: start.toISOString().slice(0, 10),
      ordered_at_end: end.toISOString().slice(0, 10),
      page: "1",
    });
    if (productId) params.set("product_id", productId);

    const data = await guruFetch(`/transactions?${params}`, token);
    if (!data) continue;
    const items: any[] = Array.isArray(data) ? data : (data.data ?? []);
    if (items.length > 0) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, api_token, product_id } = await req.json();

    if (!api_token) {
      return new Response(JSON.stringify({ error: "api_token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let purchased = false;

    // Estratégia 1: buscar contact_id pelo email e verificar transações
    if (email) {
      const contactId = await findContactIdByEmail(email, api_token);
      if (contactId) {
        purchased = await hasPurchaseByContactId(contactId, product_id ?? "", api_token);
      }
      // Fallback direto por email nas transações
      if (!purchased) {
        purchased = await hasPurchaseByEmail(email, product_id ?? "", api_token);
      }
    }

    // Estratégia 2: por nome (se email não encontrou)
    if (!purchased && name) {
      const contactId = await findContactIdByName(name, api_token);
      if (contactId) {
        purchased = await hasPurchaseByContactId(contactId, product_id ?? "", api_token);
      }
      if (!purchased) {
        purchased = await hasPurchaseByName(name, product_id ?? "", api_token);
      }
    }

    return new Response(JSON.stringify({ purchased }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
