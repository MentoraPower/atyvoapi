import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EBOOK_URL =
    "https://wenmrdqdmjidloivjycs.supabase.co/storage/v1/object/sign/APP%20AGEND/30%20dias%20Ebook-2.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80ZTE3OGE0MC02ZDRjLTQxYzUtYjI5Mi1mY2MzMjc0MGI1NGEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJBUFAgQUdFTkQvMzAgZGlhcyBFYm9vay0yLnBkZiIsImlhdCI6MTc3Mzg3MzQ3NCwiZXhwIjo0OTI3NDczNDc0fQ.E0fBSgYySOH-NVjkzFCIDVNT9mpd7ia3YTv1-lIUxec";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const res = await fetch(EBOOK_URL);

        if (!res.ok) {
            return new Response("Arquivo não encontrado", {
                status: 404,
                headers: corsHeaders,
            });
        }

        const blob = await res.arrayBuffer();

        return new Response(blob, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="30-dias-ebook.pdf"',
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (err) {
        console.error("download-ebook error:", err);
        return new Response("Erro interno", { status: 500, headers: corsHeaders });
    }
});
