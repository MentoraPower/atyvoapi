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
    const { appointment_id, action } = await req.json();
    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: appt, error: dbError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (dbError || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGoogleAccessToken();

    // Cancel: just delete the event
    if (action === "cancel" && appt.calendar_event_id) {
      console.log(`Cancelling calendar event: ${appt.calendar_event_id}`);
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${appt.calendar_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      await deleteRes.text();
      console.log(`Delete event status: ${deleteRes.status}`);
      return new Response(JSON.stringify({ success: deleteRes.ok, action: "cancel" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If rescheduling, delete old event first
    if (action === "reschedule" && appt.calendar_event_id) {
      console.log(`Deleting old calendar event: ${appt.calendar_event_id}`);
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${appt.calendar_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      console.log(`Delete old event status: ${deleteRes.status}`);
      await deleteRes.text();
    }

    // Create new event
    const startDateTime = `${appt.appointment_date}T${appt.appointment_time}:00`;
    const [hours, minutes] = appt.appointment_time.split(":").map(Number);
    const endTime = `${String(hours + 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const endDateTime = `${appt.appointment_date}T${endTime}:00`;

    const event = {
      summary: `Agendamento - ${appt.name}`,
      description: [
        `Nome: ${appt.name}`,
        `Email: ${appt.email}`,
        `WhatsApp: ${appt.phone}`,
        appt.instagram ? `Instagram: ${appt.instagram}` : null,
        appt.faturamento ? `Faturamento: ${appt.faturamento}` : null,
        appt.aluna_biteti ? `Aluna Biteti: ${appt.aluna_biteti}` : null,
        appt.faz_curso ? `Faz curso: ${appt.faz_curso}` : null,
        appt.decisao_parceiro ? `Decisão depende do parceiro(a): ${appt.decisao_parceiro}` : null,
      ].filter(Boolean).join("\n"),
      start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
      attendees: [
        { email: appt.email, displayName: appt.name },
      ],
      conferenceData: {
        createRequest: {
          requestId: `meet-${appointment_id}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      colorId: "10",
    };

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
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
    console.log(`Created calendar event: ${calData.id}, status: ${calRes.status}`);

    // Save calendar_event_id back to appointments table
    if (calData.id) {
      await supabase
        .from("appointments")
        .update({ calendar_event_id: calData.id })
        .eq("id", appointment_id);
    }

    return new Response(JSON.stringify({
      success: calRes.ok,
      calendar_event_id: calData.id || null,
      action,
    }), {
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
