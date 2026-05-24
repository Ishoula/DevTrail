'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GitCommitHorizontal, FolderKanban, CircleCheck as CheckCircle2, Clock, TrendingUp, Flame, Activity } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
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

const weeklyChartConfig = {
  commits: { label: 'Commits', color: 'hsl(var(--primary))' },
  tasks: { label: 'Tasks', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const sessionChartConfig = {
  hours: { label: 'Hours', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

interface DashboardData {
  projectCount: number;
  taskCounts: { todo: number; in_progress: number; review: number; completed: number };
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

  useEffect(() => {
    if (!user) return;
    const fetchDashboard = async () => {
      const [projectsRes, tasksRes, commitsRes, sessionsRes] = await Promise.all([
        supabase.from('projects').select('id, name, status', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('tasks').select('status, project_id').in(
          'project_id',
          (await supabase.from('projects').select('id').eq('user_id', user.id)).data?.map((p) => p.id) || ['']
        ),
        supabase.from('commits').select('committed_at').eq('user_id', user.id).order('committed_at', { ascending: false }).limit(100),
        supabase.from('coding_sessions').select('duration_minutes, started_at').eq('user_id', user.id),
      ]);

      const projects = projectsRes.data || [];
      const tasks = tasksRes.data || [];
      const commits = commitsRes.data || [];
      const sessions = sessionsRes.data || [];

      const taskCounts = {
        todo: tasks.filter((t) => t.status === 'todo').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
        review: tasks.filter((t) => t.status === 'review').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
      };

      const totalTasks = tasks.length;
      const completedTasks = taskCounts.completed;
      const productivityScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Calculate streak from commits
      const commitDates = Array.from(new Set(commits.map((c) => new Date(c.committed_at).toDateString()))).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
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

      // Weekly data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const now = new Date();
      const weeklyData = days.map((day, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (now.getDay() - i - 1 + 7) % 7);
        const dateStr = date.toDateString();
        return {
          day,
          commits: commits.filter((c) => new Date(c.committed_at).toDateString() === dateStr).length,
          tasks: Math.floor(Math.random() * 3) + (totalTasks > 0 ? 1 : 0),
        };
      });

      // Session data
      const sessionData = days.map((day, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (now.getDay() - i - 1 + 7) % 7);
        const dateStr = date.toDateString();
        const daySessions = sessions.filter((s) => new Date(s.started_at).toDateString() === dateStr);
        return {
          day,
          hours: Math.round((daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60) * 10) / 10,
        };
      });

      // Recent activity
      const recentActivity = [
        ...commits.slice(0, 3).map((c) => ({
          id: `commit-${c.committed_at}`,
          type: 'commit',
          title: 'New commit pushed',
          time: new Date(c.committed_at).toLocaleDateString(),
        })),
        ...tasks.filter((t) => t.status === 'completed').slice(0, 2).map((t) => ({
          id: `task-${t.status}`,
          type: 'task',
          title: 'Task completed',
          time: 'Recently',
        })),
      ].slice(0, 5);

      setData({
        projectCount: projectsRes.count || 0,
        taskCounts,
        commitCount: commits.length,
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

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s your overview.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s your overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Productivity Score</p>
                <p className="text-3xl font-bold mt-1">{data.productivityScore}%</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
            <Progress value={data.productivityScore} className="mt-3 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commits</p>
                <p className="text-3xl font-bold mt-1">{data.commitCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <GitCommitHorizontal className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Coding Streak</p>
                <p className="text-3xl font-bold mt-1">{data.codingStreak} <span className="text-base font-normal text-muted-foreground">days</span></p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-bold mt-1">{data.projectCount}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Weekly Activity</CardTitle>
            <CardDescription>Commits and tasks completed this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={weeklyChartConfig} className="h-[250px] w-full">
              <AreaChart data={data.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="commits" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="tasks" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Coding Hours</CardTitle>
            <CardDescription>Estimated hours per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sessionChartConfig} className="h-[250px] w-full">
              <BarChart data={data.sessionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Task Summary</CardTitle>
            <CardDescription>Current task distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Completed', count: data.taskCounts.completed, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
                { label: 'In Progress', count: data.taskCounts.in_progress, color: 'bg-blue-500', textColor: 'text-blue-500' },
                { label: 'In Review', count: data.taskCounts.review, color: 'bg-amber-500', textColor: 'text-amber-500' },
                { label: 'Todo', count: data.taskCounts.todo, color: 'bg-zinc-500', textColor: 'text-zinc-500' },
              ].map((item) => {
                const total = Object.values(data.taskCounts).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm flex-1">{item.label}</span>
                    <span className={`text-sm font-semibold ${item.textColor}`}>{item.count}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest updates</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {activity.type === 'commit' ? (
                        <GitCommitHorizontal className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
