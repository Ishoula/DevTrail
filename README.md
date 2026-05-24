# DevTrack

DevTrack is a developer productivity dashboard for tracking projects, tasks, GitHub contribution activity, coding sessions, and weekly momentum. It ships with a public landing page, Supabase-backed authentication, protected dashboard routes, Kanban task management, analytics, and GitHub sync through a Supabase Edge Function.

## Features

- Public DevTrack homepage with calls to sign in or create an account
- Supabase email and password authentication
- Protected dashboard shell with sidebar and topbar navigation
- Project management with create, edit, archive, and delete flows
- Kanban task board with project, priority, status, and due-date fields
- GitHub Personal Access Token sync through a Supabase Edge Function
- Productivity dashboard for commits, coding streaks, tasks, and coding hours
- Analytics views for contribution and productivity trends
- Profile, notification, password, and GitHub integration settings
- Dark UI built with Tailwind CSS, shadcn/ui, Radix UI, and lucide-react

## Tech Stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, lucide-react
- **Charts:** Recharts
- **Backend:** Supabase Auth, PostgreSQL, Row Level Security, Edge Functions
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A Supabase project
- Optional: Supabase CLI for local migration and Edge Function workflows

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

Apply the SQL migrations in order from `supabase/migrations`:

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

They also enable Row Level Security and create ownership policies so each user can only access their own data.

## GitHub Sync

DevTrack includes one Supabase Edge Function:

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

The function expects these Supabase runtime secrets:

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
  (auth)/                 Login, register, OTP, and password reset pages
  (dashboard)/            Protected dashboard layout and dashboard pages
  globals.css             Global Tailwind styles and theme tokens
  layout.tsx              Root app layout and metadata
  page.tsx                Public DevTrack homepage
  providers.tsx           App providers
components/
  dashboard/              Sidebar and topbar components
  ui/                     shadcn/ui component set
hooks/
  use-toast.ts            Toast hook
lib/
  auth-context.tsx        Supabase auth provider
  supabase.ts             Supabase client and database types
  utils.ts                Shared utilities
supabase/
  functions/github-sync/  GitHub contribution sync Edge Function
  migrations/             Database schema and RLS policies
```

## Core Routes

- `/` - Public landing page
- `/login` - Sign in
- `/register` - Create account
- `/verify-otp` - Verify one-time password
- `/forgot-password` - Request password reset
- `/reset-password` - Set a new password
- `/dashboard` - Overview metrics and recent activity
- `/dashboard/projects` - Project management
- `/dashboard/tasks` - Kanban task board
- `/dashboard/analytics` - Productivity charts
- `/dashboard/settings` - Profile, GitHub, notifications, and security

## Deployment

DevTrack is deployed on Vercel. The app also includes Vercel Speed Insights through `@vercel/speed-insights`.

For deployment:

1. Connect the repository to Vercel.
2. Add the Supabase environment variables in the Vercel project settings.
3. Apply the Supabase migrations.
4. Deploy the `github-sync` Edge Function with the Supabase CLI.
5. Let Vercel build and deploy the Next.js app.

## Development Notes

- Authentication uses Supabase email/password auth.
- Dashboard routes redirect unauthenticated users to `/login`.
- Password reset uses `supabase.auth.resetPasswordForEmail()` and redirects back to `/reset-password`.
- GitHub tokens are currently saved in Supabase user metadata from the client. For production, move token storage to a server-controlled encrypted secret flow.
- Some dashboard metrics depend on synced GitHub data, so a new account may show empty charts until GitHub sync runs.
