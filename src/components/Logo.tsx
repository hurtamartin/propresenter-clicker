// App mark: two stacked slides with a forward chevron, orange on white.
// Kept in sync with public/icon.svg.

export default function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="logo-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A2B" />
          <stop offset="1" stopColor="#FF5A0F" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="#FFFFFF" />
      <rect x="168" y="136" width="232" height="148" rx="30" fill="#FFC8A2" />
      <rect
        x="112"
        y="204"
        width="272"
        height="172"
        rx="34"
        fill="url(#logo-front)"
        stroke="#FFFFFF"
        strokeWidth="16"
        paintOrder="stroke"
      />
      <path
        d="M228 252l42 38-42 38"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
