'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Code as Code2, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Name, email, and password are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error, session, user } = await signUp(trimmedEmail, password, trimmedName);

      if (error) {
        setError(error);
        return;
      }

      if (session && user) {
        const profileName =
          typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
            ? user.user_metadata.name.trim()
            : trimmedName;

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          name: profileName,
          theme: 'dark',
        });

        if (profileError) {
          setError(profileError.message);
          return;
        }

        sessionStorage.removeItem('devtrack_register');

        router.push('/dashboard');
        return;
      }

      // store only what we need for profile later
      sessionStorage.setItem(
        'devtrack_register',
        JSON.stringify({ name: trimmedName, email: trimmedEmail })
      );

      router.push(
        `/verify-otp?email=${encodeURIComponent(trimmedEmail)}&type=REGISTER`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Code2 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">DevTrack</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Get started with DevTrack</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
