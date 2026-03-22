import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GURU_BASE = "https://digitalmanager.guru/api/v2";

async function guruFetch(
  path: string,
  token: string,
): Promise<{ data: any; ok: boolean; status: number; errorBody?: string }> {
  try {
    const res = await fetch(`${GURU_BASE}${path}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      let errorBody = "";
      try { errorBody = await res.text(); } catch (_) {}
      return { data: null, ok: false, status: res.status, errorBody };
    }
    const data = await res.json();
    return { data, ok: true, status: res.status };
  } catch (e) {
    return { data: null, ok: false, status: 0, errorBody: String(e) };
  }
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Extrai valor e nome do produto de uma transação Guru
function extractTransactionDetails(tx: any): { amount: number | null; product_name: string | null } {
  // Valor: payment.gross é o valor total cobrado do cliente
  const amount = tx.payment?.gross ?? tx.payment?.total ?? tx.product?.total_value ?? tx.items?.[0]?.total_value ?? null;
  // Nome: product.name ou items[0].name
  const product_name = tx.product?.name ?? tx.items?.[0]?.name ?? null;
  return {
    amount: amount != null ? Number(amount) : null,
    product_name: product_name ? String(product_name) : null,
  };
}

// Busca o UUID do produto a partir do ID numérico
async function resolveProductUUID(
  productId: string,
  token: string,
  log: any[],
): Promise<string | null> {
  if (!productId) return null;
  if (isUUID(productId)) return productId;

  const { data, ok, status } = await guruFetch(`/products?page=1`, token);
  log.push({ step: "products_lookup", status, ok });
  if (!ok) return null;

  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const match = items.find(
    (p: any) =>
      String(p.id) === productId ||
      String(p.marketplace_id) === productId ||
      String(p.code) === productId ||
      String(p.external_id) === productId,
  );
  if (match && isUUID(String(match.id))) {
    log.push({ step: "product_uuid_found", uuid: match.id, name: match.name });
    return String(match.id);
  }
  log.push({ step: "product_uuid_not_found", searched: productId });
  return null;
}

// Busca contact_id filtrando localmente pelo email exato (API não filtra no server)
async function findContactIdByEmail(
  email: string,
  token: string,
  log: any[],
): Promise<{ contactId: string | null; apiReachable: boolean }> {
  for (let page = 1; page <= 10; page++) {
    const { data, ok, status } = await guruFetch(
      `/contacts?contact_email=${encodeURIComponent(email)}&page=${page}`,
      token,
    );
    if (page === 1) log.push({ step: "contacts_by_email", status, ok });
    if (!ok) return { contactId: null, apiReachable: false };

    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length === 0) break;

    const match = items.find((c) => c.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      log.push({ step: "contact_found", contactId: match.id, name: match.name });
      return { contactId: match.id, apiReachable: true };
    }
  }
  log.push({ step: "contact_not_found_by_email" });
  return { contactId: null, apiReachable: true };
}

interface TxResult {
  purchased: boolean;
  apiReachable: boolean;
  amount: number | null;
  product_name: string | null;
}

// Verifica transações por contact_id (sem filtro de data)
async function checkByContactId(
  contactId: string,
  productUUID: string | null,
  token: string,
  log: any[],
): Promise<TxResult> {
  const base = `contact_id=${contactId}&transaction_status[]=approved&page=1`;

  // Com product_id
  if (productUUID) {
    const { data, ok, status, errorBody } = await guruFetch(
      `/transactions?${base}&product_id=${productUUID}`,
      token,
    );
    log.push({ step: "tx_contact_with_product", status, ok, errorBody });
    if (ok) {
      const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (items.length > 0) {
        const { amount, product_name } = extractTransactionDetails(items[0]);
        return { purchased: true, apiReachable: true, amount, product_name };
      }
    }
  }

  // Sem product_id
  const { data, ok, status, errorBody } = await guruFetch(`/transactions?${base}`, token);
  log.push({ step: "tx_contact_no_product", status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
  if (ok) {
    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length > 0) {
      const { amount, product_name } = extractTransactionDetails(items[0]);
      return { purchased: true, apiReachable: true, amount, product_name };
    }
    return { purchased: false, apiReachable: true, amount: null, product_name: null };
  }
  return { purchased: false, apiReachable: false, amount: null, product_name: null };
}

// Busca transações por email em janelas de 180 dias
async function checkByEmail(
  email: string,
  productUUID: string | null,
  token: string,
  log: any[],
): Promise<TxResult> {
  const today = new Date();
  let anyReachable = false;

  for (let i = 0; i < 4; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 180);
    const start = new Date(end);
    start.setDate(start.getDate() - 179);

    const dateStr = `ordered_at_ini=${start.toISOString().slice(0, 10)}&ordered_at_end=${end.toISOString().slice(0, 10)}`;
    const base = `contact_email=${encodeURIComponent(email.trim())}&transaction_status[]=approved&${dateStr}&page=1`;

    // Com product_id
    if (productUUID) {
      const { data, ok, status, errorBody } = await guruFetch(
        `/transactions?${base}&product_id=${productUUID}`,
        token,
      );
      log.push({ step: `tx_email_w${i}_with_product`, status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
      if (ok) {
        anyReachable = true;
        const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
        if (items.length > 0) {
          const { amount, product_name } = extractTransactionDetails(items[0]);
          return { purchased: true, apiReachable: true, amount, product_name };
        }
      }
    }

    // Sem product_id
    const { data, ok, status, errorBody } = await guruFetch(`/transactions?${base}`, token);
    log.push({ step: `tx_email_w${i}_no_product`, status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
    if (ok) {
      anyReachable = true;
      const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (items.length > 0) {
        const { amount, product_name } = extractTransactionDetails(items[0]);
        return { purchased: true, apiReachable: true, amount, product_name };
      }
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

    const log: any[] = [];
    let purchased = false;
    let anyApiReachable = false;
    let amount: number | null = null;
    let product_name: string | null = null;

    // Resolve product UUID (API exige UUID, não ID numérico)
    const productUUID = await resolveProductUUID(product_id ?? "", api_token, log);

    // ── Estratégia 1: via email ─────────────────────────────────────────────
    if (email) {
      const { contactId, apiReachable: r1 } = await findContactIdByEmail(email, api_token, log);
      if (r1) anyApiReachable = true;

      if (contactId) {
        const res = await checkByContactId(contactId, productUUID, api_token, log);
        if (res.apiReachable) anyApiReachable = true;
        if (res.purchased) {
          purchased = true;
          amount = res.amount;
          product_name = res.product_name;
        }
      }

      if (!purchased) {
        const res = await checkByEmail(email, productUUID, api_token, log);
        if (res.apiReachable) anyApiReachable = true;
        if (res.purchased) {
          purchased = true;
          amount = res.amount;
          product_name = res.product_name;
        }
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
        const items: any[] = Array.isArray(cData) ? cData : (cData?.data ?? []);
        const match = items.find((c: any) => c.name?.toLowerCase() === name.toLowerCase());
        if (match) {
          log.push({ step: "contact_found_by_name", contactId: match.id });
          const res = await checkByContactId(match.id, productUUID, api_token, log);
          if (res.apiReachable) anyApiReachable = true;
          if (res.purchased) {
            purchased = true;
            amount = res.amount;
            product_name = res.product_name;
          }
        }
      }
    }

    if (!anyApiReachable) {
      return new Response(
        JSON.stringify({ purchased: null, reason: "guru_api_unreachable", log }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ purchased, amount, product_name, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
