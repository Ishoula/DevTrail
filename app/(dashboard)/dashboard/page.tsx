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
  GitCommitHorizontal,
  FolderKanban,
  TrendingUp,
  Flame,
} from 'lucide-react';

interface DashboardData {
  projectCount: number;
  commitCount: number;
  codingStreak: number;
  repoCount: number;
  topRepo: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      const [projectsRes, commitsRes] = await Promise.all([
        supabase.from('projects').select('id').eq('user_id', user.id),
        supabase
          .from('commits')
          .select('committed_at, repository')
          .eq('user_id', user.id)
          .order('committed_at', { ascending: false }),
      ]);

      const projects = projectsRes.data || [];
      const commits = commitsRes.data || [];

      // =========================
      // STREAK (reliable)
      // =========================
      const uniqueDays = Array.from(
        new Set(
          commits.map((c) =>
            new Date(c.committed_at).toDateString()
          )
        )
      );

      let streak = 0;
      const today = new Date();

      for (let i = 0; i < uniqueDays.length; i++) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);

        if (uniqueDays.includes(expected.toDateString())) {
          streak++;
        } else {
          break;
        }
      }

      // =========================
      // REPOS
      // =========================
      const repoMap = new Map<string, number>();

      commits.forEach((c) => {
        const repo = c.repository || 'unknown';
        repoMap.set(repo, (repoMap.get(repo) || 0) + 1);
      });

      const repoCount = repoMap.size;

      const topRepo =
        Array.from(repoMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        'none';

      setData({
        projectCount: projects.length,
        commitCount: commits.length,
        codingStreak: streak,
        repoCount,
        topRepo,
      });

      setLoading(false);
    };

    fetchDashboard();
  }, [user]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-20 bg-muted rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p>Commits</p>
          <h2 className="text-2xl font-bold">{data.commitCount}</h2>
          <GitCommitHorizontal />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p>Streak</p>
          <h2 className="text-2xl font-bold">{data.codingStreak} days</h2>
          <Flame />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p>Projects</p>
          <h2 className="text-2xl font-bold">{data.projectCount}</h2>
          <FolderKanban />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p>Top Repo</p>
          <h2 className="text-sm font-bold truncate">{data.topRepo}</h2>
          <TrendingUp />
        </CardContent>
      </Card>
    </div>
  );
}