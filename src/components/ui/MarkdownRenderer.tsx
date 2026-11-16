'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

type Props = {
  content: string;
  isStreaming?: boolean;
  className?: string;
};

function CodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const lines = value.split('\n');

  return (
    <div className="my-3.5 rounded-lg border border-border overflow-hidden bg-panel text-[12.5px] font-mono shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-bg-elevated border-b border-border select-none">
        <span className="text-[10px] font-mono text-text-faint uppercase tracking-wider font-medium">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text transition-colors px-2 py-0.5 rounded hover:bg-panel-hover"
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2.2} className="text-success" />
              <span className="text-success text-[10px] font-sans font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={1.8} />
              <span className="text-[10px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 leading-relaxed text-text">
        <pre className="m-0 p-0 bg-transparent border-0 font-mono text-[12.5px]">
          <code>
            {lines.map((line, idx) => (
              <div key={idx} className="table-row">
                <span className="table-cell select-none pr-4 text-right text-text-faint/40 text-[11px] w-6">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
  className = '',
}: Props) {
  return (
    <div
      className={[
        'dsrt-md text-[14px] text-text leading-[1.65] break-words',
        '[&_h1]:text-[17px] [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-text',
        '[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-text',
        '[&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-text',
        '[&_p]:my-2.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
        '[&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
        '[&_li]:text-text',
        '[&_strong]:font-semibold [&_strong]:text-text',
        '[&_em]:italic',
        '[&_a]:text-text [&_a]:underline [&_a]:decoration-text-faint [&_a]:underline-offset-2 hover:[&_a]:decoration-text',
        '[&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[12.5px] [&_:not(pre)>code]:bg-panel [&_:not(pre)>code]:text-text [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:rounded [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-text-muted [&_blockquote]:my-3',
        '[&_table]:w-full [&_table]:my-3 [&_table]:text-[12.5px] [&_table]:border-collapse',
        '[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:bg-panel [&_th]:text-text [&_th]:font-semibold [&_th]:text-left [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[10px]',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-text',
        '[&_hr]:my-4 [&_hr]:border-border',
        className,
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className: codeClassName } = props;
            const match = /language-(\w+)/.exec(codeClassName || '');
            const codeString = String(children).replace(/\n$/, '');

            if (match || codeString.includes('\n')) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={codeString}
                />
              );
            }

            return <code className={codeClassName}>{children}</code>;
          },
          pre(props) {
            return <>{props.children}</>;
          },
        }}
      >
        {content || ''}
      </ReactMarkdown>
      {isStreaming && <span className="dsrt-caret" aria-hidden />}
    </div>
  );
}
