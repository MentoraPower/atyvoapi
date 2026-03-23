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

    const purchasedProducts: string[] = [];
    if (lead.guru_purchased === true) {
      const label = lead.guru_product_name
        ? `${lead.guru_product_name}${lead.guru_amount ? ` (R$ ${lead.guru_amount})` : ""}`
        : `produto via Guru${lead.guru_amount ? ` (R$ ${lead.guru_amount})` : ""}`;
      purchasedProducts.push(label);
    }
    if (lead.assiny_purchased === true) {
      const label = lead.assiny_product_name
        ? `${lead.assiny_product_name}${lead.assiny_amount ? ` (R$ ${lead.assiny_amount})` : ""}`
        : `produto via Assiny${lead.assiny_amount ? ` (R$ ${lead.assiny_amount})` : ""}`;
      purchasedProducts.push(label);
    }
    if (purchasedProducts.length > 0) {
      lines.push(`Já comprou: ${purchasedProducts.join(", ")}`);
    }

    const context = lines.join("\n");

    const systemPrompt = `Você é um especialista em qualificação e vendas para negócios de beleza e estética no Brasil.

Nossos produtos disponíveis:
• Power Academy — R$ 697,00: Formação completa com módulos de conteúdo, posicionamento e branding para aumentar clientes e faturamento da clínica. Ideal para profissionais com baixo faturamento que precisam crescer e se posicionar.
• SCALE — R$ 2.900,00 (R$ 1.800 serviço + R$ 1.100 tráfego): Serviço de tráfego pago para escalar clínicas, aumentar demanda no WhatsApp e atrair mais clientes. Ideal para quem já tem estrutura e quer escalar volume de clientes com anúncios.
• Mentora Beauty — R$ 7.000,00: Mentoria premium individual para escalar venda de cursos, mentorias e palestras. Encontros individuais, em grupo, aulas gravadas e grupo exclusivo. Ideal para quem já fatura bem e quer criar e vender infoprodutos.

Com base nos dados do lead, responda EXATAMENTE neste formato (use **negrito** nos rótulos):

**Qualificação:** [avalie o potencial em 1-2 frases diretas]

**Produto indicado:** [nome do produto] — [motivo em 1 frase]

**Já cliente:** [se comprou algum produto nosso, mencione e sugira próximo passo. Se não comprou, escreva "Nenhuma compra registrada."]

Se os dados forem insuficientes (apenas nome e email), responda apenas: "Dados insuficientes para análise. Necessário faturamento ou área de atuação."
Seja direto e objetivo. Responda em português brasileiro.`;

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Dados do lead:\n${context}\n\nGere a análise.`,
          },
        ],
        max_tokens: 300,
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
