'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Props = {
  email: string;
  verificationType: 'REGISTER' | 'RESET_PASSWORD';
};

export default function VerifyOTPForm({
  email,
  verificationType,
}: Props) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // 🔹 Handle input change
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // 🔹 Backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 🔹 Paste support
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    const newCode = [...code];

    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }

    setCode(newCode);

    const nextIndex = pasted.length < 6 ? pasted.length : 5;
    inputRefs.current[nextIndex]?.focus();
  };

  // 🔹 Submit OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (verificationType !== 'REGISTER') {
      setError('Password reset now uses the email link sent from the Forgot Password page.');
      return;
    }

    const otpCode = code.join('');

    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });

      if (error || !data.session || !data.user) {
        setError(error?.message || 'Invalid or expired code');
        return;
      }

      const user = data.user;

      // 🔹 Create profile after registration
      if (verificationType === 'REGISTER') {
        const stored = sessionStorage.getItem('devtrack_register');

        let name = '';

        if (stored) {
          try {
            name = JSON.parse(stored).name;
          } catch {
            name = '';
          }
        }

        const metadataName =
          typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : '';
        const profileName = metadataName || name;

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
      }

      // 🔹 Password reset flow
      else {
        router.push('/reset-password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Resend OTP (Supabase handles it)
  const handleResend = async () => {
    setError('');

    try {
      if (verificationType !== 'REGISTER') {
        setError('Password reset now uses the email link sent from the Forgot Password page.');
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to{' '}
              <span className="font-medium text-foreground">
                {email}
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* OTP Inputs */}
              <div className="flex justify-center gap-2">
                {code.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={digit}
                    maxLength={1}
                    onChange={(e) =>
                      handleChange(i, e.target.value)
                    }
                    onKeyDown={(e) =>
                      handleKeyDown(i, e)
                    }
                    onPaste={handlePaste}
                    className="w-12 h-14 text-center text-xl font-bold"
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? 'Verifying...'
                  : 'Verify code'}
              </Button>
            </form>

            {/* Resend */}
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                Didn’t receive the code?
              </p>

              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-primary hover:underline"
              >
                Resend code
              </button>
            </div>

            {/* Back */}
            <div className="mt-4 text-center">
              <Link
                href={
                  verificationType === 'REGISTER'
                    ? '/register'
                    : '/forgot-password'
                }
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
