'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, User, Key } from 'lucide-react';

// =========================
// TYPES
// =========================
interface HeatmapDay {
  date: string;
  count: number;
}

interface GitHubSyncResponse {
  success?: boolean;
  streak?: number;
  total_contributions?: number;
  commits_synced?: number;
  repos_synced?: number;
  heatmap?: HeatmapDay[];
  error?: string;
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [githubToken, setGithubToken] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);

  // =========================
  // OAUTH URL
  // =========================
  const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&scope=read:user repo`;

  // =========================
  // LOAD GITHUB CONNECTION (SOURCE OF TRUTH = SUPABASE USER)
  // =========================
  useEffect(() => {
    if (!user) return;

    const token = user.user_metadata?.github_token;

    if (token) {
      setGithubToken(token);
      setGithubConnected(true);

      // optional: auto sync on load
      syncGitHub(token);
    } else {
      setGithubConnected(false);
    }
  }, [user]);

  // =========================
  // SYNC FUNCTION
  // =========================
  const syncGitHub = async (tokenOverride?: string) => {
    const token = tokenOverride || githubToken;

    if (!user || !token) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;

      if (!accessToken) {
        setSyncResult('No session found');
        setSyncing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke<GitHubSyncResponse>(
        'github-sync',
        {
          body: {
            user_id: user.id,
            github_token: token,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (error) {
        setSyncResult(error.message);
        setSyncing(false);
        return;
      }

      if (data?.success) {
        setHeatmap(data.heatmap ?? []);

        setSyncResult(
          `🔥 ${data.streak ?? 0} day streak • ⭐ ${
            data.total_contributions ?? 0
          } contributions • 📦 ${data.repos_synced ?? 0} repos`
        );
      } else {
        setSyncResult(data?.error || 'Sync failed');
      }
    } catch {
      setSyncResult('Unexpected error occurred');
    } finally {
      setSyncing(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="github">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="github">
            <Github className="w-4 h-4 mr-2" />
            GitHub
          </TabsTrigger>

          <TabsTrigger value="security">
            <Key className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* ================= PROFILE ================= */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Manage your personal information
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* ================= GITHUB ================= */}
        <TabsContent value="github">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>
                Connect GitHub to track commits, repos, and streaks
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">

              {/* STATUS */}
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`h-2 w-2 rounded-full ${
                    githubConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                {githubConnected ? 'Connected' : 'Not connected'}
              </div>

              {/* CONNECT BUTTON */}
              <Button asChild>
                <a href={githubOAuthUrl}>
                  <Github className="w-4 h-4 mr-2" />
                  {githubConnected ? 'Reconnect GitHub' : 'Connect GitHub'}
                </a>
              </Button>

              {/* SYNC BUTTON */}
              <Button
                variant="outline"
                onClick={() => syncGitHub()}
                disabled={syncing || !githubToken}
              >
                {syncing ? 'Syncing...' : 'Sync Data'}
              </Button>

              {/* RESULT */}
              {syncResult && (
                <p className="text-sm text-muted-foreground">
                  {syncResult}
                </p>
              )}

              {/* HEATMAP INFO */}
              {heatmap.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Heatmap loaded: {heatmap.length} active days
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= SECURITY ================= */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                OAuth-based authentication via GitHub
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
