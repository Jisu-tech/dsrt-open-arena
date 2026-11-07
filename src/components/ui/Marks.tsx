import React from 'react';

/** Royal / classic calligraphic marks — body UI stays Inter; these are display-only SVGs. */

export function WorkMark({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 36"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WORK"
      role="img"
    >
      <defs>
        <linearGradient id="dsrt-work-fill" x1="0" y1="0" x2="140" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8a6a28" />
          <stop offset="45%" stopColor="#d4b56a" />
          <stop offset="100%" stopColor="#6e5418" />
        </linearGradient>
      </defs>
      <text
        x="70"
        y="28"
        textAnchor="middle"
        fill="url(#dsrt-work-fill)"
        style={{
          fontFamily: "Algerian, 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 6,
        }}
      >
        WORK
      </text>
    </svg>
  );
}

export function WarMark({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 110 36"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WAR"
      role="img"
    >
      <defs>
        <linearGradient id="dsrt-war-fill" x1="0" y1="0" x2="110" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7a1515" />
          <stop offset="45%" stopColor="#c43c3c" />
          <stop offset="100%" stopColor="#4a0d0d" />
        </linearGradient>
      </defs>
      <text
        x="55"
        y="28"
        textAnchor="middle"
        fill="url(#dsrt-war-fill)"
        style={{
          fontFamily: "Algerian, 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 6,
        }}
      >
        WAR
      </text>
    </svg>
  );
}