/*
  Keep github_stats aligned with the metrics written by github-sync.

  The table predates the contribution breakdown fields, so use idempotent
  ALTER statements to support projects where some columns already exist.
*/

ALTER TABLE github_stats
  ADD COLUMN IF NOT EXISTS github_username text,
  ADD COLUMN IF NOT EXISTS repos_synced integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_contributions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commit_contributions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issue_contributions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_contributions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_contributions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sampled_commits_synced integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
