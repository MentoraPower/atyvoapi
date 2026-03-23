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

    const { lead, appearances } = await req.json();

    // Se não há dados suficientes para análise
    const hasRelevantData = lead.faturamento || lead.area_beleza ||
      (appearances && appearances.length > 1) ||
      lead.guru_purchased === true || lead.assiny_purchased === true ||
      lead.utm_campaign || lead.utm_source;

    if (!hasRelevantData) {
      return new Response(
        JSON.stringify({ analysis: "Não tenho informações suficientes para analisar este lead." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lines: string[] = [
      `Nome: ${lead.name || "Não informado"}`,
      `Email: ${lead.email || "Não informado"}`,
    ];
    if (lead.faturamento) lines.push(`Faturamento mensal: ${lead.faturamento}`);
    if (lead.area_beleza) lines.push(`Área de atuação: ${lead.area_beleza}`);
    if (appearances && appearances.length > 1) {
      lines.push(`Inscrito em ${appearances.length} funis/formulários diferentes`);
      const forms = appearances.map((a: { product: string | null }) => a.product).filter(Boolean);
      if (forms.length > 0) lines.push(`Formulários: ${[...new Set(forms)].join(", ")}`);
    }
    if (lead.utm_source) lines.push(`Origem de tráfego: ${lead.utm_source}`);
    if (lead.utm_campaign) lines.push(`Campanha: ${lead.utm_campaign}`);
    if (lead.guru_purchased === true) {
      lines.push(`Comprou via Guru${lead.guru_product_name ? ` (${lead.guru_product_name})` : ""}${lead.guru_amount ? ` — R$ ${lead.guru_amount}` : ""}`);
    }
    if (lead.assiny_purchased === true) {
      lines.push(`Comprou via Assiny${lead.assiny_product_name ? ` (${lead.assiny_product_name})` : ""}${lead.assiny_amount ? ` — R$ ${lead.assiny_amount}` : ""}`);
    }

    const context = lines.join("\n");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em qualificação de leads para negócios de beleza e estética no Brasil. Analise os dados do lead e forneça uma análise objetiva em 2-3 frases sobre o potencial e qualificação dele. Seja direto. Responda em português brasileiro.",
          },
          {
            role: "user",
            content: `Dados do lead:\n${context}\n\nFaça uma análise breve da qualificação deste lead.`,
          },
        ],
        max_tokens: 220,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
