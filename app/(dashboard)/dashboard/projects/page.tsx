'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoveHorizontal as MoreHorizontal, FolderKanban, Pencil, Trash2, Archive, ExternalLink } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  github_repo: string;
  created_at: string;
  taskCount?: number;
  completedCount?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6', github_repo: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        throw new Error(projectsError.message);
      }

      if (data) {
        const projectsWithCounts = await Promise.all(
          data.map(async (p) => {
            const { count: taskCount } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', p.id);
            const { count: completedCount } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', p.id)
              .eq('status', 'completed');
            return { ...p, taskCount: taskCount || 0, completedCount: completedCount || 0 };
          })
        );
        setProjects(projectsWithCounts);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const ensureProfileExists = useCallback(async () => {
    if (!user) return;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile) {
      const profileName =
        typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
          ? user.user_metadata.name.trim()
          : user.email?.split('@')[0] ?? 'User';

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        name: profileName,
        theme: 'dark',
      });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }, [user]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleSubmit = async () => {
    if (!user || !form.name.trim()) return;

    setSaving(true);
    setError('');

    try {
      await ensureProfileExists();

      const projectPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        github_repo: form.github_repo.trim(),
      };

      const { error: projectError } = editingProject
        ? await supabase
            .from('projects')
            .update({
              ...projectPayload,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingProject.id)
        : await supabase.from('projects').insert({
            user_id: user.id,
            ...projectPayload,
          });

      if (projectError) {
        throw new Error(projectError.message);
      }

      setDialogOpen(false);
      setEditingProject(null);
      setForm({ name: '', description: '', color: '#3b82f6', github_repo: '' });
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setError('');
    setForm({
      name: project.name,
      description: project.description,
      color: project.color,
      github_repo: project.github_repo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    fetchProjects();
  };

  const handleArchive = async (project: Project) => {
    await supabase
      .from('projects')
      .update({ status: project.status === 'active' ? 'archived' : 'active', updated_at: new Date().toISOString() })
      .eq('id', project.id);
    fetchProjects();
  };

  const openNew = () => {
    setEditingProject(null);
    setError('');
    setForm({ name: '', description: '', color: '#3b82f6', github_repo: '' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your development projects</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setError('');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
              <DialogDescription>
                {editingProject ? 'Update project details' : 'Add a new project to track'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Awesome Project"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this project about?"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, color })}
                      className={`h-8 w-8 rounded-full transition-all ${form.color === color ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="github_repo">GitHub Repository (optional)</Label>
                <Input
                  id="github_repo"
                  value={form.github_repo}
                  onChange={(e) => setForm({ ...form, github_repo: e.target.value })}
                  placeholder="owner/repo"
                  className="bg-secondary/50"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border-border/50">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first project to get started</p>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const progress = project.taskCount ? Math.round((project.completedCount! / project.taskCount) * 100) : 0;
            return (
              <Card key={project.id} className="border-border/50 hover:border-border transition-colors group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(project)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(project)}>
                          <Archive className="mr-2 h-4 w-4" />
                          {project.status === 'active' ? 'Archive' : 'Unarchive'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(project.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {project.taskCount || 0} tasks
                        </Badge>
                        {project.status === 'archived' && (
                          <Badge variant="outline" className="text-xs">Archived</Badge>
                        )}
                      </div>
                      {project.github_repo && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {project.github_repo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
