/*
  Store GitHub's contribution calendar by user and calendar date.
  The composite unique key supports idempotent syncs and prevents duplicates.
*/

CREATE TABLE IF NOT EXISTS github_heatmap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_date date NOT NULL,
  contribution_count integer NOT NULL DEFAULT 0 CHECK (contribution_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_heatmap_user_date_unique UNIQUE (user_id, contribution_date)
);

ALTER TABLE github_heatmap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own GitHub heatmap" ON github_heatmap;
CREATE POLICY "Users can read own GitHub heatmap"
  ON github_heatmap FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_github_heatmap_user_date
  ON github_heatmap(user_id, contribution_date);

NOTIFY pgrst, 'reload schema';
