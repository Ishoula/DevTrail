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

// WakaTime uses HTTP Basic auth with the API key as the username.
function encodeApiKey(apiKey: string) {
  return globalThis.btoa(`${apiKey}:`);
}

type CodingSession = {
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  commit_count: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    console.log("wakatime-sync hit:", req.method);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        { error: "Missing Supabase environment variables" },
        500,
      );
    }

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

    // ✅ SAFE access
    const apiKey = user?.user_metadata?.wakatime_api_key;

    if (!apiKey || typeof apiKey !== "string") {
      return jsonResponse({ error: "Missing WakaTime API key" }, 400);
    }

    // =========================
    // FETCH WAKATIME
    // =========================
    const wakatimeResponse = await fetch(
      "https://wakatime.com/api/v1/users/current/summaries?range=last_30_days",
      {
        headers: {
          Authorization: `Basic ${encodeApiKey(apiKey.trim())}`,
          Accept: "application/json",
        },
      },
    );

    const rawText = await wakatimeResponse.text();

    console.log("WakaTime status:", wakatimeResponse.status);
    console.log("WakaTime raw preview:", rawText.slice(0, 300));

    let wakatimeData: any;

    try {
      wakatimeData = JSON.parse(rawText);
    } catch {
      return jsonResponse(
        {
          error: "Invalid JSON from WakaTime",
          raw: rawText.slice(0, 300),
        },
        502,
      );
    }

    if (!wakatimeResponse.ok) {
      return jsonResponse(
        {
          error: "WakaTime API error",
          details: wakatimeData?.message || wakatimeData,
        },
        wakatimeResponse.status,
      );
    }

    // =========================
    // SAFE NORMALIZATION
    // =========================
    const summaries = wakatimeData?.data?.summaries ??
      wakatimeData?.data ??
      wakatimeData?.summaries ??
      [];

    if (!Array.isArray(summaries)) {
      return jsonResponse(
        {
          error: "Unexpected WakaTime format",
          received: typeof summaries,
        },
        502,
      );
    }

    // =========================
    // BUILD SESSIONS
    // =========================
    const sessions: CodingSession[] = summaries
      .map((day: any): CodingSession | null => {
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
      .filter((session): session is CodingSession => session !== null);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          name: user.user_metadata?.name ??
            user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            "",
          avatar_url: user.user_metadata?.avatar_url ?? "",
        },
        { onConflict: "id" },
      );

    if (profileError) {
      return jsonResponse(
        {
          error: "Failed to ensure user profile",
          details: profileError.message,
        },
        500,
      );
    }

    // DELETE OLD
    const { error: deleteError } = await supabase
      .from("coding_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonResponse(
        { error: "Failed to delete sessions", details: deleteError.message },
        500,
      );
    }

    // UPSERT NEW
    if (sessions.length > 0) {
      const { error: upsertError } = await supabase
        .from("coding_sessions")
        .upsert(sessions, {
          onConflict: "user_id,started_at",
        });

      if (upsertError) {
        return jsonResponse(
          { error: "Failed to upsert sessions", details: upsertError.message },
          500,
        );
      }
    }

    const totalSeconds = wakatimeData?.cumulative_total?.seconds ??
      summaries.reduce(
        (sum: number, d: any) => sum + (d?.grand_total?.total_seconds ?? 0),
        0,
      );

    return jsonResponse({
      success: true,
      total_seconds: totalSeconds,
      total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
      days_synced: sessions.length,
    });
  } catch (err: any) {
    console.error("WAKATIME SYNC CRASH:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: err?.message || String(err),
        stack: err?.stack,
      },
      500,
    );
  }
});
