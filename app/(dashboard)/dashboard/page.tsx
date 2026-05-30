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
  CircleCheck as CheckCircle2,
  TrendingUp,
  Flame,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

interface HeatmapDay {
  date: string;
  count: number;
}

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

  const [githubConnected, setGithubConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);

  const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&scope=read:user repo`;

  // =========================
  // LOAD DASHBOARD DATA
  // =========================
  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, status')
        .eq('user_id', user.id);

      const projectIds = projects?.map((p) => p.id) ?? [];

      const { data: tasks } = await supabase
        .from('tasks')
        .select('status, project_id')
        .in('project_id', projectIds.length ? projectIds : ['__none__']);

      const { data: commits } = await supabase
        .from('commits')
        .select('committed_at')
        .eq('user_id', user.id)
        .order('committed_at', { ascending: false })
        .limit(100);

      const { data: sessions } = await supabase
        .from('coding_sessions')
        .select('duration_minutes, started_at')
        .eq('user_id', user.id);

      const taskList = tasks ?? [];
      const commitList = commits ?? [];
      const sessionList = sessions ?? [];

      // =========================
      // TASK COUNTS
      // =========================
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
      // STREAK
      // =========================
      const commitDates = Array.from(
        new Set(commitList.map((c) => new Date(c.committed_at).toDateString()))
      ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

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
        date.setDate(now.getDate() - ((now.getDay() - i - 1 + 7) % 7));
        const dateStr = date.toDateString();

        return {
          day,
          commits: commitList.filter(
            (c) => new Date(c.committed_at).toDateString() === dateStr
          ).length,
          tasks: Math.floor(Math.random() * 3),
        };
      });

      // =========================
      // SESSION DATA
      // =========================
      const sessionData = days.map((day, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - ((now.getDay() - i - 1 + 7) % 7));
        const dateStr = date.toDateString();

        const daySessions = sessionList.filter(
          (s) => new Date(s.started_at).toDateString() === dateStr
        );

        return {
          day,
          hours:
            Math.round(
              (daySessions.reduce(
                (sum, s) => sum + (s.duration_minutes || 0),
                0
              ) /
                60) *
                10
            ) / 10,
        };
      });

      // =========================
      // RECENT ACTIVITY
      // =========================
      const recentActivity = [
        ...commitList.slice(0, 3).map((c) => ({
          id: `commit-${c.committed_at}`,
          type: 'commit',
          title: 'New commit pushed',
          time: new Date(c.committed_at).toLocaleDateString(),
        })),
      ].slice(0, 5);

      setData({
        projectCount: projects?.length ?? 0,
        taskCounts,
        commitCount: commitList.length,
        codingStreak: streak,
        productivityScore,
        weeklyData,
        sessionData,
        recentActivity,
      });

      setLoading(false);
    };

    fetchDashboard();
  }, [user]);

  // =========================
  // GITHUB CONNECTION STATE
  // =========================
  useEffect(() => {
    if (!user) return;

    const token = user.user_metadata?.github_token;
    setGithubConnected(!!token);
  }, [user]);

  // =========================
  // SYNC GITHUB (reads from edge function)
  // =========================
  const syncGitHub = async () => {
    if (!user) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        'github-sync',
        {
          body: {
            github_token: user.user_metadata?.github_token,
          },
        }
      );

      if (error) {
        setSyncResult(error.message);
        return;
      }

      if (data?.success) {
        setHeatmap(data.heatmap ?? []);
        setSyncResult(
          `🔥 ${data.streak} day streak • ⭐ ${data.total_contributions} contributions`
        );
      } else {
        setSyncResult(data?.error || 'Sync failed');
      }
    } catch {
      setSyncResult('Unexpected error');
    } finally {
      setSyncing(false);
    }
  };

  // =========================
  // LOADING STATE
  // =========================
  if (loading || !data) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your overview.
        </p>
      </div>

      {/* TOP CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p>Productivity</p>
            <h2 className="text-2xl font-bold">
              {data.productivityScore}%
            </h2>
            <Progress value={data.productivityScore} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p>Commits</p>
            <h2 className="text-2xl font-bold">{data.commitCount}</h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p>Streak</p>
            <h2 className="text-2xl font-bold">
              {data.codingStreak} days
            </h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p>Projects</p>
            <h2 className="text-2xl font-bold">
              {data.projectCount}
            </h2>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart width={400} height={250} data={data.weeklyData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Area dataKey="commits" />
              <Area dataKey="tasks" />
            </AreaChart>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coding Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart width={400} height={250} data={data.sessionData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Bar dataKey="hours" />
            </BarChart>
          </CardContent>
        </Card>
      </div>

      {/* GITHUB SYNC */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={syncGitHub} disabled={syncing}>
            <Github className="w-4 h-4 mr-2" />
            {syncing ? 'Syncing...' : 'Sync GitHub'}
          </Button>

          {syncResult && (
            <p className="text-sm text-muted-foreground">
              {syncResult}
            </p>
          )}

          {heatmap.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Heatmap loaded: {heatmap.length} days
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}