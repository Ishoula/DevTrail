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

// =========================
// GITHUB GRAPHQL (HEATMAP)
// =========================
async function getContributions(username: string, token: string) {
  const query = `
    query {
      user(login: "${username}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  return data.data.user.contributionsCollection.contributionCalendar;
}

// =========================
// FLATTEN HEATMAP
// =========================
function formatHeatmap(calendar: any) {
  return calendar.weeks.flatMap((week: any) =>
    week.contributionDays.map((day: any) => ({
      date: day.date,
      count: day.contributionCount,
    }))
  );
}

// =========================
// STREAK CALCULATION
// =========================
function calculateStreak(calendar: any) {
  const days = calendar.weeks.flatMap(
    (w: any) => w.contributionDays
  );

  const sorted = [...days].sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let streak = 0;

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].contributionCount > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// =========================
// MAIN FUNCTION
// =========================
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

    const { github_token } = await req.json();
    if (!github_token) {
      return jsonResponse({ error: "Missing GitHub token" }, 400);
    }

    const userId = user.id;

    // =========================
    // GET GITHUB USER
    // =========================
    const githubUserRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${github_token}`,
        "User-Agent": "DevTrack",
        Accept: "application/vnd.github+json",
      },
    });

    const githubUser = await githubUserRes.json();

    if (!githubUserRes.ok) {
      return jsonResponse(
        { error: "Invalid GitHub token", details: githubUser },
        401
      );
    }

    const username = githubUser.login;

    // =========================
    // GET EVENTS (COMMITS SOURCE)
    // =========================
    const eventsRes = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${github_token}`,
          "User-Agent": "DevTrack",
        },
      }
    );

    const events = await eventsRes.json();

    const pushEvents = events.filter((e: any) => e.type === "PushEvent");

    const commits = pushEvents.flatMap((event: any) => {
      const commitsArray = event.payload?.commits;
      if (!Array.isArray(commitsArray)) return [];

      return commitsArray.map((commit: any) => ({
        user_id: userId,
        sha: commit.sha,
        message: commit.message,
        repository: event.repo?.name || "unknown",
        committed_at: event.created_at,
      }));
    });

    // =========================
    // GET REPOSITORIES
    // =========================
    const reposRes = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${github_token}`,
          "User-Agent": "DevTrack",
        },
      }
    );

    const repos = await reposRes.json();

    const repoRecords = repos.map((repo: any) => ({
      user_id: userId,
      repo_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updated_at: repo.updated_at,
    }));

    // =========================
    // GET CONTRIBUTIONS (HEATMAP + STREAK)
    // =========================
    const contributions = await getContributions(username, github_token);

    const heatmap = formatHeatmap(contributions);
    const streak = calculateStreak(contributions);

    // =========================
    // SUPABASE CLIENT (SERVICE ROLE)
    // =========================
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY
    );

    // =========================
    // INSERT COMMITS
    // =========================
    if (commits.length > 0) {
      await supabase.from("commits").upsert(commits, {
        onConflict: "sha",
      });
    }

    // =========================
    // INSERT REPOS
    // =========================
    if (repoRecords.length > 0) {
      await supabase.from("repos").upsert(repoRecords, {
        onConflict: "repo_id",
      });
    }

    // =========================
    // SAVE GITHUB STATS
    // =========================
    await supabase.from("github_stats").upsert(
      {
        user_id: userId,
        github_username: username,
        streak,
        total_contributions: contributions.totalContributions,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    // =========================
    // SAVE HEATMAP
    // =========================
    const heatmapRows = heatmap.map((day: any) => ({
      user_id: userId,
      contribution_date: day.date,
      contribution_count: day.count,
    }));

    if (heatmapRows.length > 0) {
      await supabase.from("github_heatmap").upsert(heatmapRows, {
        onConflict: "user_id,contribution_date",
      });
    }

    // =========================
    // RESPONSE
    // =========================
    return jsonResponse({
      success: true,
      github_user: username,

      streak,
      total_contributions: contributions.totalContributions,
      heatmap,

      commits_synced: commits.length,
      repos_synced: repoRecords.length,

      stats: {
        push_events: pushEvents.length,
        total_events: events.length,
      },
    });
  } catch (err) {
    console.error("SYNC ERROR:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: String(err),
      },
      500
    );
  }
});