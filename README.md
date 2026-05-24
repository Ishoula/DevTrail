# DevTrack

DevTrack is a developer productivity dashboard built with Next.js, Supabase, TypeScript, Tailwind CSS, and shadcn/ui. It helps users manage projects and tasks, sync GitHub contribution activity, and review productivity metrics from a protected dashboard.

> Note: the public homepage at `/` is currently styled and branded as a `bydrive` car-rental landing page. The authenticated app experience is branded as DevTrack.

## Features

- Supabase email/password authentication
- Protected dashboard routes
- Project management with create, edit, archive, and delete flows
- Kanban-style task board with project, priority, status, and due-date fields
- GitHub Personal Access Token sync through a Supabase Edge Function
- Productivity analytics for commits, coding hours, streaks, repository activity, and heatmaps
- User profile, notification, password, and GitHub settings
- Dark UI built with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, lucide-react
- **Charts:** Recharts
- **Backend:** Supabase Auth, PostgreSQL, Row Level Security, Edge Functions
- **Deployment:** Netlify-ready configuration

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A Supabase project
- Optional: Supabase CLI for local migration/function workflows

### Install

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also supported as a fallback for the anon key.

### Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

Apply the SQL migrations in order from the `supabase/migrations` directory:

1. `20260508093739_001_create_profiles_and_otp_tables.sql`
2. `20260508093807_002_create_projects_tasks_commits_sessions_notifications.sql`

These migrations create:

- `profiles`
- `email_otps`
- `projects`
- `tasks`
- `commits`
- `coding_sessions`
- `notifications`

They also enable Row Level Security and create ownership policies so users can only access their own data.

## GitHub Sync Edge Function

The project includes one Supabase Edge Function:

```text
supabase/functions/github-sync/index.ts
```

The function:

- Authenticates the current Supabase user from the request JWT
- Uses a GitHub Personal Access Token to fetch the GitHub username
- Queries GitHub GraphQL contribution data for the last year
- Refreshes saved GitHub contribution rows in the `commits` table
- Returns sync counts to the Settings page

Deploy it with the Supabase CLI:

```bash
supabase functions deploy github-sync
```

The function expects Supabase-provided runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Users connect GitHub from `Dashboard > Settings > GitHub` with a Personal Access Token using the `repo` and `read:user` scopes.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Project Structure

```text
app/
  (auth)/                 Auth pages
  (dashboard)/            Protected dashboard shell and pages
  page.tsx                Public landing page
components/
  dashboard/              Sidebar and topbar
  ui/                     shadcn/ui component set
hooks/
  use-toast.ts            Toast hook
lib/
  auth-context.tsx        Supabase auth provider
  supabase.ts             Supabase client and database types
  utils.ts                Shared utilities
supabase/
  functions/github-sync/  GitHub contribution sync function
  migrations/             Database schema and RLS policies
```

## Core Routes

- `/` - Public landing page
- `/login` - Sign in
- `/register` - Create account
- `/forgot-password` - Request password reset
- `/reset-password` - Set a new password
- `/dashboard` - Overview metrics and activity
- `/dashboard/projects` - Project management
- `/dashboard/tasks` - Kanban task board
- `/dashboard/analytics` - Productivity charts
- `/dashboard/settings` - Profile, GitHub, notifications, and security

## Deployment

This repository includes `netlify.toml` with the Netlify Next.js plugin:

```toml
[build]
command = "npx next build"
publish = ".next"

[[plugins]]
package = "@netlify/plugin-nextjs"
```

For deployment:

1. Connect the repository to Netlify.
2. Add the Supabase environment variables.
3. Apply the Supabase migrations.
4. Deploy the `github-sync` Edge Function.
5. Build and deploy the Next.js app.

## Development Notes

- Authentication uses Supabase email/password auth.
- Password reset uses `supabase.auth.resetPasswordForEmail()` and redirects back to `/reset-password`.
- GitHub tokens are currently saved in Supabase user metadata from the client. For production, move token storage to a server-controlled encrypted secret flow.
- Some dashboard metrics depend on synced GitHub data, so a new account may show empty charts until GitHub sync runs.
