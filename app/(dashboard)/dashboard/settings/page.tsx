'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import {
  Github,
  Bell,
  User,
  Key,
  CircleCheck as CheckCircle2,
  ExternalLink,
  Trash2,
} from 'lucide-react';

// =========================
// TYPES
// =========================
interface Profile {
  name: string;
  avatar_url: string;
  theme: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface HeatmapDay {
  date: string;
  count: number;
}

interface GitHubSyncResponse {
  success?: boolean;

  github_user?: string;

  streak?: number;
  total_contributions?: number;
  heatmap?: HeatmapDay[];

  commits_synced?: number;
  repos_synced?: number;

  stats?: {
    push_events: number;
    total_events: number;
  };

  error?: string;
}

// =========================
// ERROR HELPERS
// =========================
function getFunctionsHttpErrorMessage(body: unknown, status: number) {
  if (typeof body === 'string') return body.trim() || `HTTP ${status}`;

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    return (
      (record.error as string) ||
      (record.message as string) ||
      JSON.stringify(body) ||
      `HTTP ${status}`
    );
  }

  return `Function HTTP error (${status})`;
}

function normalizeGitHubSyncResponse(
  data: GitHubSyncResponse | string | null | undefined
): GitHubSyncResponse | null {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

// =========================
// COMPONENT
// =========================
export default function SettingsPage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile>({
    name: '',
    avatar_url: '',
    theme: 'dark',
  });

  const [githubToken, setGithubToken] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          name: data.name || '',
          avatar_url: data.avatar_url || '',
          theme: data.theme || 'dark',
        });
      }
    };

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setNotifications(data || []);
    };

    fetchProfile();
    fetchNotifications();

    const token = user.user_metadata?.github_token;
    if (token) {
      setGithubToken(token);
      setGithubConnected(true);
    }
  }, [user]);

  // =========================
  // GITHUB SYNC
  // =========================
  const handleGithubConnect = async () => {
    if (!user || !githubToken.trim()) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setSyncResult('Session missing. Please re-login.');
        setSyncing(false);
        return;
      }

      await supabase.auth.updateUser({
        data: { github_token: githubToken },
      });

      const { data, error } = await supabase.functions.invoke<GitHubSyncResponse>(
        'github-sync',
        {
          body: {
            user_id: user.id,
            github_token: githubToken,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const syncData = normalizeGitHubSyncResponse(data);

      if (error) {
        const errMsg =
          error instanceof Error ? error.message : 'GitHub sync failed';
        setSyncResult(errMsg);
        setSyncing(false);
        return;
      }

      if (syncData?.success) {
        setGithubConnected(true);

        setHeatmap(syncData.heatmap ?? []);

        const commits = syncData.commits_synced ?? 0;
        const repos = syncData.repos_synced ?? 0;
        const streak = syncData.streak ?? 0;
        const total = syncData.total_contributions ?? 0;

        setSyncResult(
          `Synced ${commits} commits, ${repos} repos • 🔥 ${streak} day streak • ⭐ ${total} contributions`
        );

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'github',
          title: 'GitHub synced',
          message: `Synced ${commits} commits`,
        });
      } else {
        setSyncResult(syncData?.error || 'Sync failed');
      }
    } catch (err) {
      setSyncResult('Unexpected error during sync');
    } finally {
      setSyncing(false);
    }
  };

  // =========================
  // PROFILE SAVE
  // =========================
  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    await supabase
      .from('profiles')
      .update({
        name: profile.name,
        avatar_url: profile.avatar_url,
        theme: profile.theme,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    setSaved(true);

    setTimeout(() => setSaved(false), 2000);
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="github">
            <Github className="h-4 w-4 mr-2" />
            GitHub
          </TabsTrigger>

          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>

          <TabsTrigger value="security">
            <Key className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* ================= PROFILE ================= */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your details</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                placeholder="Name"
              />

              <Input
                value={profile.avatar_url}
                onChange={(e) =>
                  setProfile({ ...profile, avatar_url: e.target.value })
                }
                placeholder="Avatar URL"
              />

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= GITHUB ================= */}
        <TabsContent value="github">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Integration</CardTitle>
              <CardDescription>
                Sync commits, repos, heatmap & streak
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="GitHub token"
              />

              <Button
                onClick={handleGithubConnect}
                disabled={syncing || !githubToken}
              >
                {syncing ? 'Syncing...' : 'Sync GitHub'}
              </Button>

              {syncResult && (
                <p className="text-sm text-muted-foreground">
                  {syncResult}
                </p>
              )}

              {/* HEATMAP PREVIEW */}
              {heatmap.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Heatmap loaded</p>
                  <p className="text-xs text-muted-foreground">
                    {heatmap.length} active days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= NOTIFICATIONS ================= */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>

            <CardContent>
              {notifications.map((n) => (
                <div key={n.id} className="border-b py-2">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {n.message}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= SECURITY ================= */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-muted-foreground">
                Email: {user?.email}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}