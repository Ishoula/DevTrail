import { createClient } from "npm:@supabase/supabase-js@2";

const Deno = (globalThis as typeof globalThis & {
  Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve(
      handler: (req: Request) => Response | Promise<Response>,
    ): void;
  };
}).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const SUPABASE_SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          error: "Unauthorized",
          details: userError instanceof Error ? userError.message : String(userError),
        },
        401
      );
    }

    const { github_token } = await req.json();

    if (!github_token) {
      return jsonResponse({ error: "Missing GitHub token" }, 400);
    }

    const userId = user.id;

    // =========================
    // GITHUB USER FETCH
    // =========================
    const githubUserRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${github_token}`,
        "User-Agent": "DevTrack",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const githubUserText = await githubUserRes.text();

    if (!githubUserRes.ok) {
      console.error("GITHUB USER ERROR:", githubUserText);

      return jsonResponse(
        {
          error: "Invalid GitHub token",
          details: githubUserText,
        },
        401
      );
    }

    const githubUser = JSON.parse(githubUserText);

    // =========================
    // GITHUB EVENTS FETCH
    // =========================
    const eventsRes = await fetch(
      `https://api.github.com/users/${githubUser.login}/events?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${github_token}`,
          "User-Agent": "DevTrack",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    const eventsText = await eventsRes.text();

    if (!eventsRes.ok) {
      console.error("GITHUB EVENTS ERROR STATUS:", eventsRes.status);
      console.error("GITHUB EVENTS ERROR BODY:", eventsText);

      return jsonResponse(
        {
          error: "Failed to fetch GitHub events",
          status: eventsRes.status,
          details: eventsText,
        },
        400
      );
    }

    const events = JSON.parse(eventsText);

    if (!Array.isArray(events)) {
      return jsonResponse(
        {
          error: "Invalid GitHub events response",
          details: events,
        },
        400
      );
    }

    console.log("GitHub user:", githubUser.login);
    console.log("Total events:", events.length);

    // =========================
    // PUSH EVENTS
    // =========================
    const pushEvents = events.filter(
      (e: any) => e.type === "PushEvent"
    );

    console.log("Push events:", pushEvents.length);

    // =========================
    // COMMITS
    // =========================
    const commits = pushEvents.flatMap((event: any) => {
      const commitsArray = event.payload?.commits;

      if (!Array.isArray(commitsArray)) return [];

      return commitsArray.map((commit: any) => ({
        user_id: userId,
        sha: commit.sha,
        message: commit.message,
        repository: event.repo?.name || "unknown",
        committed_at: event.created_at,
        additions: 0,
        deletions: 0,
      }));
    });

    console.log("Commits extracted:", commits.length);

    // =========================
    // INSERT COMMITS
    // =========================
    if (commits.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/commits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(commits),
      });
    }

    // =========================
    // RESPONSE
    // =========================
    return jsonResponse({
      success: true,
      github_user: githubUser.login,
      total_events: events.length,
      push_events: pushEvents.length,
      commits_synced: commits.length,
      sessions_created: 0,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: String(err),
      },
      500
    );
  }
});

export {};
