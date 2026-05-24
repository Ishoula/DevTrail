/*
  # Create projects, tasks, commits, coding_sessions, notifications tables

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `description` (text)
      - `color` (text, hex color for project badge)
      - `status` (text, 'active' | 'archived')
      - `github_repo` (text, optional linked repo)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `tasks`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `title` (text)
      - `description` (text)
      - `status` (text, 'todo' | 'in_progress' | 'review' | 'completed')
      - `priority` (text, 'low' | 'medium' | 'high')
      - `due_date` (date, optional)
      - `position` (integer, for kanban ordering)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `commits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `project_id` (uuid, optional references projects)
      - `sha` (text, GitHub commit SHA)
      - `message` (text)
      - `repository` (text)
      - `committed_at` (timestamptz)
      - `additions` (integer)
      - `deletions` (integer)
      - `created_at` (timestamptz)
    - `coding_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)
      - `duration_minutes` (integer)
      - `commit_count` (integer)
      - `created_at` (timestamptz)
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text, 'task' | 'deadline' | 'github' | 'system')
      - `title` (text)
      - `message` (text)
      - `read` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only CRUD their own data
    - Tasks inherit access from project ownership
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  github_repo text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date date,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read tasks in own projects"
  ON tasks FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create tasks in own projects"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update tasks in own projects"
  ON tasks FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete tasks in own projects"
  ON tasks FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  sha text NOT NULL,
  message text NOT NULL DEFAULT '',
  repository text NOT NULL DEFAULT '',
  committed_at timestamptz NOT NULL,
  additions integer DEFAULT 0,
  deletions integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own commits"
  ON commits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own commits"
  ON commits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own commits"
  ON commits FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS coding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 0,
  commit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coding sessions"
  ON coding_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own coding sessions"
  ON coding_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own coding sessions"
  ON coding_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task', 'deadline', 'github', 'system')),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_commits_user_id ON commits(user_id);
CREATE INDEX idx_coding_sessions_user_id ON coding_sessions(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
