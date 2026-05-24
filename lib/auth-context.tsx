'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: string | null;
    session: Session | null;
    user: User | null;
  }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Failed to initialize Supabase auth state:', error);

        if (!isMounted) return;

        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    try {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!isMounted) return;

        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });

      subscription = authSubscription;
    } catch (error) {
      console.error('Failed to subscribe to Supabase auth changes:', error);
      setLoading(false);
    }

    void initializeAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (error) {
        return { error: error.message, session: null, user: null };
      }

      return {
        error: null,
        session: data.session ?? null,
        user: data.user ?? null,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to create account',
        session: null,
        user: null,
      };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (typeof window === 'undefined') {
      return { error: 'Password reset is only available in the browser.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
