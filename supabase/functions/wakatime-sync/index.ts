import { createClient } from "npm:@supabase/supabase-js@2";

const Deno = (globalThis as any).Deno;

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

interface WakaTimeSummaryDay {
  grand_total?: {
    total_seconds?: number;
    text?: string;
    hours?: number;
    minutes?: number;
  };
  range?: {
    date?: string;
    start?: string;
    end?: string;
  };
}

interface CodingSessionRow {
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  commit_count: number;
}

function encodeApiKey(apiKey: string) {
  return btoa(apiKey);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return jsonResponse(
        { error: "Missing WakaTime API key. Save it in Settings first." },
        400
      );
    }

    const wakatimeResponse = await fetch(
      "https://wakatime.com/api/v1/users/current/summaries?range=last_30_days",
      {
        headers: {
          Authorization: `Basic ${encodeApiKey(apiKey.trim())}`,
          Accept: "application/json",
        },
      }
    );

    const wakatimeData = await wakatimeResponse.json();

    if (!wakatimeResponse.ok) {
      return jsonResponse(
        {
          error: "Failed to fetch WakaTime summaries",
          details: wakatimeData?.message ?? wakatimeData?.error ?? wakatimeData,
        },
        wakatimeResponse.status
      );
    }

    const summaries: WakaTimeSummaryDay[] = Array.isArray(wakatimeData?.data)
      ? wakatimeData.data
      : [];

    const sessions: CodingSessionRow[] = summaries
      .map((day) => {
        const totalSeconds = day.grand_total?.total_seconds ?? 0;
        const startedAt = day.range?.start;
        const endedAt = day.range?.end;

        if (!startedAt || !endedAt) return null;

        return {
          user_id: user.id,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: Math.max(0, Math.round(totalSeconds / 60)),
          commit_count: 0,
        };
      })
      .filter((row): row is CodingSessionRow => row !== null);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error: deleteError } = await supabase
      .from("coding_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonResponse(
        { error: "Failed to clear old coding sessions", details: deleteError.message },
        500
      );
    }

    if (sessions.length > 0) {
      const { error: upsertError } = await supabase
        .from("coding_sessions")
        .upsert(sessions, { onConflict: "user_id,started_at" });

      if (upsertError) {
        return jsonResponse(
          { error: "Failed to save WakaTime sessions", details: upsertError.message },
          500
        );
      }
    }

    const totalSeconds =
      wakatimeData?.cumulative_total?.seconds ??
      summaries.reduce((sum, day) => sum + (day.grand_total?.total_seconds ?? 0), 0);

    return jsonResponse({
      success: true,
      total_seconds: totalSeconds,
      total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
      days_synced: sessions.length,
      summaries: sessions.map((session) => ({
        started_at: session.started_at,
        duration_minutes: session.duration_minutes,
      })),
    });
  } catch (err) {
    console.error("WAKATIME SYNC ERROR:", err);
    return jsonResponse(
      { error: "Internal server error", details: String(err) },
      500
    );
  }
});
