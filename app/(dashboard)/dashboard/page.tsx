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
import { Progress } from '@/components/ui/progress';
import {
  GitCommitHorizontal,
  FolderKanban,
  Flame,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
  productivityScore: number;
  weeklyData: { day: string; commits: number; tasks: number }[];
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

    const { data: tasks } = await supabase
      .from('tasks')
      .select('status, project_id')
      .in('project_id', projectIds.length ? projectIds : ['__none__']);

    const { data: commits } = await supabase
      .from('commits')
      .select('committed_at')
      .eq('user_id', user!.id)
      .order('committed_at', { ascending: false })
      .limit(100);

    const { data: sessions } = await supabase
      .from('coding_sessions')
      .select('duration_minutes, started_at')
      .eq('user_id', user!.id);

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

    // =========================
    // WEEKLY DATA
    // =========================
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();

    const weeklyData = days.map((day, i) => {
      const date = new Date(now);
      date.setDate(
        now.getDate() -
          ((now.getDay() - i - 1 + 7) % 7)
      );

      const dateStr = date.toDateString();

      return {
        day,
        commits: (commits ?? []).filter(
          (c) =>
            new Date(c.committed_at).toDateString() === dateStr
        ).length,
        tasks: Math.floor(Math.random() * 3),
      };
    });

    // =========================
    // SESSION DATA
    // =========================
    const sessionData = days.map((day, i) => {
      const date = new Date(now);
      date.setDate(
        now.getDate() -
          ((now.getDay() - i - 1 + 7) % 7)
      );

      const dateStr = date.toDateString();

      const daySessions = (sessions ?? []).filter(
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
      productivityScore,
      weeklyData,
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

      {/* CHARTS */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              width={400}
              height={250}
              data={data.weeklyData}
            >
              <XAxis dataKey="day" />
              <YAxis />
              <Area dataKey="commits" />
              <Area dataKey="tasks" />
            </AreaChart>
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