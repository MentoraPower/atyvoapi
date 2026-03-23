import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keep only the top N entries of a record by value
function top(obj: Record<string, number>, n = 5): Record<string, number> {
  return Object.fromEntries(
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pergunta, historico, dadosLeads } = await req.json();

    // Build compact context (limit each category to top 5 to save tokens)
    const lines: string[] = [];

    if (dadosLeads) {
      const taxa = dadosLeads.total > 0
        ? ((dadosLeads.compraram / dadosLeads.total) * 100).toFixed(1)
        : "0";

      lines.push(`Leads: ${dadosLeads.total} | Compraram: ${dadosLeads.compraram} (${taxa}%) | Formulário: ${dadosLeads.formName ?? "Todos"}`);

      if (dadosLeads.scores) {
        lines.push(`Score: Alto=${dadosLeads.scores.alto} Médio=${dadosLeads.scores.medio} Baixo=${dadosLeads.scores.baixo}`);
      }

      const fat = top(dadosLeads.faturamento ?? {});
      if (Object.keys(fat).length) lines.push(`Faturamento: ${Object.entries(fat).map(([k,v]) => `${k}(${v})`).join(", ")}`);

      const area = top(dadosLeads.area ?? {});
      if (Object.keys(area).length) lines.push(`Área: ${Object.entries(area).map(([k,v]) => `${k}(${v})`).join(", ")}`);

      const orig = top(dadosLeads.origem ?? {});
      if (Object.keys(orig).length) lines.push(`Origem: ${Object.entries(orig).map(([k,v]) => `${k}(${v})`).join(", ")}`);

      const prod = top(dadosLeads.produtos ?? {});
      if (Object.keys(prod).length) lines.push(`Compras: ${Object.entries(prod).map(([k,v]) => `${k}(${v})`).join(", ")}`);

      const ind = top(dadosLeads.indicacoesProduto ?? {});
      if (Object.keys(ind).length) lines.push(`IA indicou: ${Object.entries(ind).map(([k,v]) => `${k}(${v})`).join(", ")}`);
    }

    const context = lines.join("\n");

    const systemPrompt = `Analista de leads para negócios de beleza/estética no Brasil.
Produtos: Power Academy R$697 (baixo faturamento), SCALE R$2.900 (tráfego pago), Mentora Beauty R$7.000 (infoprodutos).
Responda em JSON: {"resposta":"texto pt-BR","kpis":[{"label":"","valor":"","descricao":""}],"graficos":[{"tipo":"bar"|"pie"|"area","titulo":"","dados":[{"name":"","valor":0}],"dataKey":"valor"}]}
Máx 3 KPIs, 2 gráficos, respostas diretas.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(historico ?? []).slice(-4).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content.slice(0, 300),
      })),
      {
        role: "user",
        content: `${context ? `Dados:\n${context}\n\n` : ""}${pergunta}`,
      },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 700,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      // Handle rate limit with friendly message
      if (response.status === 429) {
        const retryMatch = err.match(/try again in ([^.]+)/);
        const wait = retryMatch ? ` Tente novamente em ${retryMatch[1]}.` : "";
        return new Response(
          JSON.stringify({
            resposta: `Limite de requisições da IA atingido.${wait}`,
            kpis: [],
            graficos: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: { resposta?: string; kpis?: unknown[]; graficos?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { resposta: raw, kpis: [], graficos: [] };
    }

    return new Response(
      JSON.stringify({
        resposta: parsed.resposta ?? "Não foi possível gerar uma resposta.",
        kpis: parsed.kpis ?? [],
        graficos: parsed.graficos ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
