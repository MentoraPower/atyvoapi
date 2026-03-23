import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Build context from aggregated lead data
    const lines: string[] = [];

    if (dadosLeads) {
      lines.push(`=== DADOS DOS LEADS ===`);
      lines.push(`Total de leads: ${dadosLeads.total ?? 0}`);
      lines.push(`Formulário/pasta: ${dadosLeads.formName ?? "Todos"}`);

      if (dadosLeads.compraram > 0 || dadosLeads.total > 0) {
        const taxa = dadosLeads.total > 0
          ? ((dadosLeads.compraram / dadosLeads.total) * 100).toFixed(1)
          : "0";
        lines.push(`Leads que compraram: ${dadosLeads.compraram} (${taxa}%)`);
      }

      if (dadosLeads.faturamento && Object.keys(dadosLeads.faturamento).length > 0) {
        lines.push(`\nDistribuição por faturamento:`);
        for (const [k, v] of Object.entries(dadosLeads.faturamento as Record<string, number>)) {
          lines.push(`  ${k}: ${v} leads`);
        }
      }

      if (dadosLeads.area && Object.keys(dadosLeads.area).length > 0) {
        lines.push(`\nDistribuição por área:`);
        for (const [k, v] of Object.entries(dadosLeads.area as Record<string, number>)) {
          lines.push(`  ${k}: ${v} leads`);
        }
      }

      if (dadosLeads.origem && Object.keys(dadosLeads.origem).length > 0) {
        lines.push(`\nOrigem de tráfego (utm_source):`);
        for (const [k, v] of Object.entries(dadosLeads.origem as Record<string, number>)) {
          lines.push(`  ${k}: ${v} leads`);
        }
      }

      if (dadosLeads.produtos && Object.keys(dadosLeads.produtos).length > 0) {
        lines.push(`\nProdutos já comprados:`);
        for (const [k, v] of Object.entries(dadosLeads.produtos as Record<string, number>)) {
          lines.push(`  ${k}: ${v} compras`);
        }
      }

      if (dadosLeads.scores) {
        lines.push(`\nDistribuição de lead score:`);
        lines.push(`  Alto (8-10): ${dadosLeads.scores.alto ?? 0}`);
        lines.push(`  Médio (5-7): ${dadosLeads.scores.medio ?? 0}`);
        lines.push(`  Baixo (0-4): ${dadosLeads.scores.baixo ?? 0}`);
      }

      if (dadosLeads.indicacoesProduto && Object.keys(dadosLeads.indicacoesProduto).length > 0) {
        lines.push(`\nProdutos indicados pela IA:`);
        for (const [k, v] of Object.entries(dadosLeads.indicacoesProduto as Record<string, number>)) {
          lines.push(`  ${k}: ${v} leads`);
        }
      }
    }

    const context = lines.join("\n");

    const systemPrompt = `Você é um analista de dados especializado em negócios de beleza e estética no Brasil.
Você tem acesso a dados agregados de leads de uma plataforma de captação.

Nossos produtos:
• Power Academy — R$ 697: Formação completa para profissionais com baixo faturamento que precisam crescer.
• SCALE — R$ 2.900 (R$ 1.800 serviço + R$ 1.100 tráfego): Serviço de tráfego pago para escalar clínicas.
• Mentora Beauty — R$ 7.000: Mentoria premium individual para escalar venda de cursos e infoprodutos.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "resposta": "texto explicativo em português brasileiro, pode usar markdown",
  "kpis": [
    { "label": "Nome do KPI", "valor": "valor como string", "descricao": "contexto curto" }
  ],
  "graficos": [
    {
      "tipo": "bar" | "pie" | "area",
      "titulo": "Título do gráfico",
      "dados": [{ "name": "Categoria", "valor": 123 }],
      "dataKey": "valor"
    }
  ]
}

Regras:
- Inclua 2 a 5 KPIs relevantes baseados na pergunta
- Inclua 1 a 3 gráficos que melhor visualizem a resposta
- Para gráficos de pizza (pie), use no máximo 6 fatias
- Para gráficos de barra (bar), use no máximo 10 barras
- Se a pergunta não tem dados suficientes, retorne kpis e graficos como arrays vazios
- Seja direto e objetivo na resposta`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(historico ?? []).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
      {
        role: "user",
        content: `${context ? `Dados disponíveis:\n${context}\n\n` : ""}Pergunta: ${pergunta}`,
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
        max_tokens: 1500,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
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
