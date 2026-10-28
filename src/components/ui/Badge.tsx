import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const styles = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    outline: 'bg-white text-secondary border-border',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}