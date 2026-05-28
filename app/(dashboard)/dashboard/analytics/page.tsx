'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface AnalyticsData {
  totalCommits: number;
  repoBreakdown: { repo: string; count: number }[];
  heatmap: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      const { data: commits } = await supabase
        .from('commits')
        .select('committed_at, repository')
        .eq('user_id', user.id);

      const rows = commits || [];

      // =========================
      // REPO BREAKDOWN
      // =========================
      const repoMap = new Map<string, number>();

      rows.forEach((c) => {
        const repo = c.repository || 'unknown';
        repoMap.set(repo, (repoMap.get(repo) || 0) + 1);
      });

      const repoBreakdown = Array.from(repoMap.entries()).map(
        ([repo, count]) => ({
          repo: repo.split('/').pop() || repo,
          count,
        })
      );

      // =========================
      // STREAKS
      // =========================
      const days = Array.from(
        new Set(rows.map((c) => new Date(c.committed_at).toDateString()))
      ).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      );

      let currentStreak = 0;
      const today = new Date();

      for (let i = 0; i < days.length; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);

        if (days.includes(d.toDateString())) {
          currentStreak++;
        } else break;
      }

      let longest = 0;
      let temp = 1;

      for (let i = 1; i < days.length; i++) {
        const diff =
          (new Date(days[i - 1]).getTime() -
            new Date(days[i]).getTime()) /
          (1000 * 60 * 60 * 24);

        if (diff === 1) {
          temp++;
          longest = Math.max(longest, temp);
        } else {
          temp = 1;
        }
      }

      // =========================
      // HEATMAP (simplified but accurate)
      // =========================
      const heatmap: Record<string, number> = {};

      rows.forEach((c) => {
        const d = new Date(c.committed_at);
        const key = `${d.getDay()}-${d.getHours()}`;
        heatmap[key] = (heatmap[key] || 0) + 1;
      });

      setData({
        totalCommits: rows.length,
        repoBreakdown,
        heatmap,
        currentStreak,
        longestStreak: Math.max(longest, currentStreak),
      });
    };

    fetchAnalytics();
  }, [user]);

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <h1>Analytics</h1>

      <p>Total commits: {data.totalCommits}</p>
      <p>Current streak: {data.currentStreak}</p>
      <p>Longest streak: {data.longestStreak}</p>

      <h2>Repos</h2>
      <ul>
        {data.repoBreakdown.map((r) => (
          <li key={r.repo}>
            {r.repo}: {r.count}
          </li>
        ))}
      </ul>
    </div>
  );
}