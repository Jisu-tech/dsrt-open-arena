import React from 'react';
import Link from 'next/link';
import { Zap, Swords, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-accent text-xs font-mono font-semibold mb-6">
        <Zap size={12} /> Twelve-Engine LLM Amplification Active
      </div>

      <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
        Continuous Context & Measurable Amplification
      </h1>

      <p className="mt-4 text-secondary text-sm leading-relaxed max-w-2xl">
        DSRT Open Arena enhances standard LLMs across reasoning, instruction synthesis, endless context retrieval, and model orchestration without modifying model weights.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-xl">
        <Link href="/work" className="group p-6 border border-border rounded-card bg-white hover:border-accent hover:shadow-md transition-all text-left">
          <div className="flex items-center justify-between mb-3">
            <Zap className="text-accent" size={24} />
            <ArrowRight size={16} className="text-secondary group-hover:text-accent transition-colors" />
          </div>
          <h3 className="font-bold text-foreground text-base">Work Mode</h3>
          <p className="text-xs text-secondary mt-1">Continuous workspace for deep problem solving and code generation.</p>
        </Link>

        <Link href="/war" className="group p-6 border border-border rounded-card bg-white hover:border-accent hover:shadow-md transition-all text-left">
          <div className="flex items-center justify-between mb-3">
            <Swords className="text-accent" size={24} />
            <ArrowRight size={16} className="text-secondary group-hover:text-accent transition-colors" />
          </div>
          <h3 className="font-bold text-foreground text-base">War Mode</h3>
          <p className="text-xs text-secondary mt-1">Side-by-side benchmark comparison between Raw vs. Amplified execution.</p>
        </Link>
      </div>
    </div>
  );
}