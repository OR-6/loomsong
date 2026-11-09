# Art direction: "Toy loom"

A chunky, hand-painted wooden toy loom sitting on your real desk. It's playful and tactile, as if you could pick it up. Bright, but never neon.

## Principles

1. **Toy, not tool.** Rounded everything: capsule beams, fat ball knobs, a bobbin you want to fidget with. Proportions are slightly oversized (knobs ≥ 22 mm across; Meta's hands guidance).
2. **Painted wood, real light.** Matte painted surfaces with a subtle procedural wood grain and soft contact shadows on the real desk. No glossy plastic, no glow, no gradients on UI.
3. **Springy motion.** Levers overshoot and settle, the shuttle squashes at each end, threads twang when plucked, and the loom unfolds with a bounce. Motion carries feedback before text does.
4. **Few words, big type.** At most 5 words per label, in one chunky rounded display face. No floating panels: text lives on physical things (the card, the front beam).
5. **Colour with meaning and contrast.** Cloth patterns use two yarns with strong luminance contrast. Status is never colour-only: ticks, crosses, arrows and hatching do that job.
6. **Handmade over generated.** No AI imagery, no stock gradients, no emoji. Imperfections are deliberate (slight wobble in painted edges, uneven yarn).

## Palette

| Role | Hex | Use |
|---|---|---|
| Tomato | `#e2563b` | Accent yarn, lever 1, logo |
| Mustard | `#f2b632` | Painted beams |
| Teal | `#2a9d8f` | Side rails, lever 3 |
| Navy | `#3d5a80` | Shuttle, dark yarn |
| Cream | `#fff6e8` | Light yarn, card paper |
| Ink | `#2b2118` | Outlines, text |

Level palettes vary the yarn pair, but always keep a luminance ratio of at least 3:1.

## Type

**Lilita One** (SIL Open Font License), bundled locally as TTF with its licence (no network calls). It is used for the logo, card titles and in-world labels.

## Reference (2025 winners, for energy, not copying)

- Tiny Golf (Best Casual): a saturated toy diorama in a real room, a bold playful logo, and a character (the smiling ball).
- Inkphony (Lifestyle 1st): a clean diegetic music staff laid flat on a real table.

## Alternate theme: "Workshop" (unlockable)

Same geometry, levels and motion, re-skinned as a grown-up workshop loom. It's defined in `src/ui/theme.ts`.

- **Look:** squared honey-oak beams, walnut rails, brass knobs, a boxwood shuttle. Yarns are undyed linen and indigo (≥ 3:1 luminance contrast, enforced by a test). Paper is parchment.
- **Type:** a serif face (Fraunces planned). Until it's bundled, it falls back to Georgia.
- **Sound:** the same voices with a warmer, darker pluck filter (`tone` 0.75).
- **Unlock:** finish levels 1–3. The style token (a half-tomato, half-oak disc on the front beam) pops up with "New style unlocked". After that, poke or pinch the token to switch, or use the Toy/Workshop toggle on the 2D page. The choice is saved.
- **Public materials** (video, screenshots, store art) lead with Toy. Workshop appears as the "earned it" beat.
