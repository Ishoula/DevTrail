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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, User, Key, Timer } from 'lucide-react';

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

interface WakaTimeSyncResponse {
  success?: boolean;
  total_seconds?: number;
  total_hours?: number;
  days_synced?: number;
  error?: string;
  details?: string;
}

async function getFunctionErrorMessage(error: unknown) {
  const context = (error as { context?: Response | null })?.context;

  if (context) {
    try {
      const body = await context.clone().json();
      const message = body?.details || body?.error || body?.message;

      if (message) {
        return String(message);
      }
    } catch {
      // Fall back to the SDK error message below.
    }
  }

  return error instanceof Error ? error.message : 'Sync failed';
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [githubToken, setGithubToken] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);
  const [wakatimeApiKey, setWakatimeApiKey] = useState('');
  const [wakatimeConnected, setWakatimeConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [wakatimeSyncing, setWakatimeSyncing] = useState(false);
  const [wakatimeSyncResult, setWakatimeSyncResult] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [appOrigin, setAppOrigin] = useState('');

  // =========================
  // OAUTH URL
  // =========================
  const githubOAuthParams = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? '',
    scope: 'read:user repo',
    state: user?.id ?? '',
  });

  if (appOrigin) {
    githubOAuthParams.set('redirect_uri', `${appOrigin}/api/github/callback`);
  }

  const githubOAuthUrl = `https://github.com/login/oauth/authorize?${githubOAuthParams.toString()}`;

  useEffect(() => {
    setAppOrigin(window.location.origin);

    // Refresh session to get the latest user metadata (like github_token) updated by the OAuth callback
    const refresh = async () => {
      try {
        await supabase.auth.refreshSession();
      } catch (err) {
        console.error('Failed to refresh session on load:', err);
      }
    };
    refresh();
  }, []);

  // =========================
  // LOAD GITHUB CONNECTION (SOURCE OF TRUTH = SUPABASE USER)
  // =========================
  useEffect(() => {
    if (!user) return;

    const token = user.user_metadata?.github_token;
    const wakatimeKey = user.user_metadata?.wakatime_api_key;

    if (token) {
      setGithubToken(token);
      setGithubConnected(true);

      // optional: auto sync on load
      syncGitHub(token);
    } else {
      setGithubConnected(false);
    }

    if (wakatimeKey) {
      setWakatimeConnected(true);
    } else {
      setWakatimeConnected(false);
    }
  }, [user]);

  // =========================
  // SYNC FUNCTION
  // =========================
  const syncGitHub = async (tokenOverride?: string) => {
    let token = tokenOverride || githubToken;

    if (!user) return;

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

      if (!token) {
        // Fetch the latest user object to ensure we have the fresh github_token metadata
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        token = freshUser?.user_metadata?.github_token;
      }

      if (!token) {
        setSyncResult('GitHub token not found. Connect GitHub first.');
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
  // WAKATIME FUNCTIONS
  // =========================
  const saveWakaTimeKey = async () => {
    if (!wakatimeApiKey.trim()) {
      setWakatimeSyncResult('Paste your WakaTime API key first.');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        wakatime_api_key: wakatimeApiKey.trim(),
      },
    });

    if (error) {
      setWakatimeSyncResult(error.message);
      return;
    }

    setWakatimeApiKey('');
    setWakatimeConnected(true);
    setWakatimeSyncResult('WakaTime key saved.');
  };

  const syncWakaTime = async () => {
    setWakatimeSyncing(true);
    setWakatimeSyncResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;

      if (!accessToken) {
        setWakatimeSyncResult('No session found');
        return;
      }

      const { data, error } = await supabase.functions.invoke<WakaTimeSyncResponse>(
        'wakatime-sync',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (error) {
        setWakatimeSyncResult(await getFunctionErrorMessage(error));
        return;
      }

      if (data?.success) {
        setWakatimeSyncResult(
          `Synced ${data.days_synced ?? 0} days • ${data.total_hours ?? 0} hours`
        );
      } else {
        setWakatimeSyncResult(data?.error || data?.details || 'Sync failed');
      }
    } catch {
      setWakatimeSyncResult('Unexpected error occurred');
    } finally {
      setWakatimeSyncing(false);
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

          <TabsTrigger value="wakatime">
            <Timer className="w-4 h-4 mr-2" />
            WakaTime
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

        {/* ================= WAKATIME ================= */}
        <TabsContent value="wakatime">
          <Card>
            <CardHeader>
              <CardTitle>WakaTime Integration</CardTitle>
              <CardDescription>
                Pull coding hours from your WakaTime account
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`h-2 w-2 rounded-full ${
                    wakatimeConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                {wakatimeConnected ? 'Connected' : 'Not connected'}
              </div>

              <div className="space-y-2">
                <label htmlFor="wakatime-key" className="text-sm font-medium">
                  WakaTime API key
                </label>
                <Input
                  id="wakatime-key"
                  type="password"
                  value={wakatimeApiKey}
                  onChange={(e) => setWakatimeApiKey(e.target.value)}
                  placeholder="Paste your WakaTime API key"
                  className="bg-secondary/50"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={saveWakaTimeKey}>
                  Save WakaTime Key
                </Button>
                <Button
                  variant="outline"
                  onClick={syncWakaTime}
                  disabled={wakatimeSyncing || !wakatimeConnected}
                >
                  {wakatimeSyncing ? 'Syncing...' : 'Sync WakaTime'}
                </Button>
              </div>

              {wakatimeSyncResult && (
                <p className="text-sm text-muted-foreground">
                  {wakatimeSyncResult}
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
