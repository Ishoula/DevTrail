import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// ✅ SAFE base64 encoding for Deno Edge Runtime
function encodeApiKey(apiKey: string) {
  return globalThis.btoa(apiKey);
}

Deno.serve(async (req: Request) => {
  // ✅ CORS PRE-FLIGHT FIX (critical for your error)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("wakatime-sync method:", req.method);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
      return jsonResponse(
        { error: "Missing Supabase environment variables" },
        500
      );
    }

    // auth client (user verification)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const apiKey = user.user_metadata?.wakatime_api_key;

    if (!apiKey || typeof apiKey !== "string") {
      return jsonResponse(
        { error: "Missing WakaTime API key" },
        400
      );
    }

    // =========================
    // WA KATIME FETCH (SAFE)
    // =========================
    const wakatimeResponse = await fetch(
      "https://wakatime.com/api/v1/users/current/summaries?range=last_30_days",
      {
        headers: {
          Authorization: `Basic ${encodeApiKey(apiKey.trim())}`,
          Accept: "application/json",
        },
      }
    );

    // ✅ SAFE TEXT PARSING (prevents 500 crashes)
    const rawText = await wakatimeResponse.text();

    let wakatimeData: any;
    try {
      wakatimeData = JSON.parse(rawText);
    } catch {
      return jsonResponse(
        {
          error: "Invalid JSON from WakaTime",
          raw: rawText.slice(0, 200),
        },
        502
      );
    }

    if (!wakatimeResponse.ok) {
      return jsonResponse(
        {
          error: "WakaTime API error",
          details: wakatimeData?.message ?? wakatimeData,
        },
        wakatimeResponse.status
      );
    }

    const summaries = Array.isArray(wakatimeData?.data)
      ? wakatimeData.data
      : [];

    const sessions = summaries
      .map((day: any) => {
        const totalSeconds = day?.grand_total?.total_seconds ?? 0;
        const startedAt = day?.range?.start;
        const endedAt = day?.range?.end;

        if (!startedAt || !endedAt) return null;

        return {
          user_id: user.id,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: Math.max(0, Math.round(totalSeconds / 60)),
          commit_count: 0,
        };
      })
      .filter(Boolean);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // clear old sessions
    const { error: deleteError } = await supabase
      .from("coding_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonResponse(
        {
          error: "Failed to clear sessions",
          details: deleteError.message,
        },
        500
      );
    }

    // insert new sessions
    if (sessions.length > 0) {
      const { error: upsertError } = await supabase
        .from("coding_sessions")
        .upsert(sessions, {
          onConflict: "user_id,started_at",
        });

      if (upsertError) {
        return jsonResponse(
          {
            error: "Failed to save sessions",
            details: upsertError.message,
          },
          500
        );
      }
    }

    const totalSeconds =
      wakatimeData?.cumulative_total?.seconds ??
      summaries.reduce(
        (sum: number, d: any) =>
          sum + (d?.grand_total?.total_seconds ?? 0),
        0
      );

    return jsonResponse({
      success: true,
      total_seconds: totalSeconds,
      total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
      days_synced: sessions.length,
    });
  } catch (err) {
    console.error("WAKATIME ERROR:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: String(err),
      },
      500
    );
  }
});