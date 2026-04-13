/** VibeFlow Design System — single source of truth for all visual tokens. */

export const C = {
  // ── Backgrounds ─────────────────────────────────────────────────────
  bg0:   '#07070e',   // deepest bg (app shell)
  bg1:   '#0d0d18',   // primary surface
  bg2:   '#13131f',   // cards, panels
  bg3:   '#1a1a2b',   // hover
  bg4:   '#222235',   // active / selected
  bg5:   '#2a2a40',   // input backgrounds

  // ── Borders ────────────────────────────────────────────────────────
  border:  '#1e1e30',
  border2: '#2c2c44',

  // ── Text ───────────────────────────────────────────────────────────
  text1: '#eeeef8',   // primary
  text2: '#9090b0',   // secondary
  text3: '#52526e',   // dim / placeholder

  // ── Accent (purple-indigo) ────────────────────────────────────────
  accent:    '#7c6af7',
  accentHov: '#9485f8',
  accentBg:  'rgba(124,106,247,0.10)',
  accentBg2: 'rgba(124,106,247,0.18)',

  // ── Status ─────────────────────────────────────────────────────────
  green:     '#10b981',
  greenBg:   'rgba(16,185,129,0.12)',
  greenBd:   'rgba(16,185,129,0.25)',

  yellow:    '#f59e0b',
  yellowBg:  'rgba(245,158,11,0.12)',
  yellowBd:  'rgba(245,158,11,0.25)',

  red:       '#f43f5e',
  redBg:     'rgba(244,63,94,0.12)',
  redBd:     'rgba(244,63,94,0.25)',

  blue:      '#38bdf8',
  blueBg:    'rgba(56,189,248,0.10)',
  blueBd:    'rgba(56,189,248,0.22)',

  teal:      '#2dd4bf',
  tealBg:    'rgba(45,212,191,0.10)',
} as const;

export const R = {
  sm:  4,
  md:  8,
  lg:  12,
  xl:  16,
  '2xl': 20,
  full: 9999,
} as const;

export const S = {
  shadow:    '0 2px 16px rgba(0,0,0,0.5)',
  shadowLg:  '0 8px 40px rgba(0,0,0,0.7)',
  glow:      '0 0 0 1px rgba(124,106,247,0.4)',
} as const;

/** Shared input style */
export const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: C.bg5,
  color: C.text1,
  border: `1px solid ${C.border2}`,
  borderRadius: R.md,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
};

/** Shared button styles */
export const btn = {
  base: {
    padding: '7px 16px',
    border: 'none',
    borderRadius: R.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s, transform 0.1s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  primary: {
    backgroundColor: C.accent,
    color: '#fff',
  },
  success: {
    backgroundColor: C.green,
    color: '#fff',
  },
  danger: {
    backgroundColor: C.red,
    color: '#fff',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: C.text2,
    border: `1px solid ${C.border2}`,
  },
  subtle: {
    backgroundColor: C.bg4,
    color: C.text1,
  },
} as const;

/** Badge / pill styles */
export const badge = (color: string, bg: string, border: string) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: R.full,
  backgroundColor: bg,
  color: color,
  border: `1px solid ${border}`,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.02em',
});

export const SYNC_DOT: Record<string, string> = {
  synced:   C.green,
  syncing:  C.yellow,
  degraded: C.yellow,
  offline:  C.red,
};
