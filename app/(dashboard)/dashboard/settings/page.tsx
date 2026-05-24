'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface GitHubSyncResponse {
  success?: boolean;
  commits_synced?: number;
  contributions_synced?: number;
  sessions_created?: number;
  error?: string;
}

function getFunctionsHttpErrorMessage(body: unknown, status: number) {
  if (typeof body === 'string') {
    const trimmed = body.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const candidates = [record.error, record.message, record.details];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }

      if (candidate && typeof candidate === 'object') {
        try {
          return JSON.stringify(candidate);
        } catch {
          return String(candidate);
        }
      }
    }

    try {
      return JSON.stringify(record);
    } catch {
      return `Function HTTP error (${status})`;
    }
  }

  return `Function HTTP error (${status})`;
}

function normalizeGitHubSyncResponse(
  data: GitHubSyncResponse | string | null | undefined
): GitHubSyncResponse | null {
  if (!data) {
    return null;
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object'
        ? (parsed as GitHubSyncResponse)
        : null;
    } catch {
      return null;
    }
  }

  return data;
}

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

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('PROFILE FETCH ERROR:', error);
        return;
      }

      if (data) {
        setProfile({
          name: data.name || '',
          avatar_url: data.avatar_url || '',
          theme: data.theme || 'dark',
        });
      }
    };

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('NOTIFICATIONS FETCH ERROR:', error);
        return;
      }

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

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        name: profile.name,
        avatar_url: profile.avatar_url,
        theme: profile.theme,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      console.error('PROFILE UPDATE ERROR:', error);
      return;
    }

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  const handleGithubConnect = async () => {
    if (!user || !githubToken.trim()) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      console.log('USER ID:', user.id);

      const sessionData = await supabase.auth.getSession();

      console.log('SESSION DATA:', JSON.stringify(sessionData, null, 2));

      // Store token in metadata (DEV ONLY)
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          github_token: githubToken,
        },
      });

      if (updateError) {
        setSyncResult(updateError.message);
        setSyncing(false);
        return;
      }

      const { data: freshSessionData } = await supabase.auth.getSession();
      const accessToken = freshSessionData.session?.access_token;

      if (!accessToken) {
        setSyncResult('Your Supabase session is not available. Please sign in again.');
        setSyncing(false);
        return;
      }

      // Pin the current session token so the function sees the same JWT even
      // if auth state is still settling after the metadata update.

      const invokeOptions: {
        body: {
          user_id: string;
          github_token: string;
        };
        headers?: {
          Authorization: string;
        };
      } = {
        body: {
          user_id: user.id,
          github_token: githubToken,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const { data, error } = await supabase.functions.invoke<GitHubSyncResponse>(
        'github-sync',
        invokeOptions
      );

      const syncData = normalizeGitHubSyncResponse(data);

      console.log('FUNCTION RESPONSE:', JSON.stringify(syncData ?? data, null, 2));
      console.log('FUNCTION ERROR:', JSON.stringify(error, null, 2));

      if (error) {
        console.warn('FUNCTION INVOKE ERROR:', error);

        if (error instanceof FunctionsHttpError) {
          const response = error.context as Response;
          const rawBody = await response.clone().text().catch(() => '');
          let parsedBody: unknown = null;

          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
            } catch {
              parsedBody = rawBody;
            }
          }

          console.warn('FUNCTION HTTP STATUS:', response.status);
          console.warn(
            'FUNCTION HTTP RAW BODY:',
            rawBody || '[empty body]'
          );

          setSyncResult(
            getFunctionsHttpErrorMessage(parsedBody, response.status)
          );
        } else if (error instanceof FunctionsRelayError) {
          setSyncResult(
            'Supabase relay could not reach the Edge Function.'
          );
        } else if (error instanceof FunctionsFetchError) {
          setSyncResult(
            'Network error while calling the Edge Function.'
          );
        } else {
          setSyncResult(
            error instanceof Error
              ? error.message
              : 'GitHub sync failed'
          );
        }

        setSyncing(false);
        return;
      }

      if (syncData?.success) {
        const contributionsSynced =
          syncData.contributions_synced ?? syncData.commits_synced ?? 0;
        const sessionsCreated = syncData.sessions_created ?? 0;

        setGithubConnected(true);

        setSyncResult(
          `Synced ${contributionsSynced} contributions and created ${sessionsCreated} coding sessions`
        );

        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'github',
          title: 'GitHub synced',
          message: `Synced ${contributionsSynced} contributions`,
        });
      } else {
        setSyncResult(
          syncData?.error ||
            (typeof data === 'string' ? data : null) ||
            'GitHub sync returned no success flag'
        );
      }
    } catch (error) {
      console.error('GITHUB CONNECT ERROR:', error);

      setSyncResult('Failed to connect to GitHub');
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  };

  const handleDeleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);

    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordError('');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setChangePasswordOpen(false);
      setNewPassword('');
    }
  };

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const typeIcons: Record<string, string> = {
    task: 'bg-blue-500',
    deadline: 'bg-amber-500',
    github: 'bg-emerald-500',
    system: 'bg-zinc-500',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="github" className="gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </TabsTrigger>

          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>

          <TabsTrigger value="security" className="gap-2">
            <Key className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">
                Profile Information
              </CardTitle>

              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="font-medium">
                    {profile.name || 'User'}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>

                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name: e.target.value,
                      })
                    }
                    className="bg-secondary/50 max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar URL</Label>

                  <Input
                    id="avatar"
                    value={profile.avatar_url}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        avatar_url: e.target.value,
                      })
                    }
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-secondary/50 max-w-md"
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saved ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : null}

                {saved
                  ? 'Saved'
                  : saving
                  ? 'Saving...'
                  : 'Save changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">GitHub Integration</CardTitle>
              <CardDescription>
                Connect your GitHub account to track contributions and activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    githubConnected ? 'bg-emerald-500' : 'bg-zinc-500'
                  }`}
                />
                <span className="text-sm font-medium">
                  {githubConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                <Input
                  id="github-token"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="bg-secondary/50 max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  Generate a token at{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    github.com/settings/tokens{' '}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}with{' '}
                  <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                    repo
                  </code>{' '}
                  and{' '}
                  <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                    read:user
                  </code>{' '}
                  scopes
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleGithubConnect} disabled={syncing || !githubToken.trim()}>
                  {syncing ? 'Syncing...' : githubConnected ? 'Re-sync' : 'Connect & Sync'}
                </Button>
              </div>

              {syncResult && (
                <p
                  className={`text-sm ${
                    syncResult.includes('Synced')
                      ? 'text-emerald-500'
                      : 'text-destructive'
                  }`}
                >
                  {syncResult}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Notifications</CardTitle>
                  <CardDescription>Stay updated on your activity</CardDescription>
                </div>
                {notifications.some((n) => !n.read) && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                    Mark all read
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No notifications yet
                </p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        !notification.read ? 'bg-secondary/50' : ''
                      }`}
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                          typeIcons[notification.type] || 'bg-zinc-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {notification.message && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(notification.created_at).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDeleteNotification(notification.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>
                Manage your password and account security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-muted-foreground">
                    Change your account password
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}>
                  Change password
                </Button>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>Enter your new password below</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-secondary/50"
                  />
                </div>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleChangePassword}>Update password</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
