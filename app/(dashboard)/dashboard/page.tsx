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
  contribution_date: string;
  contribution_count: number | null;
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
  const [githubStreak, setGithubStreak] = useState<number>(0);
  const [totalContributions, setTotalContributions] = useState<number>(0);
  const [reposSynced, setReposSynced] = useState<number>(0);

  const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&scope=read:user repo`;

  // =========================
  // GITHUB CONNECTION STATE
  // Fetch dashboard core data
  async function fetchDashboard() {
    // Core project/data queries
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

    // New: fetch GitHub stats and heatmap
    const { data: githubStats } = await supabase
      .from('github_stats')
      .select('*')
      .eq('user_id', user!.id)
      .single();

    const { data: githubHeatmap } = await supabase
      .from('github_heatmap')
      .select('contribution_date,contribution_count')
      .eq('user_id', user!.id);

    // Process task counts
    const taskList = tasks ?? [];
    const taskCounts = {
      todo: taskList.filter((t) => t.status === 'todo').length,
      in_progress: taskList.filter((t) => t.status === 'in_progress').length,
      review: taskList.filter((t) => t.status === 'review').length,
      completed: taskList.filter((t) => t.status === 'completed').length,
    };

    const totalTasks = taskList.length;
    const productivityScore = totalTasks > 0 ? Math.round((taskCounts.completed / totalTasks) * 100) : 0;

    // Streak calculation
    const commitDates = Array.from(
      new Set(
        (commits ?? []).map((c) => new Date(c.committed_at).toDateString())
      )
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

    // Weekly and session data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const weeklyData = days.map((day, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - ((now.getDay() - i - 1 + 7) % 7));
      const dateStr = date.toDateString();
      return {
        day,
        commits: (commits ?? []).filter((c) => new Date(c.committed_at).toDateString() === dateStr).length,
        tasks: Math.floor(Math.random() * 3),
      };
    });

    const sessionData = days.map((day, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - ((now.getDay() - i - 1 + 7) % 7));
      const dateStr = date.toDateString();
      const daySessions = (sessions ?? []).filter((s) => new Date(s.started_at).toDateString() === dateStr);
      return {
        day,
        hours: Math.round((daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60) * 10) / 10,
      };
    });

    // Recent activity (commits only for simplicity)
    const recentActivity = (commits ?? []).slice(0, 3).map((c) => ({
      id: `commit-${c.committed_at}`,
      type: 'commit',
      title: 'New commit pushed',
      time: new Date(c.committed_at).toLocaleString(),
    }));

    // Set state
    setData({
      projectCount: projects?.length ?? 0,
      taskCounts,
      commitCount: commits?.length ?? 0,
      codingStreak: streak,
      productivityScore,
      weeklyData,
      sessionData,
      recentActivity,
    });

    // Update GitHub related UI state
    setHeatmap(githubHeatmap ?? []);
    if (githubStats) {
      const { streak, total_contributions, repos_synced } = githubStats;
      setGithubStreak(streak ?? 0);
      setTotalContributions(total_contributions ?? 0);
      setReposSynced(repos_synced ?? 0);
      setSyncResult(`🔥 ${streak ?? 0} day streak • ⭐ ${total_contributions ?? 0} contributions • 📦 ${repos_synced ?? 0} repos`);
    }

    setLoading(false);
  }

  // =========================
  // LOAD DASHBOARD DATA
  // =========================
  useEffect(() => {
    if (user) {
      fetchDashboard();
    }
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

          {githubStreak > 0 && (
            <p className="text-sm text-muted-foreground">
              🔥 {githubStreak} day streak • ⭐ {totalContributions} contributions • 📦 {reposSynced} repos
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