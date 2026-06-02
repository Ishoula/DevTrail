'use client';

import { useState } from 'react';
import Link from 'next/link';

import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Props = {
  email: string;
  verificationType: 'REGISTER' | 'RESET_PASSWORD';
};

export default function VerifyOTPForm({
  email,
  verificationType,
}: Props) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 🔹 Resend link
  const handleResend = async () => {
    setError('');
    setSuccess('');

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
      } else {
        setSuccess('Verification email resent successfully.');
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
            <CardTitle>Check your email to verify your account</CardTitle>
            <CardDescription>
              Please check your email for the verification link sent to{' '}
              <span className="font-medium text-foreground">
                {email}
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <p className="text-sm text-red-500 text-center mb-4">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-500 text-center mb-4">
                {success}
              </p>
            )}

            {/* Resend */}
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                Didn’t receive the link?
              </p>

              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-primary hover:underline"
              >
                Resend email
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
