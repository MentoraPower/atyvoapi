import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GURU_BASE = "https://digitalmanager.guru/api/v2";

// Returns { data, ok } — ok=false means API unreachable (non-2xx)
async function guruFetch(path: string, token: string): Promise<{ data: any; ok: boolean }> {
  try {
    const res = await fetch(`${GURU_BASE}${path}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { data: null, ok: false };
    const data = await res.json();
    return { data, ok: true };
  } catch {
    return { data: null, ok: false };
  }
}

// Busca contact_id pelo email
async function findContactIdByEmail(
  email: string,
  token: string,
): Promise<{ contactId: string | null; apiReachable: boolean }> {
  const { data, ok } = await guruFetch(
    `/contacts?contact_email=${encodeURIComponent(email)}&page=1`,
    token,
  );
  if (!ok) return { contactId: null, apiReachable: false };
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { contactId: items.length > 0 ? (items[0].id ?? null) : null, apiReachable: true };
}

// Busca contact_id pelo nome
async function findContactIdByName(
  name: string,
  token: string,
): Promise<{ contactId: string | null; apiReachable: boolean }> {
  const { data, ok } = await guruFetch(
    `/contacts?contact_name=${encodeURIComponent(name)}&page=1`,
    token,
  );
  if (!ok) return { contactId: null, apiReachable: false };
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { contactId: items.length > 0 ? (items[0].id ?? null) : null, apiReachable: true };
}

// Verifica transações aprovadas por contact_id (sem filtro de data)
async function hasPurchaseByContactId(
  contactId: string,
  productId: string,
  token: string,
): Promise<{ purchased: boolean; apiReachable: boolean }> {
  const params = new URLSearchParams({
    contact_id: contactId,
    transaction_status: "approved",
    page: "1",
  });
  if (productId) params.set("product_id", productId);
  const { data, ok } = await guruFetch(`/transactions?${params}`, token);
  if (!ok) return { purchased: false, apiReachable: false };
  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { purchased: items.length > 0, apiReachable: true };
}

// Busca por email em janelas de 180 dias
async function hasPurchaseByEmail(
  email: string,
  productId: string,
  token: string,
): Promise<{ purchased: boolean; apiReachable: boolean }> {
  const today = new Date();
  let anyReachable = false;

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

    const { data, ok } = await guruFetch(`/transactions?${params}`, token);
    if (!ok) continue;
    anyReachable = true;
    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) return { purchased: true, apiReachable: true };
  }

  return { purchased: false, apiReachable: anyReachable };
}

// Busca por nome em janelas de 180 dias
async function hasPurchaseByName(
  name: string,
  productId: string,
  token: string,
): Promise<{ purchased: boolean; apiReachable: boolean }> {
  const today = new Date();
  let anyReachable = false;

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

    const { data, ok } = await guruFetch(`/transactions?${params}`, token);
    if (!ok) continue;
    anyReachable = true;
    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) return { purchased: true, apiReachable: true };
  }

  return { purchased: false, apiReachable: anyReachable };
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
    let anyApiReachable = false;

    // Estratégia 1: contact_id via email → transações
    if (email) {
      const { contactId, apiReachable: r1 } = await findContactIdByEmail(email, api_token);
      if (r1) anyApiReachable = true;

      if (contactId) {
        const { purchased: p, apiReachable: r2 } = await hasPurchaseByContactId(
          contactId,
          product_id ?? "",
          api_token,
        );
        if (r2) anyApiReachable = true;
        if (p) purchased = true;
      }

      // Fallback: busca direta por email com janela de datas
      if (!purchased) {
        const { purchased: p, apiReachable: r3 } = await hasPurchaseByEmail(
          email,
          product_id ?? "",
          api_token,
        );
        if (r3) anyApiReachable = true;
        if (p) purchased = true;
      }
    }

    // Estratégia 2: contact_id via nome → transações
    if (!purchased && name) {
      const { contactId, apiReachable: r4 } = await findContactIdByName(name, api_token);
      if (r4) anyApiReachable = true;

      if (contactId) {
        const { purchased: p, apiReachable: r5 } = await hasPurchaseByContactId(
          contactId,
          product_id ?? "",
          api_token,
        );
        if (r5) anyApiReachable = true;
        if (p) purchased = true;
      }

      if (!purchased) {
        const { purchased: p, apiReachable: r6 } = await hasPurchaseByName(
          name,
          product_id ?? "",
          api_token,
        );
        if (r6) anyApiReachable = true;
        if (p) purchased = true;
      }
    }

    // Se nenhuma chamada à API da Guru teve sucesso, retorna null
    // para que o Dashboard não salve um resultado incorreto
    if (!anyApiReachable) {
      return new Response(JSON.stringify({ purchased: null, reason: "guru_api_unreachable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
