// Small stroke icon set (24px grid, currentColor) so the app needs no icon font.
import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({
  className = "h-5 w-5",
  children,
  strokeWidth = 2,
}: IconProps & { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={2.4}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={2.4}>
      <path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export function MoreIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={2.6}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

export function BackspaceIcon(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={1.8}>
      <path d="M21 5H8.5L2 12l6.5 7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
      <path d="M17 9.5l-5 5M12 9.5l5 5" />
    </Svg>
  );
}

export function LogoutIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 16l-4-4 4-4M5 12h10" />
    </Svg>
  );
}

export function PlaylistIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h12M4 12h12M4 18h7" />
      <path d="M16 15.5v5l4-2.5z" fill="currentColor" strokeWidth={1.5} />
    </Svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

export function SlidesIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="7" width="15" height="11" rx="2" />
      <path d="M7 4h12a2 2 0 0 1 2 2v9" />
    </Svg>
  );
}

export function OfflineIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5" />
      <path d="M12 20h.01" />
    </Svg>
  );
}
