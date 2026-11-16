'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { DsrtLogo } from '@/components/ui/DsrtMarks';

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (signInError) return setError(signInError);
    router.replace(redirect);
    router.refresh();
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors';

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex mb-4">
          <DsrtLogo size={36} />
        </div>
        <h1 className="text-[18px] font-semibold text-text tracking-tight">
          Welcome back
        </h1>
        <p className="text-[12px] text-text-faint mt-1">
          Sign in to Dsrt AI
        </p>
      </div>

      <div className="border border-border rounded-xl bg-bg-elevated p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-[11px] text-error bg-error-bg border border-error/30 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </div>

      <p className="text-[11px] text-text-faint mt-6 text-center">
        No account?{' '}
        <Link href="/signup" className="text-text font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <Suspense
        fallback={<Loader2 className="animate-spin text-text-muted" />}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}