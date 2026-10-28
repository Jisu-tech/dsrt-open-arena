'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Key, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { ProviderType } from '@/lib/providers/registry';

interface CredentialItem {
  id: string;
  provider: ProviderType;
  key_mask: string;
  status: 'ACTIVE' | 'INVALID';
  last_validated_at: string;
}

interface ApiKeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  credentials: CredentialItem[];
  onRefreshCredentials: () => void;
}

export function ApiKeyManagerModal({
  isOpen,
  onClose,
  workspaceId,
  credentials,
  onRefreshCredentials,
}: ApiKeyManagerModalProps) {
  const [provider, setProvider] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save credential');
      }

      setApiKey('');
      onRefreshCredentials();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/credentials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshCredentials();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Provider Credentials Manager">
      <div className="space-y-6">
        <p className="text-xs text-secondary leading-relaxed">
          API keys are encrypted using AES-256-GCM before storage. Only masked tokens are returned to your browser.
        </p>

        {/* Existing Credentials */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Active Credentials</label>
          {credentials.length === 0 ? (
            <div className="p-3 border border-dashed border-border rounded-input text-xs text-secondary text-center">
              No API keys configured yet. Add your OpenAI, Anthropic, or Google keys below.
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-border rounded-input bg-workspace text-xs">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-accent" />
                    <span className="font-semibold uppercase">{c.provider}</span>
                    <span className="font-mono text-secondary">{c.key_mask}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'error'}>
                      {c.status}
                    </Badge>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-secondary hover:text-error transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form to add key */}
        <form onSubmit={handleSaveKey} className="space-y-4 pt-2 border-t border-border">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-error rounded-input text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              className="w-full h-9 px-3 rounded-input border border-border bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">API Secret Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full h-9 px-3 rounded-input border border-border font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            <CheckCircle size={14} className="mr-2" /> Validate & Save Key
          </Button>
        </form>
      </div>
    </Modal>
  );
}