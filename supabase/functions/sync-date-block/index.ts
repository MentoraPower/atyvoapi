import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CALENDAR_ID =
  "c_a8bf3747d85d2ca99a91a167cbb8615caa33eaa59f960b225871aa10b08b1474@group.calendar.google.com";

const OWNER_USER_ID = "a38ab088-c1fe-4804-a195-66972c99a372";

async function getGoogleAccessToken(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("refresh_token")
    .eq("user_id", OWNER_USER_ID)
    .eq("provider", "google")
    .single();

  if (error || !data?.refresh_token) {
    throw new Error("No refresh token found for calendar sync");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to refresh Google token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, date, start_time, end_time } = await req.json();
    const accessToken = await getGoogleAccessToken();

    if (action === "create") {
      const isFullDay = start_time === "00:00" && end_time === "23:59";

      let event;
      if (isFullDay) {
        // Create an all-day event
        const nextDay = new Date(date + "T12:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];

        event = {
          summary: "Bloqueado",
          description: "Data bloqueada manualmente",
          start: { date: date },
          end: { date: nextDayStr },
          transparency: "opaque",
          colorId: "11", // Red
        };
      } else {
        event = {
          summary: "Bloqueado",
          description: "Horário bloqueado manualmente",
          start: { dateTime: `${date}T${start_time}:00-03:00`, timeZone: "America/Sao_Paulo" },
          end: { dateTime: `${date}T${end_time}:00-03:00`, timeZone: "America/Sao_Paulo" },
          transparency: "opaque",
          colorId: "11", // Red
        };
      }

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const calData = await calRes.json();
      console.log("Created date block event:", calData.id);

      return new Response(JSON.stringify({ success: true, eventId: calData.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Find and delete matching "Bloqueado" events on that date
      const isFullDay = start_time === "00:00" && end_time === "23:59";

      let timeMin, timeMax;
      if (isFullDay) {
        timeMin = `${date}T00:00:00-03:00`;
        const nextDay = new Date(date + "T12:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        timeMax = `${nextDay.toISOString().split("T")[0]}T00:00:00-03:00`;
      } else {
        timeMin = `${date}T${start_time}:00-03:00`;
        timeMax = `${date}T${end_time}:00-03:00`;
      }

      const searchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          q: "Bloqueado",
          maxResults: "50",
          singleEvents: "true",
        }),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const searchData = await searchRes.json();
      const toDelete = (searchData.items || []).filter(
        (e: any) => e.summary === "Bloqueado" || e.summary === "🔒 Bloqueado"
      );

      let deleted = 0;
      for (const event of toDelete) {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (delRes.ok || delRes.status === 204) deleted++;
      }

      console.log(`Deleted ${deleted} date block events for ${date}`);

      return new Response(JSON.stringify({ success: true, deleted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
