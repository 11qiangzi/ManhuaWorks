# Visual Boundary Document — 千机工坊 Design System

> Authority: P0-3 Design System Enforcement | Last updated: 2026-06-19
> Scope: All 6 frontend apps (web, studio, admin-portal, user-portal, ops-portal, dev-portal)

---

## 1. Brand Identity: 墨韵科技风

千机工坊's visual language is **Eastern ink elegance meets modern tech precision**.

Think: a Song-dynasty scholar's desk next to a 4K monitor. The ink stone (砚台) sits beside a
mechanical keyboard. Calligraphic strokes live alongside monospace code. The aesthetic is
**restrained, deliberate, and warm** — never aggressive, never flashy.

### Core brand colors

| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| `brand-cyan` | `#00BFA5` | 千机青 | Primary brand accent, CTAs, active states, links |
| `brand-cyan-dark` | `#0D9488` | 千机青深 | Hover/pressed states on cyan |
| `brand-cyan-light` | `#5EEAD4` | 千机青浅 | Subtle highlights, badges |
| `brand-purple` | `#7C3AED` | 墨韵紫 | Secondary accent, creative features, tags |
| `brand-purple-dark` | `#5B21B6` | 墨韵紫深 | Hover/pressed states on purple |
| `brand-purple-light` | `#A78BFA` | 墨韵紫浅 | Subtle purple highlights |
| `surface-bg` | `#0E0F12` | 砚台黑 | Page background (dark theme) |
| `surface-panel` | `#1A1C21` | 宣纸灰 | Cards, panels, elevated surfaces |

---

## 2. Allowed Patterns (from mmx-iokle-site reference)

These visual techniques ARE consistent with 墨韵科技风:

### 2.1 Glassmorphism (backdrop-blur)

```
Allowed:
  backdrop-blur-sm / backdrop-blur-md on panels, modals, navbars
  bg-surface-panel/80 + backdrop-blur for frosted-glass overlays
  border border-surface-border/50 on glass panels
```

Rationale: Glass effects echo the translucency of rice paper (宣纸) and ink-wash layering.

### 2.2 Subtle glow (box-shadow with brand colors)

```
Allowed:
  shadow-glow (千机青 glow) on active cards, focused inputs
  shadow-glow-purple (墨韵紫 glow) on creative-tool panels
  Glow radius max 15px — must be subtle, not blinding
```

Rationale: A soft glow mimics the luminosity of ink on polished stone.

### 2.3 Gradient buttons

```
Allowed:
  bg-gradient-to-r from-brand-cyan to-brand-purple (horizontal)
  bg-gradient-to-br from-brand-cyan to-brand-cyan-dark (diagonal mono)
  Gradient angle: 135deg or 90deg only
```

Rationale: Gradients should feel like ink flowing across paper — smooth, directional, natural.

### 2.4 Micro-animations

```
Allowed:
  transition-all duration-base ease-out on interactive elements
  Subtle scale transforms (scale-105) on hover
  Fade-in on page mount (opacity 0→1, 280ms)
```

---

## 3. Forbidden Patterns

These visual elements are **explicitly prohibited** across all 6 apps:

### 3.1 Neon scan lines

```
FORBIDDEN:
  Repeating linear-gradient scan line overlays
  Animated scan line effects (top-to-bottom sweep)
  CRT monitor simulation effects
```

Reason: Cyberpunk aggression contradicts 墨韵科技风's calm precision.

### 3.2 HUD decorations

```
FORBIDDEN:
  Corner bracket decorations (┌ ┐ └ ┘ style overlays)
  Targeting reticle / crosshair UI elements
  Hexagonal grid overlays
  Tactical/military-style data readouts with blinking cursors
```

Reason: HUD elements imply combat/surveillance context, which is alien to a creative workshop.

### 3.3 Neon pink / purple glow

