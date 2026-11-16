'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { DsrtLogo } from '@/components/ui/DsrtMarks';

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const { error: signUpError } = await signUp(
      email.trim(),
      password,
      displayName.trim()
    );
    setIsSubmitting(false);
    if (signUpError) return setError(signUpError);
    setInfo('Account created. Check your email to confirm.');
    router.replace('/');
    router.refresh();
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <DsrtLogo size={36} />
          </div>
          <h1 className="text-[18px] font-semibold text-text tracking-tight">
            Create your account
          </h1>
          <p className="text-[12px] text-text-faint mt-1">
            Get started with Dsrt AI
          </p>
        </div>

        <div className="border border-border rounded-xl bg-bg-elevated p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                placeholder="Optional"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div className="text-[11px] text-error bg-error-bg border border-error/30 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}
            {info && (
              <div className="text-[11px] text-success bg-success-bg border border-success/30 rounded-lg px-3 py-2.5">
                {info}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-text-faint mt-6 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-text font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}