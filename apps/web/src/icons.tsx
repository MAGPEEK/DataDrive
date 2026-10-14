import type { ReactNode } from "react";

/** Small stroke icons drawn for DataDrive. Decorative: the text label carries the meaning. */
const PATHS = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  file: (
    <>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />,
  download: <path d="M12 5v11m0 0-4-4m4 4 4-4M5 19h14" />,
  trash: (
    <>
      <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: <path d="m5 19 1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14 7l3 3" />,
  move: <path d="M4 12h12m0 0-4-4m4 4-4 4M20 5v14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.5" />
    </>
  ),
  refresh: <path d="M19 8a7 7 0 0 0-12.5-2M5 4v4h4M5 16a7 7 0 0 0 12.5 2M19 20v-4h-4" />,
  home: <path d="M4 11 12 4l8 7M6 10v9h12v-9" />,
  team: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 15.5a4.5 4.5 0 0 1 5.5 3.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  restore: <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrow: <path d="M3 12h17m0 0-6-6m6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  readonly name: IconName;
  readonly filled?: boolean;
  readonly size?: number;
}

export function Icon({ name, filled = false, size = 18 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
