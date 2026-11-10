/**
 * Visual themes ("skins"). Same geometry, levels and interactions; only
 * colours, materials, beam profile, type and tone change.
 * Toy loom is the default identity; Workshop is the alternate.
 */
export interface Palette {
  /** Light yarn (lifted warp shows). */
  warp: number;
  /** Dark yarn (weft shows). */
  weft: number;
  /** Beams. */
  wood: number;
  /** Side rails and heddle. */
  rail: number;
  /** Shuttle. */
  shuttle: number;
  /** One colour per lever knob. */
  knobs: [number, number, number, number];
}

export type ThemeId = 'toy' | 'workshop';

export interface Theme {
  id: ThemeId;
  name: string;
  palette: Palette;
  /** Beam profile: rounded capsules (toy) or squared timber (workshop). */
  beam: 'round' | 'square';
  woodRoughness: number;
  knobRoughness: number;
  knobMetalness: number;
  track: number;
  /** CSS font-family list for in-world text. */
  font: string;
  labelBg: string;
  labelText: string;
  paper: string;
  ink: string;
  /** Pluck brightness multiplier (lowpass). */
  tone: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  toy: {
    id: 'toy',
    name: 'Toy loom',
    palette: {
      warp: 0xfff6e8, // cream
      weft: 0xe2563b, // tomato
      wood: 0xf2b632, // mustard
      rail: 0x2a9d8f, // teal
      shuttle: 0x3d5a80, // navy
      // Lever colours chosen to pop on the yellow box and navy felt (and against
      // cream threads when a lever lights its threads): tomato, teal, pink, lime.
      knobs: [0xe8553e, 0x1fb3a0, 0xe8679e, 0x7cc142],
    },
    beam: 'round',
    woodRoughness: 0.75,
    knobRoughness: 0.28,
    knobMetalness: 0,
    track: 0x2b2118,
    font: "'Lilita One', system-ui, -apple-system, sans-serif",
    labelBg: 'rgba(43,33,24,0.82)',
    labelText: '#fff6e8',
    paper: '#fff6e8',
    ink: '#2b2118',
    tone: 1,
  },
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    palette: {
      warp: 0xefe4cf, // undyed linen
      weft: 0x2e4a7a, // indigo
      wood: 0xb07a4f, // honey oak
      rail: 0x6b4630, // walnut
      shuttle: 0xd4b48a, // boxwood
      knobs: [0xc9a14a, 0xc9a14a, 0xc9a14a, 0xc9a14a], // brass
    },
    beam: 'square',
    woodRoughness: 0.55,
    knobRoughness: 0.32,
    knobMetalness: 0.75,
    track: 0x3b2a20,
    font: "'Fraunces', Georgia, 'Times New Roman', serif", // loaded on demand
    labelBg: 'rgba(59,42,32,0.86)',
    labelText: '#f1e6cf',
    paper: '#f1e6cf',
    ink: '#3b2a20',
    tone: 0.75,
  },
};

export const DEFAULT_THEME: ThemeId = 'toy';

export function otherTheme(id: ThemeId): ThemeId {
  return id === 'toy' ? 'workshop' : 'toy';
}

const hcCache = new Map<ThemeId, Theme>();

/**
 * High-contrast variant: pure white/near-black yarns, opaque ink labels.
 * Same object per theme id, so callers can compare by identity.
 */
export function highContrast(t: Theme): Theme {
  let v = hcCache.get(t.id);
  if (!v) {
    v = {
      ...t,
      palette: { ...t.palette, warp: 0xffffff, weft: 0x111111 },
      labelBg: 'rgba(0,0,0,0.95)',
      labelText: '#ffffff',
      paper: '#ffffff',
      ink: '#000000',
    };
    hcCache.set(t.id, v);
  }
  return v;
}
