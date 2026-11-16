import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-40 disabled:pointer-events-none rounded-md';

  const variants = {
    primary: 'bg-text text-bg hover:bg-accent-hover',
    secondary: 'bg-panel text-text border border-border hover:bg-panel-hover hover:border-border-hover',
    outline: 'border border-border bg-transparent hover:bg-panel text-text',
    ghost: 'text-text-muted hover:text-text hover:bg-panel-hover',
    danger: 'bg-error text-white hover:bg-red-700',
  };

  const sizes = {
    sm: 'h-8 px-3 text-[12px] gap-1.5',
    md: 'h-9 px-4 text-[13px] gap-2',
    lg: 'h-10 px-5 text-[14px] gap-2',
  };

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-current fill-none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading
        </span>
      ) : (
        children
      )}
    </button>
  );
}