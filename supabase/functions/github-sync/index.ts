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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorBody(message: string, details?: unknown) {
  return {
    error: message,
    details: details instanceof Error ? details.message : details,
  };
}

// ===================== GITHUB GRAPHQL =====================
async function githubGraphQL(query: string, token: string, variables?: any) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "DevTrack",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("GitHub GraphQL HTTP Error:", data);
    throw new Error(data?.message ?? "GitHub GraphQL request failed");
  }

  if (data.errors) {
    console.error("GitHub GraphQL Errors:", data.errors);
    throw new Error(data.errors.map((error: any) => error.message).join("; "));
  }

  return data;
}

// ===================== REPOS =====================
async function getRepos(username: string, token: string) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(first: 50, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
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

// ===================== COMMITS =====================
async function getCommits(username: string, token: string) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(first: 20, ownerAffiliations: OWNER) {
          nodes {
            nameWithOwner
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 30) {
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

    console.log("Sync started for user:", userId);

    // ===================== GITHUB USER =====================
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

    // ===================== SUPABASE =====================
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===================== FETCH DATA =====================
    const repos = await getRepos(username, github_token);
    const commits = await getCommits(username, github_token);

    console.log("Repos fetched:", repos.length);
    console.log("Commits fetched:", commits.length);

    // ===================== REPOS FORMAT =====================
    const repoRecords = repos.map((repo: any) => ({
      repo_id: repo.databaseId, // FIXED (was repo.id)
      user_id: userId,
      name: repo.name,
      full_name: repo.nameWithOwner,
      language: repo.primaryLanguage?.name ?? null,
      stars: repo.stargazerCount ?? 0,
      forks: repo.forkCount ?? 0,
      updated_at: repo.updatedAt,
    }));

    // ===================== COMMITS FORMAT =====================
    const commitRecords = commits.map((c: any) => ({
      user_id: userId, // FIXED (was missing)
      sha: c.sha,
      message: c.message,
      repository: c.repository,
      committed_at: c.committed_at,
      additions: c.additions,
      deletions: c.deletions,
    }));

    // ===================== UPSERT REPOS =====================
    if (repoRecords.length > 0) {
      const { error: repoError } = await supabase
        .from("repos")
        .upsert(repoRecords, { onConflict: "repo_id" });

      if (repoError) {
        console.error("Repo insert error:", repoError);

        if (repoError.code !== "42P01") {
          return jsonResponse(
            errorBody("Failed to sync GitHub repos", repoError),
            500
          );
        }

        console.warn(
          "Skipping repo persistence because the repos table does not exist."
        );
      }
    }

    // ===================== UPSERT COMMITS =====================
    if (commitRecords.length > 0) {
      const { error: commitError } = await supabase
        .from("commits")
        .upsert(commitRecords, { onConflict: "sha" });

      if (commitError) {
        console.error("Commit insert error:", commitError);
        return jsonResponse(
          errorBody("Failed to sync GitHub commits", commitError),
          500
        );
      }
    }

    // ===================== STATS =====================
    const { error: statsError } = await supabase
      .from("github_stats")
      .upsert(
        {
          user_id: userId,
          github_username: username,
          repos_synced: repos.length,
          total_contributions: commits.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (statsError) {
      console.error("Stats error:", statsError);
      return jsonResponse(errorBody("Failed to update GitHub stats", statsError), 500);
    }

    return jsonResponse({
      success: true,
      github_user: username,
      repos_synced: repos.length,
      commits_synced: commits.length,
    });
  } catch (err) {
    console.error("SYNC ERROR:", err);
    return jsonResponse(
      errorBody("Internal server error", err),
      500
    );
  }
});