```
FORBIDDEN COLORS (as neon glow effects):
  #ec4899  (Tailwind pink-500)
  #8b5cf6  (Tailwind violet-500) — as neon glow; allowed as text/subtle fill
  #d946ef  (Tailwind fuchsia-500)
  #f472b6  (Tailwind pink-400)

  Any box-shadow or text-shadow using the above colors is forbidden.
```

Reason: Neon pink/purple glow is the signature of cyberpunk aesthetics. It clashes with
千机青 (#00BFA5) and 墨韵紫 (#7C3AED) brand colors and creates visual confusion.

Note: `#7C3AED` (brand-purple / 墨韵紫) IS allowed as a fill/text color. The prohibition
is specifically on using violet/pink hues as **neon glow effects** (large-radius box-shadows,
text-shadows, or animated pulse effects).

### 3.4 Cyberpunk grid textures

```
FORBIDDEN:
  Perspective grid backgrounds (vanishing-point wire grids)
  Tron-style light trails on dark backgrounds
  Matrix-style falling character animations as backgrounds
  Glitch/distortion effects on text or images
```

Reason: Grid textures create visual noise that competes with content and feels generic.

### 3.5 Additional forbidden items

```
FORBIDDEN:
  Animated neon border outlines (pulsing/rotating border colors)
  Excessive use of text-shadow for glow effects
  RGB split / chromatic aberration effects
  Vaporwave aesthetic elements (Roman busts, palm trees, sunset gradients)
```

---

## 4. Color Usage Rules

### 4.1 Always use design tokens

All colors in Vue templates, CSS, and inline styles must reference the design-system tokens
defined in `packages/ui/tailwind.base.ts`.

```
GOOD:
  class="bg-brand-cyan text-text-primary"
  class="border-surface-border shadow-card"
  style="color: var(--brand-cyan)"

BAD:
  class="bg-[#00BFA5]"        ← hardcoded hex
  style="color: #EF4444"      ← should be text-semantic-error
  :style="{ background: '#1A1C21' }"  ← should be surface-panel
```

### 4.2 Theme-awareness

All 6 apps support 5 themes (dark, light, sepia, midnight, neon). Colors must work across all
themes. Hardcoded values will break theme switching.

Use CSS variables for any color that needs to respond to theme changes:
```
var(--brand-cyan, #00BFA5)     ← with fallback for SSR
```

### 4.3 Contrast requirements

- Text on brand-color backgrounds: use `text-inverse` (砚台黑 on light, 白 on dark)
- Interactive elements: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text / headings: minimum 3:1 contrast ratio

---

## 5. Enforcement

### Automated scanning

The CI pipeline runs `scripts/check-design-tokens.ts` which scans all `.vue`, `.ts`, `.tsx`
files under `apps/` for hardcoded hex/rgb/hsl color values.

```bash
# Local check
npx tsx scripts/check-design-tokens.ts

# Exit codes:
#   0 = clean
#   1 = violations found (blocks CI)
```

### Tailwind config enforcement

Each app's `tailwind.config.js` MUST extend `baseTheme` from `@manhuaworks/ui/tailwind.base`.
Removing or overriding the base extension is a code-review blocker.

### Code review checklist

- [ ] No hardcoded hex/rgb/hsl values in Vue templates or inline styles
- [ ] No forbidden neon colors used as glow effects
- [ ] No HUD / cyberpunk decorative elements
- [ ] New components use design-token classes exclusively
- [ ] tailwind.config.js extends baseTheme without override

---

## 6. Exception Process

If a specific use case genuinely requires a color outside the token system (e.g., a third-party
chart library that needs raw hex):

1. Add the color to the allowlist in `scripts/check-design-tokens.ts` with a comment explaining why
2. Document the exception in the component's JSDoc
3. Get approval from the design-system owner (迫事部)

---

*This document is the single source of truth for visual boundaries. When in doubt, ask:
"Would a Song-dynasty scholar approve of this?" If not, it's probably too cyberpunk.*
