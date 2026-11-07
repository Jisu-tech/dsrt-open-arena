'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';

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
    const { error: signUpError } = await signUp(email.trim(), password, displayName.trim());
    setIsSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // If email confirmation is disabled in Supabase, session exists → go home.
    // If enabled, show message.
    setInfo('Account created. Check your email to confirm, or sign in if confirmation is disabled.');
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-workspace px-4">
      <div className="w-full max-w-md border border-border rounded-card bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground">DSRT ARENA</div>
            <div className="text-[10px] text-secondary font-mono">Open Amplification</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">Create account</h1>
        <p className="text-xs text-secondary mt-1 mb-6">
          A personal workspace is provisioned automatically on signup.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {error && (
            <div className="text-xs text-error bg-red-50 border border-red-200 rounded-input px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-xs text-success bg-emerald-50 border border-emerald-200 rounded-input px-3 py-2">
              {info}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create account'}
          </Button>
        </form>

        <p className="text-xs text-secondary mt-6 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-accent font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}