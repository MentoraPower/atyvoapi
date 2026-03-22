import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GURU_BASE = "https://digitalmanager.guru/api/v2";

async function guruFetch(
  path: string,
  token: string,
): Promise<{ data: any; ok: boolean; status: number }> {
  try {
    const res = await fetch(`${GURU_BASE}${path}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { data: null, ok: false, status: res.status };
    return { data: await res.json(), ok: true, status: res.status };
  } catch {
    return { data: null, ok: false, status: 0 };
  }
}

// Verifica se uma transação pertence ao produto configurado.
// Compara o productId do usuário com os IDs do produto na transação
// (id numérico / marketplace_id / internal UUID).
// Se productId estiver vazio, qualquer transação aprovada conta.
function txMatchesProduct(tx: any, productId: string): boolean {
  if (!productId) return true;
  const pid = String(productId).trim();

  const check = (v: any) => v != null && String(v) === pid;

  // Campos do objeto product
  if (check(tx.product?.id)) return true;
  if (check(tx.product?.marketplace_id)) return true;
  if (check(tx.product?.internal_id)) return true;

  // Campos dos items
  const items: any[] = tx.items ?? [];
  for (const item of items) {
    if (check(item.id)) return true;
    if (check(item.marketplace_id)) return true;
    if (check(item.internal_id)) return true;
  }

  return false;
}

// Extrai valor e nome do produto de uma transação Guru
function extractDetails(tx: any): { amount: number | null; product_name: string | null } {
  const amount = tx.payment?.gross ?? tx.payment?.total ?? tx.product?.total_value ?? tx.items?.[0]?.total_value ?? null;
  const product_name = tx.product?.name ?? tx.items?.[0]?.name ?? null;
  return {
    amount: amount != null ? Number(amount) : null,
    product_name: product_name ? String(product_name) : null,
  };
}

// Busca contact_id paginando e filtrando localmente pelo email exato
async function findContactIdByEmail(
  email: string,
  token: string,
): Promise<{ contactId: string | null; apiReachable: boolean }> {
  for (let page = 1; page <= 10; page++) {
    const { data, ok } = await guruFetch(
      `/contacts?contact_email=${encodeURIComponent(email)}&page=${page}`,
      token,
    );
    if (!ok) return { contactId: null, apiReachable: false };

    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length === 0) break;

    const match = items.find((c) => c.email?.toLowerCase() === email.toLowerCase());
    if (match) return { contactId: match.id, apiReachable: true };
  }
  return { contactId: null, apiReachable: true };
}

interface TxResult {
  purchased: boolean;
  apiReachable: boolean;
  amount: number | null;
  product_name: string | null;
}

// Busca transações por contact_id (sem filtro de data) e filtra localmente por produto
async function checkByContactId(
  contactId: string,
  productId: string,
  token: string,
): Promise<TxResult> {
  const { data, ok } = await guruFetch(
    `/transactions?contact_id=${contactId}&transaction_status[]=approved&page=1`,
    token,
  );
  if (!ok) return { purchased: false, apiReachable: false, amount: null, product_name: null };

  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const match = items.find((tx) => txMatchesProduct(tx, productId));
  if (match) {
    const { amount, product_name } = extractDetails(match);
    return { purchased: true, apiReachable: true, amount, product_name };
  }
  return { purchased: false, apiReachable: true, amount: null, product_name: null };
}

// Busca transações por email em janelas de 180 dias e filtra localmente por produto
async function checkByEmail(
  email: string,
  productId: string,
  token: string,
): Promise<TxResult> {
  const today = new Date();
  let anyReachable = false;

  for (let i = 0; i < 4; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 180);
    const start = new Date(end);
    start.setDate(start.getDate() - 179);

    const path =
      `/transactions?contact_email=${encodeURIComponent(email.trim())}` +
      `&transaction_status[]=approved` +
      `&ordered_at_ini=${start.toISOString().slice(0, 10)}` +
      `&ordered_at_end=${end.toISOString().slice(0, 10)}` +
      `&page=1`;

    const { data, ok } = await guruFetch(path, token);
    if (!ok) continue;
    anyReachable = true;

    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    const match = items.find((tx) => txMatchesProduct(tx, productId));
    if (match) {
      const { amount, product_name } = extractDetails(match);
      return { purchased: true, apiReachable: true, amount, product_name };
    }
  }

  return { purchased: false, apiReachable: anyReachable, amount: null, product_name: null };
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

    const pid = (product_id ?? "").trim();
    let purchased = false;
    let anyApiReachable = false;
    let amount: number | null = null;
    let product_name: string | null = null;

    // ── Estratégia 1: via email ─────────────────────────────────────────────
    if (email) {
      const { contactId, apiReachable: r1 } = await findContactIdByEmail(email, api_token);
      if (r1) anyApiReachable = true;

      if (contactId) {
        const res = await checkByContactId(contactId, pid, api_token);
        if (res.apiReachable) anyApiReachable = true;
        if (res.purchased) { purchased = true; amount = res.amount; product_name = res.product_name; }
      }

      if (!purchased) {
        const res = await checkByEmail(email, pid, api_token);
        if (res.apiReachable) anyApiReachable = true;
        if (res.purchased) { purchased = true; amount = res.amount; product_name = res.product_name; }
      }
    }

    // ── Estratégia 2: via nome ──────────────────────────────────────────────
    if (!purchased && name) {
      const { data: cData, ok: cOk } = await guruFetch(
        `/contacts?contact_name=${encodeURIComponent(name.trim())}&page=1`,
        api_token,
      );
      if (cOk) {
        anyApiReachable = true;
        const contacts: any[] = Array.isArray(cData) ? cData : (cData?.data ?? []);
        const match = contacts.find((c: any) => c.name?.toLowerCase() === name.toLowerCase());
        if (match) {
          const res = await checkByContactId(match.id, pid, api_token);
          if (res.apiReachable) anyApiReachable = true;
          if (res.purchased) { purchased = true; amount = res.amount; product_name = res.product_name; }
        }
      }
    }

    if (!anyApiReachable) {
      return new Response(
        JSON.stringify({ purchased: null, reason: "guru_api_unreachable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ purchased, amount, product_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
