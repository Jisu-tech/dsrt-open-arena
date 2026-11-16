'use client';

import React, { useState } from 'react';
import { X, Key, Check, Loader2 } from 'lucide-react';
import { ProviderType } from '@/lib/providers/failover';

export interface KeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const PROVIDERS: { id: ProviderType; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'groq', label: 'Groq' },
  { id: 'mistral', label: 'Mistral AI' },
  { id: 'deepseek', label: 'DeepSeek' },
];

export function KeyManagerModal({ isOpen, onClose }: KeyManagerModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [alias, setAlias] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter an API key to test.' });
      return;
    }

    setTesting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/keys/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          testOnly: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: `Key verified successfully for ${selectedProvider.toUpperCase()}.` });
      } else {
        setStatusMessage({ type: 'error', text: data.error || data.message || 'Key verification failed.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error testing API key.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter an API key to save.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/v1/keys/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          alias: alias.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: data.message || 'Key saved and encrypted successfully!' });
        setApiKey('');
        setAlias('');
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save API key.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error saving API key.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-input p-2 border border-border">
              <Key className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Manage API Keys</h2>
              <p className="text-xs text-text-muted">Zero-downtime server-side key replacement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-input hover:text-text transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
              Select Provider
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(p.id);
                    setStatusMessage(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-medium border transition ${
                    selectedProvider === p.id
                      ? 'border-text bg-input text-text'
                      : 'border-border bg-bg-elevated text-text-muted hover:border-border-hover hover:text-text'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
              New {selectedProvider.toUpperCase()} API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Paste your ${selectedProvider} API key...`}
              className="w-full rounded-lg border border-border bg-input px-3.5 py-2 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
              Key Name / Alias (Optional)
            </label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Production Primary"
              className="w-full rounded-lg border border-border bg-input px-3.5 py-2 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {statusMessage && (
            <div
              className={`flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
                statusMessage.type === 'success'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-error/30 bg-error/10 text-error'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <X className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testing || saving || !apiKey.trim()}
              className="flex-1 rounded-lg border border-border bg-input py-2.5 text-xs font-medium text-text hover:bg-bg-elevated disabled:opacity-50 transition flex justify-center items-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Key'
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={testing || saving || !apiKey.trim()}
              className="flex-1 rounded-lg bg-text py-2.5 text-xs font-semibold text-bg hover:bg-text-muted disabled:opacity-50 transition flex justify-center items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-bg" />
                  Saving...
                </>
              ) : (
                'Save Key'
              )}
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-text-dim">
          Keys are encrypted with AES-256-GCM. Replacing a key preserves all existing chat threads and comparisons.
        </p>
      </div>
    </div>
  );
}