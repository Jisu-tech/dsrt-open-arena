'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  WorkModeMark,
  WarModeMark,
  DocsMark,
} from '@/components/ui/DsrtMarks';

interface CommandItem {
  id: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const items: CommandItem[] = useMemo(
    () => [
      {
        id: 'new-chat',
        label: 'New chat',
        section: 'Actions',
        icon: <span className="text-text-faint text-[12px]">+</span>,
        action: () => {
          router.push('/work');
          onClose();
        },
        keywords: ['new', 'chat', 'conversation'],
      },
      {
        id: 'work-mode',
        label: 'Go to Work Mode',
        section: 'Navigation',
        icon: <WorkModeMark size={14} className="text-text-muted" />,
        action: () => {
          router.push('/work');
          onClose();
        },
        keywords: ['work', 'mode'],
      },
      {
        id: 'war-mode',
        label: 'Go to War Mode',
        section: 'Navigation',
        icon: <WarModeMark size={14} className="text-text-muted" />,
        action: () => {
          router.push('/war');
          onClose();
        },
        keywords: ['war', 'mode', 'compare', 'battle'],
      },
      {
        id: 'docs',
        label: 'Go to Documentation',
        section: 'Navigation',
        icon: <DocsMark size={14} className="text-text-muted" />,
        action: () => {
          router.push('/docs');
          onClose();
        },
        keywords: ['docs', 'documentation', 'help'],
      },
      {
        id: 'settings',
        label: 'Open Settings',
        section: 'Navigation',
        icon: <span className="text-text-faint text-[12px]">⚙</span>,
        action: () => {
          router.push('/settings');
          onClose();
        },
        keywords: ['settings', 'config', 'preferences'],
      },
    ],
    [router, onClose]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords?.some((kw) => kw.includes(q))
    );
  }, [items, query]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const group = map.get(item.section) ?? [];
      group.push(item);
      map.set(item.section, group);
    }
    return map;
  }, [filtered]);

  const flatFiltered = useMemo(() => filtered, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatFiltered[activeIndex]?.action();
      }
    },
    [flatFiltered, activeIndex, onClose]
  );

  // Clamp active index
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(flatFiltered.length - 1, 0)));
  }, [flatFiltered]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm dsrt-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden dsrt-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={15} className="text-text-faint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-[14px] text-text placeholder:text-text-dim focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-text-faint hover:text-text p-1 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-text-faint">
              No results found
            </div>
          ) : (
            Array.from(grouped.entries()).map(([section, sectionItems]) => (
              <div key={section}>
                <div className="px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-faint">
                  {section}
                </div>
                {sectionItems.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors ${
                        activeIndex === idx
                          ? 'bg-panel text-text'
                          : 'text-text-muted hover:bg-panel-hover'
                      }`}
                    >
                      <span className="w-5 flex items-center justify-center shrink-0">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-text-faint">
          <span>
            <kbd className="font-mono bg-panel border border-border rounded px-1 py-[1px]">
              ↑↓
            </kbd>{' '}
            navigate
          </span>
          <span>
            <kbd className="font-mono bg-panel border border-border rounded px-1 py-[1px]">
              ↵
            </kbd>{' '}
            select
          </span>
          <span>
            <kbd className="font-mono bg-panel border border-border rounded px-1 py-[1px]">
              esc
            </kbd>{' '}
            close
          </span>
        </div>
      </div>
    </div>
  );
}