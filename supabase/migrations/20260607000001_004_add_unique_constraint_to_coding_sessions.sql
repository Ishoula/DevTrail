/*
  Migration 005: Fix coding_sessions for session upserts from github-sync edge function.

  Problems fixed:
  1. No UPDATE policy on coding_sessions — upserts (insert-on-conflict-update) were
     blocked silently because RLS had no UPDATE rule.
  2. Missing unique constraint on (user_id, started_at) — without it, onConflict upserts
     in the edge function had no conflict target and silently inserted duplicates or failed.
*/

-- 1. Add unique constraint so upserts have a conflict target
ALTER TABLE coding_sessions
  ADD CONSTRAINT coding_sessions_user_started_unique UNIQUE (user_id, started_at);

-- 2. Add UPDATE policy so authenticated users (and service-role on their behalf) can update sessions
CREATE POLICY "Users can update own coding sessions"
  ON coding_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
