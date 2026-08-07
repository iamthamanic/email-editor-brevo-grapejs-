/**
 * Compact inline SVG icons (list menus + editor toolbar). No icon-package dep.
 * Location: apps/editor/src/templates/icons.tsx
 */

import type { ReactNode } from "react";

type IconProps = { className?: string; size?: number };

function Svg({
  className,
  size = 16,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconDots({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4h10M6 4V3h4v1M5 4v9h6V4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7v4M8 5.2v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7h11a4 4 0 0 1 0 8h-1" {...stroke} />
      <path d="M7 3 3 7l4 4" {...stroke} />
    </Svg>
  );
}

export function IconRedo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 7H10a4 4 0 0 0 0 8h1" {...stroke} />
      <path d="M17 3l4 4-4 4" {...stroke} />
    </Svg>
  );
}

export function IconBold(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7V5z" {...stroke} />
      <path d="M7 12h7.5a3.5 3.5 0 0 1 0 7H7v-7z" {...stroke} />
    </Svg>
  );
}

export function IconItalic(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 5h8M6 19h8M14.5 5l-5 14" {...stroke} />
    </Svg>
  );
}

export function IconUnderline(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 5v6a5 5 0 0 0 10 0V5" {...stroke} />
      <path d="M5 19h14" {...stroke} />
    </Svg>
  );
}

export function IconStrike(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" {...stroke} />
      <path d="M16.5 7.5A4 4 0 0 0 12 5H9.5a3.5 3.5 0 0 0 0 7H14" {...stroke} />
      <path d="M8 16.5A4 4 0 0 0 12 19h2.5a3.5 3.5 0 0 0 0-7" {...stroke} />
    </Svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 6h12M9 12h12M9 18h12" {...stroke} />
      <path d="M4 6h.01M4 12h.01M4 18h.01" {...stroke} />
    </Svg>
  );
}

export function IconListOrdered(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M11 6h10M11 12h10M11 18h10" {...stroke} />
      <path d="M4 5v4M6 9H3M5 13l-2 4h4M3.5 19H6.5" {...stroke} />
    </Svg>
  );
}

export function IconAlignLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M4 12h10M4 18h14" {...stroke} />
    </Svg>
  );
}

export function IconAlignCenter(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M7 12h10M5 18h14" {...stroke} />
    </Svg>
  );
}

export function IconAlignRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M10 12h10M6 18h14" {...stroke} />
    </Svg>
  );
}

export function IconAlignJustify(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" {...stroke} />
    </Svg>
  );
}

export function IconLink(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.5 5.4"
        {...stroke}
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13.5 18.6"
        {...stroke}
      />
    </Svg>
  );
}

export function IconImage(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" {...stroke} />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M3 16l5-5 4 4 3-3 6 6" {...stroke} />
    </Svg>
  );
}

export function IconQuote(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 10h4v6H6v-4a4 4 0 0 1 4-4" {...stroke} />
      <path d="M17 10h4v6h-5v-4a4 4 0 0 1 4-4" {...stroke} />
    </Svg>
  );
}

export function IconClearFormat(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 5h10l-4 14H8.5" {...stroke} />
      <path d="M8 11h7M15 19l4-4M19 19l-4-4" {...stroke} />
    </Svg>
  );
}

export function IconCode(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 8 4 12l4 4M16 8l4 4-4 4M13 5l-2 14" {...stroke} />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 20.5 12 10 22.5H3.5V16L12 3.5z" {...stroke} />
      <path d="M14 6.5 17.5 10" {...stroke} />
    </Svg>
  );
}

export function IconSliders(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...stroke} />
      <circle cx="16" cy="7" r="2" {...stroke} />
      <circle cx="8" cy="17" r="2" {...stroke} />
    </Svg>
  );
}

export function IconDesktop(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" {...stroke} />
      <path d="M8 20h8M12 16v4" {...stroke} />
    </Svg>
  );
}

export function IconMobile(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" {...stroke} />
      <path d="M11 18h2" {...stroke} />
    </Svg>
  );
}

export function IconBlocks(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1" {...stroke} />
      <rect x="13" y="3" width="8" height="8" rx="1" {...stroke} />
      <rect x="3" y="13" width="8" height="8" rx="1" {...stroke} />
      <rect x="13" y="13" width="8" height="8" rx="1" {...stroke} />
    </Svg>
  );
}

export function IconVariable(p: IconProps) {
  // ponytail: literal {v} glyph — matches HVAI variable chrome
  const size = p.size ?? 18;
  return (
    <Svg {...p} size={size}>
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fill="currentColor"
        fontSize="15"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        fontWeight="700"
        letterSpacing="-0.8"
      >
        {"{v}"}
      </text>
    </Svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p} size={p.size ?? 14}>
      <path d="M6 9l6 6 6-6" {...stroke} />
    </Svg>
  );
}

export function IconColorText(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 19h14M8.5 15 12 5l3.5 10" {...stroke} />
      <path d="M9.5 12h5" {...stroke} />
    </Svg>
  );
}
