import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Code2,
  GitBranch,
  GitCommitHorizontal,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: LayoutDashboard,
    title: 'One dashboard for your dev work',
    description: 'Track active projects, tasks, coding streaks, commits, and productivity signals from one focused workspace.',
  },
  {
    icon: ListChecks,
    title: 'Kanban that stays close to the code',
    description: 'Plan, prioritize, review, and complete tasks with project context and due dates attached.',
  },
  {
    icon: GitBranch,
    title: 'GitHub contribution sync',
    description: 'Connect a GitHub token and pull contribution activity into your private productivity timeline.',
  },
  {
    icon: BarChart3,
    title: 'Analytics with momentum',
    description: 'See weekly commits, coding hours, streaks, and task completion patterns without spreadsheet wrangling.',
  },
];

const taskColumns = [
  { label: 'Todo', count: 6, color: 'bg-zinc-500' },
  { label: 'In Progress', count: 3, color: 'bg-blue-500' },
  { label: 'Review', count: 2, color: 'bg-amber-500' },
  { label: 'Done', count: 14, color: 'bg-emerald-500' },
];

const chartBars = [52, 76, 44, 88, 64, 92, 70];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative isolate min-h-[92vh] overflow-hidden border-b border-border/50 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_100%)]">
        <div className="absolute inset-x-0 top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="text-base font-bold">DevTrack</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">
                  Start tracking
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>

        <div className="absolute inset-0 opacity-45">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:64px_64px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,transparent_0%,hsl(var(--background))_68%)]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-4 pb-12 pt-28 sm:px-6 lg:px-8">
          <div className="max-w-3xl pb-8">
            <Badge variant="secondary" className="mb-5 border border-border/60 bg-secondary/70">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Developer productivity, without the noise
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal sm:text-6xl lg:text-7xl">
              DevTrack
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              A private command center for projects, tasks, GitHub activity, and weekly momentum. Know what moved, what is blocked, and where your focus is paying off.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full bg-background/60 sm:w-auto">
                <Link href="/login">Open dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card/80 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Weekly overview</span>
                </div>
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                  +18% focus
                </Badge>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-4">
                {[
                  ['Productivity', '82%', 'text-primary'],
                  ['Commits', '128', 'text-emerald-400'],
                  ['Streak', '11 days', 'text-amber-400'],
                  ['Projects', '7', 'text-blue-400'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-md border border-border/50 bg-background/70 p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-md border border-border/50 bg-background/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">Tasks</p>
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {taskColumns.map((column) => (
                      <div key={column.label} className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                        <span className="flex-1 text-sm">{column.label}</span>
                        <span className="text-sm font-semibold">{column.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border/50 bg-background/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">Coding hours</p>
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex h-36 items-end gap-3">
                    {chartBars.map((height, index) => (
                      <div key={index} className="flex h-full flex-1 flex-col items-center gap-2">
                        <div className="flex min-h-0 w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-sm bg-primary/80"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-border/60 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="mb-4 flex items-center gap-2">
                  <GitCommitHorizontal className="h-5 w-5 text-emerald-400" />
                  <p className="font-semibold">Latest activity</p>
                </div>
                <div className="space-y-4">
                  {['Synced 34 GitHub contributions', 'Completed auth polish', 'Reviewed analytics filters'].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="mb-4 flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <p className="font-semibold">Private by default</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Supabase auth, row-level security, and protected dashboard routes keep every user&apos;s work separated.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase text-primary">What DevTrack brings together</p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">
            Built for developers who want a clearer signal from their week.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-border/50 bg-card p-5">
              <feature.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/50 bg-card/45">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">Workflow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal">From plan to proof.</h2>
            <p className="mt-4 text-muted-foreground">
              DevTrack connects project planning with the activity that proves progress. Create tasks, move work across review, sync GitHub, and check the analytics when the week needs a reality check.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              ['1', 'Create projects and keep each task tied to the right repo or effort.'],
              ['2', 'Use the Kanban board to keep work moving through todo, progress, review, and completed.'],
              ['3', 'Sync GitHub contribution data and turn commits into a visible weekly trail.'],
            ].map(([step, text]) => (
              <div key={step} className="flex gap-4 rounded-lg border border-border/50 bg-background p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  {step}
                </span>
                <p className="text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
        <div>
          <h2 className="text-2xl font-bold tracking-normal">Ready to make your dev week measurable?</h2>
          <p className="mt-2 text-muted-foreground">Start with projects and tasks, then connect GitHub when you are ready.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/register">Get started</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
