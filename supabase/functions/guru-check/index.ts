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

// Busca o UUID do produto a partir do ID numérico ou código
async function resolveProductUUID(
  productId: string,
  token: string,
  log: any[],
): Promise<string | null> {
  if (!productId) return null;
  if (isUUID(productId)) return productId;

  // Busca nos produtos pelo ID numérico
  const { data, ok, status } = await guruFetch(`/products?page=1`, token);
  log.push({ step: "products_lookup", status, ok });
  if (!ok) return null;

  const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  // Procura por ID que bata com o valor numérico
  const match = items.find(
    (p: any) =>
      String(p.id) === productId ||
      String(p.code) === productId ||
      String(p.external_id) === productId,
  );
  if (match) {
    log.push({ step: "product_uuid_found", uuid: match.id, name: match.name });
    return isUUID(String(match.id)) ? String(match.id) : null;
  }

  log.push({ step: "product_uuid_not_found", searched: productId, sample: items.slice(0, 2).map((p: any) => ({ id: p.id, name: p.name })) });
  return null;
}

// Busca contact_id filtrando localmente pelo email exato (API ignora o filtro)
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
    log.push({ step: `contacts_email_p${page}`, status, ok });
    if (!ok) return { contactId: null, apiReachable: false };

    const items: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    if (items.length === 0) break;

    const match = items.find((c) => c.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      log.push({ step: "contact_found_by_email", contactId: match.id, name: match.name });
      return { contactId: match.id, apiReachable: true };
    }
  }
  log.push({ step: "contact_not_found_by_email" });
  return { contactId: null, apiReachable: true };
}

// Verifica transações por contact_id
// IMPORTANTE: transaction_status deve ser array na query string → "transaction_status[]=approved"
async function hasPurchaseByContactId(
  contactId: string,
  productUUID: string | null,
  token: string,
  log: any[],
): Promise<{ purchased: boolean; apiReachable: boolean }> {
  const baseParams = `contact_id=${contactId}&transaction_status[]=approved&page=1`;

  // Com product_id UUID
  if (productUUID) {
    const path = `/transactions?${baseParams}&product_id=${productUUID}`;
    const { data, ok, status, errorBody } = await guruFetch(path, token);
    log.push({ step: "tx_contact_with_product", status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
    if (ok) {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      if (items.length > 0) return { purchased: true, apiReachable: true };
    }
  }

  // Sem product_id
  const { data, ok, status, errorBody } = await guruFetch(`/transactions?${baseParams}`, token);
  log.push({ step: "tx_contact_no_product", status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
  if (ok) {
    const items = Array.isArray(data) ? data : (data?.data ?? []);
    return { purchased: items.length > 0, apiReachable: true };
  }
  return { purchased: false, apiReachable: false };
}

// Busca transações por email em janelas de 180 dias
async function hasPurchaseByEmail(
  email: string,
  productUUID: string | null,
  token: string,
  log: any[],
): Promise<{ purchased: boolean; apiReachable: boolean }> {
  const today = new Date();
  let anyReachable = false;

  for (let i = 0; i < 4; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 180);
    const start = new Date(end);
    start.setDate(start.getDate() - 179);

    const dateStr = `ordered_at_ini=${start.toISOString().slice(0, 10)}&ordered_at_end=${end.toISOString().slice(0, 10)}`;
    const baseParams = `contact_email=${encodeURIComponent(email.trim())}&transaction_status[]=approved&${dateStr}&page=1`;

    // Com product_id
    if (productUUID) {
      const { data, ok, status, errorBody } = await guruFetch(
        `/transactions?${baseParams}&product_id=${productUUID}`,
        token,
      );
      log.push({ step: `tx_email_w${i}_with_product`, status, ok, errorBody, count: ok ? (Array.isArray(data) ? data : (data?.data ?? [])).length : null });
      if (ok) {
        anyReachable = true;
        const items = Array.isArray(data) ? data : (data?.data ?? []);
        if (items.length > 0) return { purchased: true, apiReachable: true };
      }
    }

    // Sem product_id
    const { data: d2, ok: ok2, status: s2, errorBody: e2 } = await guruFetch(
      `/transactions?${baseParams}`,
      token,
    );
    log.push({ step: `tx_email_w${i}_no_product`, status: s2, ok: ok2, errorBody: e2, count: ok2 ? (Array.isArray(d2) ? d2 : (d2?.data ?? [])).length : null });
    if (ok2) {
      anyReachable = true;
      const items = Array.isArray(d2) ? d2 : (d2?.data ?? []);
      if (items.length > 0) return { purchased: true, apiReachable: true };
    }
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

    const log: any[] = [];
    let purchased = false;
    let anyApiReachable = false;

    // Resolve product UUID (API exige UUID, não ID numérico)
    const productUUID = await resolveProductUUID(product_id ?? "", api_token, log);
    log.push({ step: "product_uuid_resolved", input: product_id, uuid: productUUID });

    // ── Estratégia 1: via email ─────────────────────────────────────────────
    if (email) {
      const { contactId, apiReachable: r1 } = await findContactIdByEmail(email, api_token, log);
      if (r1) anyApiReachable = true;

      if (contactId) {
        const { purchased: p, apiReachable: r2 } = await hasPurchaseByContactId(
          contactId, productUUID, api_token, log,
        );
        if (r2) anyApiReachable = true;
        if (p) purchased = true;
      }

      if (!purchased) {
        const { purchased: p, apiReachable: r3 } = await hasPurchaseByEmail(
          email, productUUID, api_token, log,
        );
        if (r3) anyApiReachable = true;
        if (p) purchased = true;
      }
    }

    // ── Estratégia 2: via nome ──────────────────────────────────────────────
    if (!purchased && name) {
      // Busca contact_id pelo nome (sem paginação extensiva)
      const { data: cData, ok: cOk, status: cStatus } = await guruFetch(
        `/contacts?contact_name=${encodeURIComponent(name.trim())}&page=1`,
        token,
      );
      if (cOk) {
        anyApiReachable = true;
        const items: any[] = Array.isArray(cData) ? cData : (cData?.data ?? []);
        const match = items.find((c: any) => c.name?.toLowerCase() === name.toLowerCase());
        if (match) {
          log.push({ step: "contact_found_by_name", contactId: match.id });
          const { purchased: p, apiReachable: r5 } = await hasPurchaseByContactId(
            match.id, productUUID, api_token, log,
          );
          if (r5) anyApiReachable = true;
          if (p) purchased = true;
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
      JSON.stringify({ purchased, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
