'use client';

import React from 'react';
import { formatPct, formatScore } from '@/lib/warmode/metrics';
import type { RubricEvaluation, DimensionJudgement } from '@/lib/warmode/evaluator';

type Props = {
  evaluation: RubricEvaluation | null;
  isEvaluating?: boolean;
  error?: string | null;
};

function scoreColor(score: number): string {
  if (score >= 8) return 'text-success';
  if (score >= 5.5) return 'text-foreground';
  if (score >= 3.5) return 'text-warning';
  return 'text-error';
}

function deltaBadge(direct: number, amplified: number): { text: string; className: string } {
  if (direct === 0 && amplified === 0) {
    return { text: '0%', className: 'bg-workspace text-secondary' };
  }
  const pct = direct === 0 ? amplified * 100 : ((amplified - direct) / direct) * 100;
  if (Math.abs(pct) < 0.05) {
    return { text: '0%', className: 'bg-workspace text-secondary' };
  }
  if (pct > 0) {
    return {
      text: formatPct(pct),
      className: 'bg-emerald-50 text-success border border-emerald-100',
    };
  }
  return {
    text: formatPct(pct),
    className: 'bg-red-50 text-error border border-red-100',
  };
}

function DimensionRow({ dim }: { dim: DimensionJudgement }) {
  const badge = deltaBadge(dim.direct_score, dim.amplified_score);
  return (
    <div className="border border-border rounded-card p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{dim.label}</div>
          {dim.rationale ? (
            <p className="text-xs text-secondary mt-1 leading-relaxed">{dim.rationale}</p>
          ) : null}
        </div>
        <span className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-input bg-workspace border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-secondary font-medium">
              Direct
            </span>
            <span className={`text-sm font-semibold font-mono ${scoreColor(dim.direct_score)}`}>
              {formatScore(dim.direct_score)}
            </span>
          </div>
          {dim.direct_evidence ? (
            <p className="text-[11px] text-secondary leading-relaxed italic line-clamp-4">
              “{dim.direct_evidence}”
            </p>
          ) : (
            <p className="text-[11px] text-secondary">No evidence quote</p>
          )}
        </div>

        <div className="rounded-input bg-workspace border border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-secondary font-medium">
              Amplified
            </span>
            <span className={`text-sm font-semibold font-mono ${scoreColor(dim.amplified_score)}`}>
              {formatScore(dim.amplified_score)}
            </span>
          </div>
          {dim.amplified_evidence ? (
            <p className="text-[11px] text-secondary leading-relaxed italic line-clamp-4">
              “{dim.amplified_evidence}”
            </p>
          ) : (
            <p className="text-[11px] text-secondary">No evidence quote</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RubricDisplay({ evaluation, isEvaluating, error }: Props) {
  if (isEvaluating) {
    return (
      <div className="border border-border rounded-card p-6 bg-white">
        <div className="text-sm font-semibold text-foreground mb-1">Rubric evaluation</div>
        <p className="text-xs text-secondary">
          Judge model scoring both sides across 5 dimensions…
        </p>
        <div className="mt-4 h-1.5 w-full rounded-full bg-workspace overflow-hidden">
          <div className="h-full w-1/3 bg-accent animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 rounded-card p-4 bg-red-50">
        <div className="text-sm font-semibold text-error mb-1">Evaluation unavailable</div>
        <p className="text-xs text-error/90">{error}</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="border border-border rounded-card p-6 bg-white">
        <div className="text-sm font-semibold text-foreground mb-1">Rubric evaluation</div>
        <p className="text-xs text-secondary">
          5-dimension scores with evidence quotes appear here after both sides complete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-sm font-semibold text-foreground">Rubric breakdown</div>
          <p className="text-[11px] text-secondary mt-0.5">
            Judge: {evaluation.evaluator_provider}/{evaluation.evaluator_model}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-secondary">Overall</div>
          <div className="text-xs font-mono text-foreground">
            <span className={scoreColor(evaluation.direct_overall)}>
              {formatScore(evaluation.direct_overall)}
            </span>
            <span className="text-secondary mx-1">→</span>
            <span className={scoreColor(evaluation.amplified_overall)}>
              {formatScore(evaluation.amplified_overall)}
            </span>
          </div>
        </div>
      </div>

      {evaluation.reasoning ? (
        <div className="border border-border rounded-card p-4 bg-workspace">
          <div className="text-[10px] uppercase tracking-wide text-secondary mb-1.5 font-medium">
            Judge reasoning
          </div>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {evaluation.reasoning}
          </p>
        </div>
      ) : null}

      {evaluation.dimensions.map((dim) => (
        <DimensionRow key={dim.key} dim={dim} />
      ))}
    </div>
  );
}