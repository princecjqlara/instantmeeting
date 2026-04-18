# Design System

A Resend-inspired dark, editorial design system for the marketing surface
(landing, pricing, signup, login). Product / app surfaces can keep their
existing visual language — this doc is the rulebook for public-facing pages.

## 1. Atmosphere

- Pure black canvas (`#000000`). The background IS the whitespace.
- Near-white text (`#f0f0f0`). Secondary at `#a1a4a5`, tertiary at `#5c5c5c`.
- Frost borders: every divider, card edge, pill, and panel uses
  `rgba(214, 235, 253, 0.19)` — icy, slightly blue, 19% opacity. Never
  neutral gray.
- No decorative gradients. No box-shadow elevation — depth comes from the
  frost border catching light against the void.
- Typography-led hierarchy: large serif display, geometric section
  headings, Inter body. Headlines earn their space.

## 2. Color tokens

| Token | Value | Use |
|-------|-------|-----|
| `--color-bg` | `#000000` | Page background |
| `--color-fg` | `#f0f0f0` | Primary text, button labels |
| `--color-fg-strong` | `#ffffff` | Max-emphasis text, highlights |
| `--color-fg-muted` | `#a1a4a5` | Secondary text, descriptions |
| `--color-fg-dim` | `#5c5c5c` | Tertiary text, disabled |
| `--color-border` | `rgba(214, 235, 253, 0.19)` | Borders, dividers, pills |
| `--color-border-soft` | `rgba(217, 237, 254, 0.145)` | Subtle list dividers |
| `--color-ring` | `rgba(176, 199, 217, 0.145)` | Shadow-as-border ring |
| `--color-surface-hover` | `rgba(255, 255, 255, 0.08)` | Ghost hover |
| `--color-surface-solid-hover` | `rgba(255, 255, 255, 0.28)` | Primary hover |
| `--accent-orange` | `#ff801f` | Warm accent |
| `--accent-green` | `#11ff99` | Success accent |
| `--accent-blue` | `#3b9eff` | Link / info accent |
| `--accent-yellow` | `#ffc53d` | Warning / highlight |
| `--accent-red` | `#ff2047` | Error / destructive |

Accent backgrounds use the hex at 12–22% alpha; accent text uses full opacity.

## 3. Typography

Font stacks (graceful fallbacks — custom Domaine/ABC Favorit can be
layered later without touching components):

- `--font-display`: `'Domaine Display', 'Fraunces', 'Playfair Display', ui-serif, Georgia, serif`
- `--font-section`: `'ABC Favorit', Inter, ui-sans-serif, system-ui, sans-serif`
- `--font-body`: `Inter, ui-sans-serif, system-ui, sans-serif`
- `--font-mono`: `'Commit Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Scale

| Role | Font | Size | Weight | Line-height | Letter-spacing |
|------|------|------|--------|-------------|----------------|
| Hero | display | 96px (76.8px mobile) | 400 | 1.00 | -0.96px |
| Section heading | section | 56px | 400 | 1.10 | -2.8px |
| Sub-heading | section | 20px | 400 | 1.30 | 0 |
| Feature title | body | 24px | 500 | 1.40 | 0 |
| Body L | body | 18px | 400 | 1.55 | 0 |
| Body | body | 16px | 400 | 1.55 | 0 |
| Nav | section | 14px | 500 | 1.40 | +0.35px (only positive tracking in system) |
| Button | body | 14px | 600 | 1.40 | 0 |
| Small / caption | body | 12px | 500 | 1.35 | 0 |

Enable OpenType `"ss01", "ss04", "ss11"` on `--font-display`
and `--font-section`. Enable `"ss01", "ss03", "ss04"` on nav.

## 4. Components

### Buttons

- **Primary (transparent pill)**: transparent bg, `#f0f0f0` text, 9999px
  radius, 1px frost border, padding `10px 18px`. Hover: bg
  `rgba(255,255,255,0.08)`.
- **Primary solid**: `#ffffff` bg, `#000000` text, 9999px radius, same
  padding. Hover: bg `rgba(255,255,255,0.88)`. Used for the single
  highest-intent CTA per page ("Join now").
- **Ghost**: transparent, no border, 4px radius, muted text, secondary
  actions only.

### Cards & panels

- Transparent or very subtle tint (`rgba(255,255,255,0.015)`).
- 1px frost border. Radius 16px (standard) / 24px (large sections).
- No box-shadow elevation; rely on ring shadow `0 0 0 1px var(--color-ring)`.

### Inputs

- Background `rgba(255,255,255,0.02)`, 1px frost border, 10px radius.
- Text `#f0f0f0`, placeholder `#5c5c5c`.
- Focus: border `rgba(214, 235, 253, 0.45)` + ring shadow.

### Badges / pills

- Pill shape (9999px). Either frost-border transparent, or accent at
  18–22% alpha background with full-opacity accent text. Never mix accents
  inside one pill.

## 5. Layout

- Base spacing unit 8px. Standard stops: 4, 8, 12, 16, 20, 24, 32, 40,
  56, 80, 120 px.
- Max content width 1120px; hero content capped at 880px for readability.
- Vertical rhythm between marketing sections: 80–120px.
- Single-column hero on all widths; feature grid `auto-fit minmax(280px,1fr)`.

## 6. Dos / Don'ts

**Do**
- Keep backgrounds pure black.
- Use frost borders for every structural line.
- Give the hero serif its space — one big headline per page.
- Use +0.35px tracking on nav only.

**Don't**
- Don't layer radial colored gradients as "blobs" — the void is the mood.
- Don't use neutral gray borders.
- Don't mix accent colors in one component.
- Don't ship drop-shadows for elevation on black — they're invisible.

## 7. Scope

This system applies to `/` (landing), `/onboarding`, `/login` / `/signup`
dialogs. The host dashboard and in-app product surfaces keep their
existing design.
