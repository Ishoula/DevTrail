import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// ===================== CORS =====================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===================== HELPERS =====================
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorBody(message: string, details?: unknown) {
  return {
    error: message,
    details: details instanceof Error ? details.message : details,
  };
}

async function readGitHubResponse(res: Response) {
  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const contentType = res.headers.get("content-type") ?? "unknown";
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 300);
    throw new Error(
      `GitHub returned non-JSON (HTTP ${res.status}, ${contentType}): ${snippet || "empty response"}`
    );
  }

  return data;
}

// ===================== GITHUB GRAPHQL =====================
async function githubGraphQL(query: string, token: string, variables?: any) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "DevTrack",
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await readGitHubResponse(res);

  if (!res.ok) {
    throw new Error(data?.message ?? "GitHub GraphQL request failed");
  }

  if (data.errors) {
    throw new Error(data.errors.map((e: any) => e.message).join("; "));
  }

  return data;
}

// ===================== CONTRIBUTIONS (REAL GITHUB METRIC) =====================
async function getGitHubContributions(username: string, token: string) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  const data = await githubGraphQL(query, token, { login: username });

  const c = data?.data?.user?.contributionsCollection;
  const contributionDays =
    c?.contributionCalendar?.weeks?.flatMap((week: any) => week.contributionDays ?? []) ?? [];

  return {
    total: c?.contributionCalendar?.totalContributions ?? 0,
    commits: c?.totalCommitContributions ?? 0,
    issues: c?.totalIssueContributions ?? 0,
    prs: c?.totalPullRequestContributions ?? 0,
    reviews: c?.totalPullRequestReviewContributions ?? 0,
    days: contributionDays.map((day: any) => ({
      date: day.date,
      count: day.contributionCount ?? 0,
    })),
  };
}

// ===================== REPOS (PAGINATED SAFELY) =====================
async function getRepos(username: string, token: string) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            databaseId
            name
            nameWithOwner
            stargazerCount
            forkCount
            updatedAt
            primaryLanguage {
              name
            }
          }
        }
      }
    }
  `;

  const data = await githubGraphQL(query, token, { login: username });

  return data?.data?.user?.repositories?.nodes ?? [];
}

// ===================== COMMITS (IMPROVED BUT STILL SAFE) =====================
async function getCommits(username: string, token: string) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(first: 50, ownerAffiliations: OWNER) {
          nodes {
            nameWithOwner
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 50) {
                    nodes {
                      oid
                      message
                      committedDate
                      additions
                      deletions
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await githubGraphQL(query, token, { login: username });

  const repos = data?.data?.user?.repositories?.nodes ?? [];

  return repos.flatMap((repo: any) => {
    const commits = repo.defaultBranchRef?.target?.history?.nodes ?? [];

    return commits.map((c: any) => ({
      sha: c.oid,
      message: c.message,
      repository: repo.nameWithOwner,
      committed_at: c.committedDate,
      additions: c.additions ?? 0,
      deletions: c.deletions ?? 0,
    }));
  });
}

// ===================== MAIN =====================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
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

    let body: { github_token?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { github_token } = body;
    if (!github_token) {
      return jsonResponse({ error: "Missing GitHub token" }, 400);
    }

    const userId = user.id;

    // ===================== GITHUB USER =====================
    const githubUserRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${github_token}`,
        "User-Agent": "DevTrack",
        Accept: "application/vnd.github+json",
      },
    });

    const githubUser = await readGitHubResponse(githubUserRes);

    if (!githubUserRes.ok) {
      return jsonResponse(
        { error: "Invalid GitHub token", details: githubUser },
        401
      );
    }

    const username = githubUser.login;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===================== FETCH DATA =====================
    const repos = await getRepos(username, github_token);
    const commits = await getCommits(username, github_token);
    const contributions = await getGitHubContributions(username, github_token);

    console.log("Repos:", repos.length);
    console.log("Commits (sampled):", commits.length);

    // ===================== FORMAT REPOS =====================
    const repoRecords = repos.map((repo: any) => ({
      repo_id: repo.databaseId,
      user_id: userId,
      name: repo.name,
      full_name: repo.nameWithOwner,
      language: repo.primaryLanguage?.name ?? null,
      stars: repo.stargazerCount ?? 0,
      forks: repo.forkCount ?? 0,
      updated_at: repo.updatedAt,
    }));

    // ===================== FORMAT COMMITS =====================
    const commitRecords = commits.map((c: any) => ({
      user_id: userId,
      sha: c.sha,
      message: c.message,
      repository: c.repository,
      committed_at: c.committed_at,
      additions: c.additions,
      deletions: c.deletions,
    }));

    // ===================== UPSERT REPOS =====================
    if (repoRecords.length > 0) {
      await supabase.from("repos").upsert(repoRecords, {
        onConflict: "repo_id",
      });
    }

    // ===================== UPSERT COMMITS =====================
    if (commitRecords.length > 0) {
      await supabase.from("commits").upsert(commitRecords, {
        onConflict: "sha",
      });
    }

    // Persist GitHub's daily contribution calendar so streaks match GitHub.
    if (contributions.days.length > 0) {
      const heatmapRecords = contributions.days.map((day: any) => ({
        user_id: userId,
        contribution_date: day.date,
        contribution_count: day.count,
      }));

      const { error: heatmapError } = await supabase
        .from("github_heatmap")
        .upsert(heatmapRecords, { onConflict: "user_id,contribution_date" });

      if (heatmapError) {
        return jsonResponse(
          errorBody("Failed to update GitHub contribution calendar", heatmapError),
          500
        );
      }
    }

    // ===================== UPSERT STATS (TRUTH LAYER) =====================
    const { error: statsError } = await supabase
      .from("github_stats")
      .upsert(
        {
          user_id: userId,
          github_username: username,

          repos_synced: repos.length,

          // REAL GitHub contribution engine (this is your 433 fix)
          total_contributions: contributions.total,
          commit_contributions: contributions.commits,
          issue_contributions: contributions.issues,
          pr_contributions: contributions.prs,
          review_contributions: contributions.reviews,

          // optional debugging metric
          sampled_commits_synced: commits.length,

          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (statsError) {
      return jsonResponse(
        errorBody("Failed to update GitHub stats", statsError),
        500
      );
    }

    return jsonResponse({
      success: true,
      github_user: username,
      repos_synced: repos.length,
      commits_sampled: commits.length,
      total_contributions: contributions.total,
    });
  } catch (err) {
    console.error("SYNC ERROR:", err);
    return jsonResponse(errorBody("Internal server error", err), 500);
  }
});
