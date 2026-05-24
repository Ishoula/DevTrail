import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient<Database> | null = null;

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are required. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient<Database>];

    if (typeof value === 'function') {
      return value.bind(client);
    }

    return value;
  },
});

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          avatar_url?: string;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          color: string;
          status: string;
          github_repo: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          color?: string;
          status?: string;
          github_repo?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          color?: string;
          status?: string;
          github_repo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          status: string;
          priority: string;
          due_date: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          status?: string;
          priority?: string;
          due_date?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          status?: string;
          priority?: string;
          due_date?: string | null;
          project_id?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      commits: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          sha: string;
          message: string;
          repository: string;
          committed_at: string;
          additions: number;
          deletions: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          sha: string;
          message?: string;
          repository: string;
          committed_at: string;
          additions?: number;
          deletions?: number;
          created_at?: string;
        };
        Update: {
          project_id?: string | null;
        };
        Relationships: [];
      };
      coding_sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string;
          duration_minutes: number;
          commit_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at: string;
          ended_at: string;
          duration_minutes?: number;
          commit_count?: number;
          created_at?: string;
        };
        Update: {};
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
};
