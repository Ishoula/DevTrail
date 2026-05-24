'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, GripVertical, Calendar, MoveHorizontal as MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
  projects?: { name: string; color: string };
}

interface Project {
  id: string;
  name: string;
  color: string;
}

const COLUMNS = [
  { key: 'todo', label: 'Todo', color: 'bg-zinc-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'review', label: 'Review', color: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-zinc-500',
  medium: 'bg-blue-500',
  high: 'bg-red-500',
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    project_id: '',
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [tasksRes, projectsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, projects:project_id(name, color)')
        .in('project_id', (await supabase.from('projects').select('id').eq('user_id', user.id)).data?.map((p) => p.id) || [''])
        .order('position', { ascending: true }),
      supabase.from('projects').select('id, name, color').eq('user_id', user.id),
    ]);

    setTasks((tasksRes.data as unknown as Task[]) || []);
    setProjects(projectsRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.project_id) return;

    if (editingTask) {
      await supabase
        .from('tasks')
        .update({
          title: form.title,
          description: form.description,
          status: form.status,
          priority: form.priority,
          due_date: form.due_date || null,
          project_id: form.project_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTask.id);
    } else {
      const { data: maxPos } = await supabase
        .from('tasks')
        .select('position')
        .eq('project_id', form.project_id)
        .eq('status', form.status)
        .order('position', { ascending: false })
        .limit(1);

      await supabase.from('tasks').insert({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        project_id: form.project_id,
        position: (maxPos?.[0]?.position ?? -1) + 1,
      });
    }

    setDialogOpen(false);
    setEditingTask(null);
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', project_id: '' });
    fetchData();
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      project_id: task.project_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    fetchData();
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: string) => {
    if (!draggedTask || draggedTask.status === status) {
      setDraggedTask(null);
      return;
    }

    await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', draggedTask.id);

    setDraggedTask(null);
    fetchData();
  };

  const getColumnTasks = (status: string) => tasks.filter((t) => t.status === status);

  const openNew = (status = 'todo') => {
    setEditingTask(null);
    setForm({ title: '', description: '', status, priority: 'medium', due_date: '', project_id: projects[0]?.id || '' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage your tasks with a Kanban board</p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update task details' : 'Add a new task to your board'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to be done?"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Add details..."
                className="bg-secondary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((col) => (
                      <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.title.trim() || !form.project_id}>
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse border-border/50">
              <CardContent className="p-4"><div className="h-40 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[calc(100vh-220px)]">
          {COLUMNS.map((column) => {
            const columnTasks = getColumnTasks(column.key);
            return (
              <div
                key={column.key}
                className="flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.key)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {columnTasks.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNew(column.key)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 space-y-2">
                  {columnTasks.map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className="border-border/50 cursor-grab active:cursor-grabbing hover:border-border transition-colors"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(task)}>
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-6">
                          <div className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-zinc-500'}`} />
                          <span className="text-[10px] text-muted-foreground capitalize">{task.priority}</span>
                          {task.projects && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto" style={{ borderColor: task.projects.color, color: task.projects.color }}>
                              {task.projects.name}
                            </Badge>
                          )}
                          {task.due_date && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
