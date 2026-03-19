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
// All possible hourly slots (8h-19h range)
const ALL_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);
const SLOT_DURATION_MS = 60 * 60 * 1000; // 1 hour

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
    throw new Error("No refresh token found. Owner needs to login at /acesso first.");
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
    const { date } = await req.json();
    if (!date) {
      return new Response(JSON.stringify({ error: "date is required (YYYY-MM-DD)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGoogleAccessToken();

    // Query Google Calendar for busy times on that day
    const timeMin = `${date}T00:00:00-03:00`;
    const timeMax = `${date}T23:59:59-03:00`;

    const freeBusyRes = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: [{ id: CALENDAR_ID }],
        }),
      }
    );

    const freeBusyData = await freeBusyRes.json();
    const busySlots = freeBusyData.calendars?.[CALENDAR_ID]?.busy || [];

    console.log(`Date ${date}: ${busySlots.length} busy periods from Google Calendar`);

    // Also check blocked slots from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get day of week for the requested date
    const dayOfWeek = new Date(`${date}T12:00:00-03:00`).getDay();

    const [blockedRes, blockedDatesRes] = await Promise.all([
      supabase.from("blocked_slots").select("start_time, end_time").eq("day_of_week", dayOfWeek),
      supabase.from("blocked_dates").select("start_time, end_time").eq("blocked_date", date),
    ]);

    const blockedRanges = (blockedRes.data || []) as { start_time: string; end_time: string }[];
    const blockedDateRanges = (blockedDatesRes.data || []) as { start_time: string; end_time: string }[];

    // Filter slots based on Google Calendar (source of truth) and blocked slots
    const availableSlots = ALL_SLOTS.filter((slot) => {
      const slotHour = parseInt(slot.split(":")[0]);

      // Check if slot falls within any blocked range
      const isBlocked = blockedRanges.some((block) => {
        const blockStart = parseInt(block.start_time.split(":")[0]);
        const blockEnd = parseInt(block.end_time.split(":")[0]);
        return slotHour >= blockStart && slotHour < blockEnd;
      });
      if (isBlocked) return false;

      // Check if slot falls within any date-specific blocked range
      const isDateBlocked = blockedDateRanges.some((block) => {
        if (block.start_time === "00:00" && block.end_time === "23:59") return true;
        const blockStart = parseInt(block.start_time.split(":")[0]);
        const blockEnd = parseInt(block.end_time.split(":")[0]);
        return slotHour >= blockStart && slotHour < blockEnd;
      });
      if (isDateBlocked) return false;

      // Google Calendar is the single source of truth for appointments
      const slotStart = new Date(`${date}T${slot}:00-03:00`).getTime();
      const slotEnd = slotStart + SLOT_DURATION_MS;

      return !busySlots.some((busy: { start: string; end: string }) => {
        const busyStart = new Date(busy.start).getTime();
        const busyEnd = new Date(busy.end).getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });
    });

    console.log(`Available slots for ${date}:`, availableSlots);

    return new Response(JSON.stringify({ availableSlots }), {
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
