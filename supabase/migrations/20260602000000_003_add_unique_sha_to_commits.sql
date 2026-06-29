/*
  # Add UNIQUE constraint on commits.sha

  The github-sync edge function uses `.upsert(commits, { onConflict: "sha" })`
  which requires a UNIQUE constraint on the sha column.
  Without this, the upsert fails with a Postgres error.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'commits_sha_unique'
  ) THEN
    ALTER TABLE commits
    ADD CONSTRAINT commits_sha_unique UNIQUE (sha);
  END IF;
END $$;