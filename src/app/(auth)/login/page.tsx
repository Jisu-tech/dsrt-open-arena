'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';

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
    if (signInError) {
      setError(signInError);
      return;
    }
    router.replace(redirect);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md border border-border rounded-card bg-white p-8 shadow-sm">
      {/* ... KEEP YOUR EXISTING FORM HTML HERE ... */}
      <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        {error && <div className="text-xs text-error bg-red-50 border border-red-200 rounded-input px-3 py-2">{error}</div>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Sign in'}
        </Button>
      </form>
      <p className="text-xs text-secondary mt-6 text-center">
        No account? <Link href="/signup" className="text-accent font-medium hover:underline">Create one</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-workspace px-4">
      <Suspense fallback={<Loader2 className="animate-spin text-accent" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}