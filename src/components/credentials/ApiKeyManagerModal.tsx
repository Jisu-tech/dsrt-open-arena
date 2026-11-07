'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Loader2, Trash2, ExternalLink, KeyRound, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  PROVIDER_METADATA,
  type ProviderType,
} from '@/lib/providers/registry';
import type { CredentialItem } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string | null;
  onCredentialsChanged?: (providers: ProviderType[]) => void;
};

export function ApiKeyManagerModal({
  open,
  onClose,
  workspaceId,
  onCredentialsChanged,
}: Props) {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const providerIds = Object.keys(PROVIDER_METADATA) as ProviderType[];

  const configuredProviders = useMemo<ProviderType[]>(
    () =>
      Array.from(
        new Set(
          credentials
            .filter(
              (c) =>
                String(c.status).toLowerCase() === 'active' ||
                String(c.status).toLowerCase() === 'valid'
            )
            .map((c) => c.provider as ProviderType)
        )
      ),
    [credentials]
  );

  useEffect(() => {
    onCredentialsChanged?.(configuredProviders);
  }, [configuredProviders, onCredentialsChanged]);

  const loadCredentials = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/credentials?workspace_id=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || 'Failed to load credentials'
        );
      }
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void loadCredentials();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, workspaceId, loadCredentials]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) {
      setError('No workspace selected');
      return;
    }
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/v1/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          provider,
          api_key: apiKey.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Validation or save failed');
      }

      setApiKey('');
      setSuccess(`${PROVIDER_METADATA[provider].name} key saved and validated`);
      await loadCredentials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Remove this API key? Conversations stay intact; you can add a new key later.'
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/v1/credentials/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Delete failed');
      }
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const meta = PROVIDER_METADATA[provider];
  const isActive = (status: string) =>
    status === 'active' || status === 'valid' || status === 'VALID' || status === 'ACTIVE';

  return (
    <Modal isOpen={open} onClose={onClose} title="API Keys">
      <div className="space-y-6">
        {!workspaceId && (
          <div className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-input px-3 py-2">
            No workspace selected. Complete sign-in and wait for your personal workspace
            to load.
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="space-y-3 border border-border rounded-card p-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound size={16} className="text-accent" />
            Add provider key
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={!workspaceId || saving}
            >
              {providerIds.map((p) => {
                const configured = configuredProviders.includes(p);
                return (
                  <option key={p} value={p}>
                    {configured ? '● ' : '○ '}
                    {PROVIDER_METADATA[p].name}
                    {configured ? ' (configured)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              API key
            </label>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-… (never stored in the browser after save)"
              className="w-full px-3 py-2 rounded-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              disabled={!workspaceId || saving}
              required
            />
          </div>

          {meta?.docsUrl && (
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Provider docs <ExternalLink size={12} />
            </a>
          )}

          {error && (
            <div className="text-xs text-error bg-red-50 border border-red-200 rounded-input px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-success bg-emerald-50 border border-emerald-200 rounded-input px-3 py-2">
              {success}
            </div>
          )}

          <Button type="submit" disabled={!workspaceId || saving || !apiKey.trim()}>
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Validating…
              </>
            ) : (
              'Validate & save'
            )}
          </Button>
        </form>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-secondary uppercase tracking-wider font-mono">
              Saved keys
            </div>
            {configuredProviders.length > 0 && (
              <div className="text-[10px] text-secondary">
                {configuredProviders.length} of {providerIds.length} providers configured
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-6 text-secondary">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : credentials.length === 0 ? (
            <p className="text-xs text-secondary py-2">
              No keys saved for this workspace yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {credentials.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 border border-border rounded-input px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground capitalize">
                        {PROVIDER_METADATA[c.provider as ProviderType]?.name || c.provider}
                      </span>
                      <Badge variant={isActive(c.status) ? 'success' : 'warning'}>
                        {isActive(c.status) ? (
                          <>
                            <Check size={10} className="inline mr-1" />
                            active
                          </>
                        ) : (
                          c.status || 'invalid'
                        )}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-secondary font-mono truncate">
                      {c.key_mask}
                    </div>
                    <div className="text-[10px] text-secondary">
                      Provider spend: ${Number(c.total_cost_usd || 0).toFixed(4)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    className="p-2 rounded-input text-secondary hover:text-error hover:bg-red-50"
                    title="Delete key"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}