'use client';

import React from 'react';
import { DocsMark } from '@/components/ui/DsrtMarks';

export default function DocsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <DocsMark size={20} className="text-text-muted" />
          <h1 className="text-[20px] font-semibold text-text tracking-tight">
            Documentation
          </h1>
        </div>

        <div className="space-y-6 text-[14px] text-text-muted leading-relaxed">
          <section>
            <h2 className="text-[15px] font-semibold text-text mb-2">
              Getting Started
            </h2>
            <p>
              Configure your API keys in the sidebar to start using Dsrt AI.
              Work Mode provides focused single-model conversations with
              amplification. War Mode lets you compare raw provider output
              against Dsrt-amplified responses side by side.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text mb-2">
              Work Mode
            </h2>
            <p>
              Select a provider and model from the top bar, then start a
              conversation. Dsrt AI will amplify responses through its
              verification and quality pipeline. Metrics are available per
              message.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text mb-2">
              War Mode
            </h2>
            <p>
              Compare provider outputs in a controlled A/B evaluation. Select
              a route, configure providers, and see quality metrics, rubric
              scores, and cost analysis for each response.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text mb-2">
              API Keys
            </h2>
            <p>
              Keys are encrypted with AES-256-GCM before storage and never
              returned to the browser after being saved. Each workspace
              manages its own set of provider credentials independently.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-text mb-2">
              Keyboard Shortcuts
            </h2>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="flex items-center gap-2">
                <kbd className="font-mono text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-text-faint">
                  ⌘K
                </kbd>
                <span>Command palette</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="font-mono text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-text-faint">
                  Enter
                </kbd>
                <span>Send message</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="font-mono text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-text-faint">
                  Shift+Enter
                </kbd>
                <span>New line</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="font-mono text-[10px] bg-panel border border-border rounded px-1.5 py-0.5 text-text-faint">
                  Esc
                </kbd>
                <span>Close modal/palette</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}