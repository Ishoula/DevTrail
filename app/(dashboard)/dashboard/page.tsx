'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Clock,
  GitCommitHorizontal,
  FolderKanban,
  Flame,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

interface DashboardData {
  projectCount: number;
  taskCounts: {
    todo: number;
    in_progress: number;
    review: number;
    completed: number;
  };
  commitCount: number;
  codingStreak: number;
  totalCodingHours: number;
  productivityScore: number;
  taskStatusData: { status: string; tasks: number }[];
  sessionData: { day: string; hours: number }[];
  recentActivity: { id: string; type: string; title: string; time: string }[];
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [githubStreak, setGithubStreak] = useState(0);
  const [totalContributions, setTotalContributions] = useState(0);
  const [reposSynced, setReposSynced] = useState(0);

  // =========================
  // FETCH DASHBOARD DATA
  // =========================
  async function fetchDashboard() {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('user_id', user!.id);

    const projectIds = projects?.map((p) => p.id) ?? [];

    const tasks = projectIds.length
      ? (
          await supabase
            .from('tasks')
            .select('status, project_id')
            .in('project_id', projectIds)
        ).data ?? []
      : [];

    const { data: rawCommits } = await supabase
      .from('commits')
      .select('committed_at')
      .eq('user_id', user!.id)
      .order('committed_at', { ascending: true });

    const { data: dbSessions } = await supabase
      .from('coding_sessions')
      .select('duration_minutes, started_at')
      .eq('user_id', user!.id);

    // ── Client-side session fallback ──
    // If no persisted sessions exist yet (migration/redeploy pending),
    // compute sessions from commits directly in the browser.
    const SESSION_BREAK_MS  = 120 * 60 * 1000;
    const INITIAL_BUFFER_MS =  30 * 60 * 1000;
    const FINAL_BUFFER_MS   =  10 * 60 * 1000;

    function computeWeeklySessions(commitRows: { committed_at: string }[]) {
      if (commitRows.length === 0) return [];
      const ts = commitRows.map((c) => new Date(c.committed_at).getTime());
      const result: { duration_minutes: number; started_at: string }[] = [];
      let start = ts[0], end = ts[0], count = 1;
      for (let i = 1; i < ts.length; i++) {
        if (ts[i] - ts[i - 1] > SESSION_BREAK_MS) {
          const s = start - INITIAL_BUFFER_MS, e = end + FINAL_BUFFER_MS;
          result.push({ started_at: new Date(s).toISOString(), duration_minutes: Math.round((e - s) / 60_000) });
          start = ts[i]; count = 1;
        } else { count++; }
        end = ts[i];
      }
      const s = start - INITIAL_BUFFER_MS, e = end + FINAL_BUFFER_MS;
      result.push({ started_at: new Date(s).toISOString(), duration_minutes: Math.round((e - s) / 60_000) });
      return result;
    }

    const sessions =
      (dbSessions && dbSessions.length > 0)
        ? dbSessions
        : computeWeeklySessions(rawCommits ?? []);

    // Keep the last-100 commits for streak / recent-activity (descending)
    const commits = [...(rawCommits ?? [])].reverse().slice(0, 100);

    // =========================
    // GITHUB STATS ONLY
    // =========================
    const { data: githubStats } = await supabase
      .from('github_stats')
      .select(`
        github_username,
        streak,
        total_contributions,
        repos_synced,
        updated_at
      `)
      .eq('user_id', user!.id)
      .maybeSingle();

    // =========================
    // TASK PROCESSING
    // =========================
    const taskList = tasks ?? [];

    const taskCounts = {
      todo: taskList.filter((t) => t.status === 'todo').length,
      in_progress: taskList.filter((t) => t.status === 'in_progress').length,
      review: taskList.filter((t) => t.status === 'review').length,
      completed: taskList.filter((t) => t.status === 'completed').length,
    };

    const totalTasks = taskList.length;
    const productivityScore =
      totalTasks > 0
        ? Math.round((taskCounts.completed / totalTasks) * 100)
        : 0;

    // =========================
    // STREAK CALCULATION
    // =========================
    const commitDates = Array.from(
      new Set(
        (commits ?? []).map((c) =>
          new Date(c.committed_at).toDateString()
        )
      )
    ).sort(
      (a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
    );

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < commitDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);

      if (commitDates[i] === expected.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    const taskStatusData = [
      { status: 'Todo', tasks: taskCounts.todo },
      { status: 'In Progress', tasks: taskCounts.in_progress },
      { status: 'Review', tasks: taskCounts.review },
      { status: 'Completed', tasks: taskCounts.completed },
    ];

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - distanceToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weeklySessions = (sessions ?? []).filter((session) => {
      const startedAt = new Date(session.started_at);
      return startedAt >= weekStart && startedAt < weekEnd;
    });

    // All-time total — weekly filter would return 0 if commits aren't from this week
    const totalCodingMinutes = (sessions ?? []).reduce(
      (sum, session) => sum + (session.duration_minutes || 0),
      0
    );
    const totalCodingHours =
      Math.round((totalCodingMinutes / 60) * 10) / 10;

    // =========================
    // SESSION DATA
    // =========================
    const sessionData = days.map((day, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      const dateStr = date.toDateString();

      const daySessions = weeklySessions.filter(
        (s) =>
          new Date(s.started_at).toDateString() === dateStr
      );

      return {
        day,
        hours:
          Math.round(
            (daySessions.reduce(
              (sum, s) =>
                sum + (s.duration_minutes || 0),
              0
            ) /
              60) *
              10
          ) / 10,
      };
    });

    // =========================
    // SET MAIN DATA
    // =========================
    setData({
      projectCount: projects?.length ?? 0,
      taskCounts,
      commitCount: commits?.length ?? 0,
      codingStreak: streak,
      totalCodingHours,
      productivityScore,
      taskStatusData,
      sessionData,
      recentActivity: (commits ?? [])
        .slice(0, 3)
        .map((c) => ({
          id: `commit-${c.committed_at}`,
          type: 'commit',
          title: 'New commit pushed',
          time: new Date(
            c.committed_at
          ).toLocaleString(),
        })),
    });

    // =========================
    // GITHUB STATS SET
    // =========================
    if (githubStats) {
      setGithubStreak(githubStats.streak ?? 0);
      setTotalContributions(
        githubStats.total_contributions ?? 0
      );
      setReposSynced(
        githubStats.repos_synced ?? 0
      );
    }

    setLoading(false);
  }

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    if (user) fetchDashboard();
  }, [user]);

  // =========================
  // SYNC GITHUB
  // =========================
  const syncGitHub = async () => {
    if (!user) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const { data: sessionData } =
        await supabase.auth.getSession();
      const accessToken =
        sessionData.session?.access_token;

      if (!accessToken) {
        setSyncResult('No session found');
        setSyncing(false);
        return;
      }

      const { data, error } =
        await supabase.functions.invoke(
          'github-sync',
          {
            body: {
              github_token:
                user.user_metadata?.github_token,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

      if (error) {
        setSyncResult(error.message);
        return;
      }

      if (data?.success) {
        await fetchDashboard();
        setSyncResult(
          'GitHub synced successfully'
        );
      } else {
        setSyncResult(
          data?.error || 'Sync failed'
        );
      }
    } catch {
      setSyncResult('Unexpected error');
    } finally {
      setSyncing(false);
    }
  };

  // =========================
  // LOADING
  // =========================
  if (loading || !data) {
    return (
      <div className="p-6">
        Loading dashboard...
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="space-y-6">
      {/* GITHUB STATS */}
      <Card>
        <CardHeader>
          <CardTitle>
            GitHub Stats
          </CardTitle>
          <CardDescription>
            Synced from your GitHub account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            onClick={syncGitHub}
            disabled={syncing}
          >
            <Github className="w-4 h-4 mr-2" />
            {syncing
              ? 'Syncing...'
              : 'Sync GitHub'}
          </Button>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Streak</span>
              </div>
              <p className="text-2xl font-bold">
                {githubStreak}
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="w-4 h-4" />
                <span>Contributions</span>
              </div>
              <p className="text-2xl font-bold">
                {totalContributions}
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                <span>Repos</span>
              </div>
              <p className="text-2xl font-bold">
                {reposSynced}
              </p>
            </div>
          </div>

          {syncResult && (
            <p className="text-sm text-muted-foreground">
              {syncResult}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Coding Hours
            </CardTitle>
            <CardDescription>
              All-time estimated from commits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.totalCodingHours.toFixed(1)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4" />
              Projects
            </CardTitle>
            <CardDescription>
              Active workspace projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.projectCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Tasks by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              width={400}
              height={250}
              data={data.taskStatusData}
            >
              <XAxis dataKey="status" />
              <YAxis allowDecimals={false} />
              <Bar dataKey="tasks" />
            </BarChart>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Coding Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              width={400}
              height={250}
              data={data.sessionData}
            >
              <XAxis dataKey="day" />
              <YAxis />
              <Bar dataKey="hours" />
            </BarChart>
          </CardContent>
        </Card>
      </div>

      
    </div>
  );
}
