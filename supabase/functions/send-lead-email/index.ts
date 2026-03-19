import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EBOOK_URL = "https://30d.vercel.app/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu Ebook chegou!</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f5f5f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
    .outer { background: #f5f5f5; padding: 40px 16px; }
    .card { background: #ffffff; border-radius: 16px; max-width: 540px; margin: 0 auto; overflow: hidden; }
    .header { padding: 48px 48px 36px; border-bottom: 1px solid #f0f0f0; }
    .brand { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; color: #9ca3af; text-transform: uppercase; margin-bottom: 28px; }
    .greeting { font-size: 26px; font-weight: 700; color: #111111; line-height: 1.3; margin-bottom: 12px; }
    .subtitle { font-size: 15px; color: #6b7280; line-height: 1.6; }
    .body { padding: 36px 48px; }
    .msg { font-size: 15px; color: #374151; line-height: 1.7; margin-bottom: 32px; }
    .cta-wrap { text-align: center; margin-bottom: 36px; }
    .cta { display: inline-block; background: #111111; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 16px 40px; border-radius: 100px; letter-spacing: 0.01em; }
    .divider { height: 1px; background: #f0f0f0; margin: 0 48px; }
    .footer { padding: 28px 48px; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    @media (max-width: 600px) {
      .header, .body, .footer { padding-left: 28px; padding-right: 28px; }
      .divider { margin: 0 28px; }
      .greeting { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="outer">
    <div class="card">
      <div class="header">

        <h1 class="greeting">Olá, ${firstName}!<br />Seu ebook está aqui.</h1>
        <p class="subtitle">O seu próximo nível começa agora.</p>
      </div>
      <div class="body">
        <p class="msg">
          Você solicitou acesso ao <strong>Ebook 30 Dias</strong> e ele já está disponível para você baixar agora mesmo.<br /><br />
          Clique no botão abaixo para fazer o download direto — é só um clique.
        </p>
        <div class="cta-wrap">
          <a href="${EBOOK_URL}" class="cta">Baixar meu Ebook →</a>
        </div>
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p>Você recebeu este email porque se cadastrou em nosso formulário.<br />© ${new Date().getFullYear()} Biteti. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email } = await req.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = name.split(" ")[0];
    const html = buildEmailHtml(firstName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Biteti <acesso@biteti.com.br>",
        to: [email],
        subject: `${firstName}, seu Ebook chegou!`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-lead-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
