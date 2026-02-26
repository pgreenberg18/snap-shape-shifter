

# Visual Reskin: Cinematic Minimal Post-Production Suite

## Summary
A purely visual/material refresh across the entire UI -- updating colors, materials, borders, shadows, glows, control skins, and cinematic accents. Zero layout, spacing, or behavioral changes.

---

## Phase 1: Color & CSS Variable Overhaul (`src/index.css`)

Update all CSS custom properties in `:root` and `.dark`:

| Token | Current (Kodak Yellow theme) | New (Cinema Blue theme) |
|-------|------------------------------|------------------------|
| `--background` | `225 30% 6%` | `224 40% 4%` (deeper #07090F to #0D1324) |
| `--foreground` | `0 0% 93%` | `0 0% 100%` (pure white primary text) |
| `--card` | `222 12% 10%` | `222 30% 7%` (#111827 cool blue-black) |
| `--primary` | `51 100% 50%` (yellow) | `217 100% 59%` (#2F7DFF electric blue) |
| `--primary-foreground` | `225 30% 6%` | `0 0% 100%` (white on blue) |
| `--secondary` | `220 12% 16%` | `222 25% 11%` (darker metal) |
| `--muted-foreground` | `240 4% 65%` | `220 10% 70%` (rgba 255,255,255,0.70 equivalent) |
| `--ring` | `51 100% 50%` (yellow) | `217 100% 59%` (blue) |
| `--border` | `221 12% 20%` | `220 15% 14%` (subtler) |
| `--cinema-glow` | `51 100% 50%` (yellow) | `217 100% 59%` (blue) |
| `--cinema-surface` | `220 12% 16%` | `222 25% 11%` |
| `--cinema-surface-elevated` | `220 12% 20%` | `222 20% 14%` |

Add new custom property:
- `--cinema-highlight: 197 80% 72%` (#7CCBFF cool cyan for micro highlights)

Mirror all changes into `.dark` block and sidebar variables.

---

## Phase 2: Utility Classes Update (`src/index.css`)

**`.cinema-shadow`** -- deeper, more dramatic:
```css
box-shadow:
  0 0 0 1px rgba(255,255,255,0.06),
  0 12px 40px rgba(0,0,0,0.6),
  0 0 18px rgba(47,125,255,0.15);
```

**`.cinema-glow`** -- blue controlled optical glow:
```css
box-shadow:
  0 0 18px -4px rgba(47,125,255,0.35),
  0 0 8px -2px rgba(47,125,255,0.15);
```

**`.cinema-inset`** -- refined glass-metal specular edges:
```css
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.08),
  inset 0 -1px 0 rgba(0,0,0,0.3);
```

**New `.cinema-panel`** utility -- glass-metal hybrid material for panels:
```css
background: linear-gradient(145deg, #0F172A, #0B1220);
border: 1px solid rgba(255,255,255,0.06);
backdrop-filter: blur(10px);
box-shadow: 0 20px 60px rgba(0,0,0,0.55);
```

**New `.cinema-bloom`** -- subtle optical bloom overlay:
```css
background: radial-gradient(
  circle at 80% 20%,
  rgba(124,203,255,0.08),
  rgba(47,125,255,0.03),
  transparent 60%
);
pointer-events: none;
```

**Fader slider track/thumb** -- update from yellow accent to blue, darken track to anodized metal (#0B1220), refine thumb gradients.

**Color temperature slider thumb** -- same metal refinement.

---

## Phase 3: Tailwind Config Updates (`tailwind.config.ts`)

- Add `cinema.highlight` color mapped to `--cinema-highlight`
- Update phase tints in Layout.tsx to cooler blue-shifted hues
- No radius, spacing, or breakpoint changes

---

## Phase 4: UI Component Skins (shadcn primitives)

All changes are class/style-only -- no structural changes.

**`button.tsx`** -- Film hardware controls:
- Default variant: `linear-gradient(180deg, #1E293B, #0F172A)` with specular inset highlight and deep shadow
- Hover: luminance lift + micro blue edge glow
- Keep all sizes and variants, only update color values

**`slider.tsx`** -- Hardware-grade fader:
- Track: 4px height, #0B1220 anodized metal background
- Thumb: 18px circular, brushed metal gradient with specular border
- Range: blue gradient fill

**`switch.tsx`** -- Physical rocker switch:
- Unchecked: dark inset channel
- Checked: blue LED indicator glow
- Thumb: metallic with subtle shadow

**`toggle.tsx`** -- Machined metal feel:
- Active state: blue backlight glow instead of accent bg

**`card.tsx`** -- Glass-metal hybrid:
- Add `backdrop-filter: blur(10px)` via className
- Refined border with `rgba(255,255,255,0.06)`

**`badge.tsx`** -- Slimmer, refined pills:
- Reduce radius to `rounded-2xl` (16px)
- Add subtle inner edge light

**`progress.tsx`** -- Blue fill, darker track

**`input.tsx`** -- Darker input wells with blue focus ring

---

## Phase 5: Background & Ambient Effects (`src/index.css`)

- Add ultra-light film grain texture (2-3% opacity CSS noise)
- Add `.cinema-bloom` pseudo-element for hero sections
- Refine existing keyframe animations to use blue glow instead of yellow

---

## Files Modified (all visual-only)

| File | Changes |
|------|---------|
| `src/index.css` | CSS variables, utility classes, slider skins, grain texture, bloom |
| `tailwind.config.ts` | New cinema.highlight color |
| `src/components/ui/button.tsx` | Variant color classes |
| `src/components/ui/slider.tsx` | Track/thumb classes |
| `src/components/ui/switch.tsx` | Rocker switch styling |
| `src/components/ui/toggle.tsx` | Active state glow |
| `src/components/ui/card.tsx` | Glass-metal material classes |
| `src/components/ui/badge.tsx` | Radius + edge light |
| `src/components/ui/progress.tsx` | Track/fill colors |
| `src/components/ui/input.tsx` | Well color + focus ring |
| `src/components/layout/Layout.tsx` | Phase tint hues (style prop only) |

No files added or removed. No layout, grid, spacing, navigation, or interaction logic touched.

