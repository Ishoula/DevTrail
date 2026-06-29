/*
  # Create GitHub repositories table

  The github-sync edge function persists repository metadata with:
    .from("repos").upsert(rows, { onConflict: "repo_id" })

  That requires the repos table to exist and repo_id to be unique.
*/

CREATE TABLE IF NOT EXISTS repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  repo_id bigint NOT NULL UNIQUE,
  name text NOT NULL,
  full_name text NOT NULL,
  language text,
  stars integer NOT NULL DEFAULT 0,
  forks integer NOT NULL DEFAULT 0,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE repos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own repos"
  ON repos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_repos_user_id ON repos(user_id);
