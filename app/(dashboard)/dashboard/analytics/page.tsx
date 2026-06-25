'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { GitCommitHorizontal, Clock, Flame, TrendingUp, Timer } from 'lucide-react';

const commitChartConfig = {
  commits: { label: 'Commits', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

const hoursChartConfig = {
  hours: { label: 'Hours', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const repoChartConfig = {
  count: { label: 'Commits', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

interface SessionDetail {
  id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
}

interface AnalyticsData {
  totalCommits: number;
  totalHours: number;
  longestStreak: number;
  currentStreak: number;
  avgDailyCommits: number;
  commitTrend: { date: string; commits: number }[];
  hoursTrend: { date: string; hours: number }[];
  repoBreakdown: { repo: string; count: number }[];
  heatmapData: { day: number; hour: number; value: number }[];
  recentSessions: SessionDetail[];
}

/** Format minutes as "Xh Ym" or "Ym" */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAnalytics = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (user.user_metadata?.wakatime_api_key && accessToken) {
        const { error } = await supabase.functions.invoke('wakatime-sync', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (error) {
          console.error('Failed to sync WakaTime data:', error);
        }
      }

      const [commitsRes, sessionsRes] = await Promise.all([
        supabase
          .from('commits')
          .select('*')
          .eq('user_id', user.id)
          .order('committed_at', { ascending: true }),
        supabase
          .from('coding_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false }), // newest first for the details card
      ]);

      const commits = commitsRes.data || [];
      const sessions = sessionsRes.data || [];

      // ── Commit trend (last 30 days) ──────────────────────────────────────
      const now = new Date();
      const commitTrend = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (29 - i));
        const dateStr = date.toISOString().split('T')[0];
        return {
          date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          commits: commits.filter(
            (c) => new Date(c.committed_at).toISOString().split('T')[0] === dateStr
          ).length,
        };
      });

      // ── Hours trend (last 30 days) ────────────────────────────────────────
      const hoursTrend = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (29 - i));
        const dateStr = date.toDateString();
        const daySessions = sessions.filter(
          (s) => new Date(s.started_at).toDateString() === dateStr
        );
        return {
          date: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          hours:
            Math.round(
              (daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60) * 10
            ) / 10,
        };
      });

      // ── Repo breakdown ───────────────────────────────────────────────────
      const repoMap = new Map<string, number>();
      commits.forEach((c) => {
        const repo = c.repository || 'unknown';
        repoMap.set(repo, (repoMap.get(repo) || 0) + 1);
      });
      const repoBreakdown = Array.from(repoMap.entries())
        .map(([repo, count]) => ({ repo: repo.split('/').pop() || repo, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // ── Streaks ──────────────────────────────────────────────────────────
      const commitDates = Array.from(
        new Set(commits.map((c) => new Date(c.committed_at).toDateString()))
      ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      let currentStreak = 0;
      for (let i = 0; i < commitDates.length; i++) {
        const expected = new Date(now);
        expected.setDate(now.getDate() - i);
        if (commitDates[i] === expected.toDateString()) {
          currentStreak++;
        } else {
          break;
        }
      }

      let longestStreak = 0;
      let tempStreak    = 1;
      for (let i = 1; i < commitDates.length; i++) {
        const prev     = new Date(commitDates[i - 1]);
        const curr     = new Date(commitDates[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak, commitDates.length > 0 ? 1 : 0);

      // ── Heatmap (day-of-week × hour-of-day) ─────────────────────────────
      const heatmapData: { day: number; hour: number; value: number }[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const count = commits.filter((c) => {
            const d = new Date(c.committed_at);
            return d.getDay() === day && d.getHours() === hour;
          }).length;
          if (count > 0) heatmapData.push({ day, hour, value: count });
        }
      }

      // ── All-time totals ──────────────────────────────────────────────────
      const totalHours =
        Math.round(
          (sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60) * 10
        ) / 10;

      const avgDailyCommits =
        commits.length > 0 ? Math.round((commits.length / 30) * 10) / 10 : 0;

      // ── Recent sessions (newest 10) ──────────────────────────────────────
      const recentSessions: SessionDetail[] = sessions.slice(0, 10).map((s) => ({
        id:               s.id,
        started_at:       s.started_at,
        ended_at:         s.ended_at,
        duration_minutes: s.duration_minutes,
      }));

      setData({
        totalCommits: commits.length,
        totalHours,
        longestStreak,
        currentStreak,
        avgDailyCommits,
        commitTrend,
        hoursTrend,
        repoBreakdown,
        heatmapData,
        recentSessions,
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, [user]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Your productivity insights</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse border-border/50">
              <CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxHeatmap = Math.max(...data.heatmapData.map((d) => d.value), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Your productivity insights</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Commits</p>
                <p className="mt-1 text-2xl font-bold sm:text-3xl">{data.totalCommits}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitCommitHorizontal className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Total Coding Hours</p>
              <p className="mt-1 text-2xl font-bold sm:text-3xl">{data.totalHours}h</p>
            </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="mt-1 text-2xl font-bold sm:text-3xl">
                  {data.currentStreak}{' '}
                  <span className="text-base font-normal text-muted-foreground">days</span>
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Avg Daily Commits</p>
                <p className="mt-1 text-2xl font-bold sm:text-3xl">{data.avgDailyCommits}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 1 ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Commit Activity</CardTitle>
            <CardDescription>Daily commits over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-chart -mx-2 overflow-x-auto pb-3 sm:mx-0">
              <ChartContainer config={commitChartConfig} className="h-[240px] min-w-[620px] sm:h-[280px] sm:min-w-0">
                <AreaChart data={data.commitTrend} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} interval={6} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="commits" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Coding Hours</CardTitle>
            <CardDescription>Daily hours from WakaTime (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-chart -mx-2 overflow-x-auto pb-3 sm:mx-0">
              <ChartContainer config={hoursChartConfig} className="h-[240px] min-w-[620px] sm:h-[280px] sm:min-w-0">
                <AreaChart data={data.hoursTrend} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} interval={6} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="hours" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 2 ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Repository Breakdown</CardTitle>
            <CardDescription>Commits per repository</CardDescription>
          </CardHeader>
          <CardContent>
            {data.repoBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No repository data yet</p>
            ) : (
              <div className="scrollbar-chart -mx-2 overflow-x-auto pb-3 sm:mx-0">
                <ChartContainer config={repoChartConfig} className="h-[250px] min-w-[520px] sm:min-w-0">
                  <BarChart data={data.repoBreakdown} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="repo" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Commit Heatmap</CardTitle>
            <CardDescription>Activity by day and hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-chart -mx-2 overflow-x-auto pb-3 sm:mx-0">
              <div className="min-w-[680px] space-y-1">
                <div className="flex items-center gap-1 pl-8">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className="w-6 text-center text-[9px] text-muted-foreground">{i * 2}</span>
                  ))}
                </div>
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-1">
                    <span className="w-7 text-[9px] text-muted-foreground">{day}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const entry     = data.heatmapData.find((d) => d.day === dayIdx && d.hour === hour);
                        const intensity = entry ? entry.value / maxHeatmap : 0;
                        return (
                          <div
                            key={hour}
                            className="h-4 w-6 rounded-sm"
                            style={{
                              backgroundColor:
                                intensity > 0
                                  ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`
                                  : 'hsl(var(--secondary))',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Streak history ──────────────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Streak History</CardTitle>
          <CardDescription>Longest streak: {data.longestStreak} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">{data.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Current</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold">{data.longestStreak}</p>
              <p className="text-xs text-muted-foreground">Longest</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold">{data.avgDailyCommits}</p>
              <p className="text-xs text-muted-foreground">Avg/Day</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Session details ─────────────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-emerald-500" />
            Coding Activity
          </CardTitle>
          <CardDescription>
            Daily coding time synced from WakaTime
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentSessions.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-sm text-muted-foreground">No WakaTime data synced yet.</p>
              <p className="text-xs text-muted-foreground">Save your WakaTime API key in Settings, then sync.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentSessions.map((session) => {
                const start = new Date(session.started_at);
                const dateLabel = start.toLocaleDateString('en', {
                  weekday: 'short',
                  month:   'short',
                  day:     'numeric',
                });
                const timeLabel = start.toLocaleTimeString('en', {
                  hour:   '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dateLabel}</p>
                        <p className="text-xs text-muted-foreground">Started {timeLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {formatDuration(session.duration_minutes)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        WakaTime
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
