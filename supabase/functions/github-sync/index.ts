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

type GitHubContributionDay = {
  date: string;
  contributionCount: number;
};

function getContributionDateRange() {
  const to = new Date();
  const from = new Date(to);

  from.setUTCFullYear(from.getUTCFullYear() - 1);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
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
    // GITHUB CONTRIBUTIONS FETCH
    // =========================
    const { from, to } = getContributionDateRange();
    const contributionsRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${github_token}`,
        "User-Agent": "DevTrack",
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
            user(login: $login) {
              contributionsCollection(from: $from, to: $to) {
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
        `,
        variables: {
          login: githubUser.login,
          from,
          to,
        },
      }),
    });

    const contributionsText = await contributionsRes.text();

    if (!contributionsRes.ok) {
      console.error("GITHUB CONTRIBUTIONS ERROR STATUS:", contributionsRes.status);
      console.error("GITHUB CONTRIBUTIONS ERROR BODY:", contributionsText);

      return jsonResponse(
        {
          error: "Failed to fetch GitHub contributions",
          status: contributionsRes.status,
          details: contributionsText,
        },
        400
      );
    }

    const contributionsPayload = JSON.parse(contributionsText);

    if (Array.isArray(contributionsPayload.errors)) {
      console.error("GITHUB CONTRIBUTIONS GRAPHQL ERRORS:", contributionsPayload.errors);

      return jsonResponse(
        {
          error: "Failed to fetch GitHub contributions",
          details: contributionsPayload.errors,
        },
        400
      );
    }

    const contributionCalendar =
      contributionsPayload.data?.user?.contributionsCollection?.contributionCalendar;

    if (!contributionCalendar) {
      return jsonResponse(
        {
          error: "Invalid GitHub contributions response",
          details: contributionsPayload,
        },
        400
      );
    }

    const contributionDays: GitHubContributionDay[] =
      contributionCalendar?.weeks?.flatMap((week: any) => week.contributionDays ?? []) ?? [];

    console.log("GitHub user:", githubUser.login);
    console.log("Contribution days:", contributionDays.length);
    console.log("Total contributions:", contributionCalendar?.totalContributions ?? 0);

    // =========================
    // CONTRIBUTIONS
    // =========================
    const contributions = contributionDays.flatMap((day) => {
      if (day.contributionCount <= 0) return [];

      return Array.from({ length: day.contributionCount }, (_, index) => ({
        user_id: userId,
        sha: `github-contribution:${githubUser.login}:${day.date}:${index + 1}`,
        message: "GitHub contribution",
        repository: "GitHub contributions",
        committed_at: `${day.date}T12:00:00.000Z`,
        additions: 0,
        deletions: 0,
      }));
    });

    console.log("Contributions extracted:", contributions.length);

    // =========================
    // INSERT CONTRIBUTIONS
    // =========================
    const encodedUserId = encodeURIComponent(userId);

    const deleteExistingContributionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/commits?user_id=eq.${encodedUserId}&repository=eq.GitHub%20contributions`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!deleteExistingContributionsRes.ok) {
      const deleteExistingContributionsText =
        await deleteExistingContributionsRes.text();

      console.error(
        "DELETE EXISTING CONTRIBUTIONS ERROR:",
        deleteExistingContributionsText
      );

      return jsonResponse(
        {
          error: "Failed to refresh existing GitHub contributions",
          status: deleteExistingContributionsRes.status,
          details: deleteExistingContributionsText,
        },
        400
      );
    }

    if (contributions.length > 0) {
      const insertContributionsRes = await fetch(`${SUPABASE_URL}/rest/v1/commits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(contributions),
      });

      if (!insertContributionsRes.ok) {
        const insertContributionsText = await insertContributionsRes.text();

        console.error("INSERT CONTRIBUTIONS ERROR:", insertContributionsText);

        return jsonResponse(
          {
            error: "Failed to save GitHub contributions",
            status: insertContributionsRes.status,
            details: insertContributionsText,
          },
          400
        );
      }
    }

    // =========================
    // RESPONSE
    // =========================
    return jsonResponse({
      success: true,
      github_user: githubUser.login,
      contribution_days: contributionDays.length,
      total_contributions: contributionCalendar.totalContributions,
      contributions_synced: contributions.length,
      commits_synced: contributions.length,
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
