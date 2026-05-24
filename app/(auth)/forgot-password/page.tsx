'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Code as Code2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { error } = await resetPassword(trimmedEmail);

      if (error) {
        setError(error);
      } else {
        setSuccess('Check your email for a password reset link.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Code2 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">DevTrack</span>
        </div>
        <Card className="border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-secondary/50"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-400">{success}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending reset link...' : 'Send reset link'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
