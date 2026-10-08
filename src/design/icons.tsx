import type { ReactNode } from "react";

/** The few glyphs the chat needs, inline, so this folder depends on nothing else in the app. */
function Svg({ size = 20, strokeWidth = 1.5, children }: { size?: number; strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

export const Phone = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 4.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.7 6.7l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z" />
  </Svg>
);

export const Mic = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </Svg>
);

export const Waveform = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
  </Svg>
);

export const ArrowUp = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Svg>
);

export const ArrowUpRight = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);

/** Tara's mark: a sun on the horizon. */
export const Horizon = ({ size = 18 }: { size?: number }) => (
  <Svg size={size} strokeWidth={1.6}>
    <path d="M3.5 16h17" />
    <path d="M7 16a5 5 0 0 1 10 0" />
    <path d="M12 6v2.2M6.4 8.6l1.5 1.5M17.6 8.6l-1.5 1.5" />
    <path d="M8.5 19.5h7" />
  </Svg>
);
