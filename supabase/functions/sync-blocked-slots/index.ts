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

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveEndTime(dateStr: string, endTime: string): { date: string; time: string } {
  if (endTime === "24:00") {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return { date: d.toISOString().split("T")[0], time: "00:00" };
  }
  return { date: dateStr, time: endTime };
}

// Find the next occurrence of a given day_of_week from today
function getNextDayOfWeek(dayOfWeek: number): Date {
  const now = new Date();
  const today = now.getDay();
  let diff = dayOfWeek - today;
  if (diff < 0) diff += 7;
  const result = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slots } = await req.json();
    const accessToken = await getGoogleAccessToken();

    const now = new Date();
    const yearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Delete ALL existing "Bloqueado" events (recurring + single) — paginate
    let allExisting: any[] = [];
    let pageToken: string | undefined;
    do {
      const params: Record<string, string> = {
        timeMin: now.toISOString(),
        timeMax: yearLater.toISOString(),
        q: "Bloqueado",
        maxResults: "250",
        singleEvents: "false", // get recurring event parents too
      };
      if (pageToken) params.pageToken = pageToken;

      const searchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
        new URLSearchParams(params),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();
      const items = (searchData.items || []).filter(
        (e: any) => e.summary === "🔒 Bloqueado" || e.summary === "Bloqueado"
      );
      allExisting.push(...items);
      pageToken = searchData.nextPageToken;
    } while (pageToken);

    // Also search with singleEvents=true to catch expanded instances
    pageToken = undefined;
    do {
      const params: Record<string, string> = {
        timeMin: now.toISOString(),
        timeMax: yearLater.toISOString(),
        q: "Bloqueado",
        maxResults: "250",
        singleEvents: "true",
      };
      if (pageToken) params.pageToken = pageToken;

      const searchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
        new URLSearchParams(params),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();
      const items = (searchData.items || []).filter(
        (e: any) => (e.summary === "🔒 Bloqueado" || e.summary === "Bloqueado") && !e.recurringEventId
      );
      allExisting.push(...items);
      pageToken = searchData.nextPageToken;
    } while (pageToken);

    // Deduplicate by id
    const seen = new Set<string>();
    allExisting = allExisting.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Delete sequentially with retry to avoid rate limits
    let deleted = 0;
    for (const event of allExisting) {
      let retries = 0;
      while (retries < 3) {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.status === 429 || res.status === 403) {
          retries++;
          await sleep(2000 * retries);
          continue;
        }
        deleted++;
        break;
      }
      await sleep(150);
    }

    console.log(`Deleted ${deleted} existing blocked events`);

    // Merge consecutive slots per day
    const mergedByDay: Record<number, { start_time: string; end_time: string }[]> = {};
    for (let dow = 0; dow <= 6; dow++) {
      const daySlots = (slots || [])
        .filter((s: any) => s.day_of_week === dow)
        .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

      if (daySlots.length === 0) continue;

      const merged: { start_time: string; end_time: string }[] = [];
      let current = { ...daySlots[0] };
      for (let i = 1; i < daySlots.length; i++) {
        if (daySlots[i].start_time === current.end_time) {
          current.end_time = daySlots[i].end_time;
        } else {
          merged.push(current);
          current = { ...daySlots[i] };
        }
      }
      merged.push(current);
      mergedByDay[dow] = merged;
    }

    // Create RECURRING events (1 per merged slot, repeating weekly for 52 weeks)
    const untilDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const untilStr = untilDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const eventsToCreate: any[] = [];
    for (const [dowStr, merged] of Object.entries(mergedByDay)) {
      const dow = parseInt(dowStr);
      const startDate = getNextDayOfWeek(dow);
      const dateStr = startDate.toISOString().split("T")[0];

      for (const slot of merged) {
        const end = resolveEndTime(dateStr, slot.end_time);
        eventsToCreate.push({
          summary: "Bloqueado",
          description: `Horário bloqueado (${DAY_NAMES[dow]})`,
          start: { dateTime: `${dateStr}T${slot.start_time}:00-03:00`, timeZone: "America/Sao_Paulo" },
          end: { dateTime: `${end.date}T${end.time}:00-03:00`, timeZone: "America/Sao_Paulo" },
          recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${RRULE_DAYS[dow]};UNTIL=${untilStr}`],
          transparency: "opaque",
          colorId: "11",
        });
      }
    }

    // Create events sequentially with retry to guarantee all are created
    let created = 0;
    for (const event of eventsToCreate) {
      let retries = 0;
      while (retries < 3) {
        const res = await fetch(
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
        if (res.status === 429 || res.status === 403) {
          retries++;
          await sleep(2000 * retries);
          continue;
        }
        if (res.ok) {
          created++;
        } else {
          const errBody = await res.text();
          console.error(`Failed: ${res.status} ${errBody}`);
        }
        break;
      }
      await sleep(200);
    }

    console.log(`Created ${created}/${eventsToCreate.length} recurring blocked events for the next year`);

    return new Response(JSON.stringify({ success: true, deleted, created, total: eventsToCreate.length }), {
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
