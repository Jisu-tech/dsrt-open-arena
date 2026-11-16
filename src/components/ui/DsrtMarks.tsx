import React from 'react';
import Image from 'next/image';

/**
 * Official DSRT logo (PNG from /public).
 * Use this everywhere the brand appears.
 */
export function DsrtLogo({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/dsrt-logo.png"
      alt="DSRT"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

/**
 * DSRT brand lockup — logo + wordmark.
 */
export function DsrtBrand({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <DsrtLogo size={size} />
      <span className="text-[13px] font-semibold tracking-tight text-text">
        Dsrt AI
      </span>
    </div>
  );
}

/**
 * Work Mode mark — a clean quill stroke.
 */
export function WorkModeMark({
  size = 16,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M2 14 L12 4 L14 6 L4 16 L2 16 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        transform="translate(0, -1)"
      />
      <path
        d="M10 4 L12 2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * War Mode mark — two parallel bars (side-by-side comparison).
 */
export function WarModeMark({
  size = 16,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <rect
        x="2"
        y="3"
        width="4.5"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="9.5"
        y="3"
        width="4.5"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <line
        x1="8"
        y1="5"
        x2="8"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  );
}

/**
 * Docs mark — a simple book spine.
 */
export function DocsMark({
  size = 16,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M3 2.5 L3 13.5 Q3 14 3.5 14 L12.5 14 Q13 14 13 13.5 L13 2.5 Q13 2 12.5 2 L3.5 2 Q3 2 3 2.5 Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <line
        x1="5.5"
        y1="5"
        x2="10.5"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="5.5"
        y1="8"
        x2="10.5"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="5.5"
        y1="11"
        x2="8.5"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Conversation mark — minimal chat glyph.
 */
export function ChatMark({
  size = 14,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M2 3 Q2 2 3 2 L11 2 Q12 2 12 3 L12 9 Q12 10 11 10 L6 10 L3 12.5 L3 10 Q2 10 2 9 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Pin mark — for pinned conversations.
 */
export function PinMark({
  size = 12,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M6 1 L8 3 L8 6 L10 8 L7 8 L7 11 L5 11 L5 8 L2 8 L4 6 L4 3 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
}