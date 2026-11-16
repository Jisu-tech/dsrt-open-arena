import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const styles = {
    default: 'bg-panel text-text-muted border-border',
    success: 'bg-success-bg text-success border-success/30',
    warning: 'bg-warning-bg text-warning border-warning/30',
    error: 'bg-error-bg text-error border-error/30',
    outline: 'bg-transparent text-text-faint border-border',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}