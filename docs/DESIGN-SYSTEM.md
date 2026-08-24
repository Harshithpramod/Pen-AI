# PentestAI — Landing Design System

Generated with the [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
design-system generator, then reconciled against the reference design and verified
locally. Scope: the marketing surfaces (`/` and `/auth`). The authenticated app keeps
its existing tokens untouched.

## How this was derived

The generator was run twice, because the skill's own query contract says to retry when a
result is off-topic:

| Run | Query                                                             | Verdict                                                                                                                                          |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `developer security SaaS penetration testing dark technical`      | Style **Dark Mode (OLED)** ✅ correct · Pattern _FAQ/Documentation Landing_ ❌ off-topic for a product homepage                                  |
| 2   | `B2B SaaS product landing page hero screenshot conversion signup` | Pattern **Hero + Features + CTA** ✅ correct · Style _Glassmorphism, light-mode_ ❌ contradicts the product, the reference, and the existing app |

Neither run was adopted wholesale. The **pattern** comes from run 2, the **style/mode**
from run 1, and colour + type were pinned with targeted `--domain` queries. Every
contrast pair below was then computed rather than assumed — which caught a real failure
(see Colour).

## Reference read

The reference is a dark, violet-accented product site whose identity comes from four
things, none of which the previous homepage had:

1. **Left-aligned editorial hero** — not a centred stack.
2. **Typography-led hierarchy** — large, calm, medium-weight geometric headings; no gradient shimmer.
3. **Large product surfaces** — real UI shown at size, in rounded bordered containers.
4. **Restraint** — one soft top glow; no orbs, no marquee, no cursor spotlight, no 3D tilt.

## Colour

Dark-mode-first. Blue-tinted near-black rather than pure neutral grey, matching the
reference's cooler base.

| Token                     | Value     | Role                           |
| ------------------------- | --------- | ------------------------------ |
| `--landing-bg`            | `#0A0A0F` | Page base                      |
| `--landing-surface`       | `#121218` | Cards, panels                  |
| `--landing-surface-2`     | `#17171F` | Elevated / nested surfaces     |
| `--landing-border`        | `#24242F` | Hairlines, card edges          |
| `--landing-border-strong` | `#33334A` | Hover / focus edges            |
| `--landing-fg`            | `#F5F5F8` | Headings, primary text         |
| `--landing-fg-secondary`  | `#A8A8BA` | Body copy                      |
| `--landing-fg-muted`      | `#83839A` | Meta, captions, labels         |
| `--landing-primary`       | `#7C3AED` | Interactive fill (buttons)     |
| `--landing-primary-hover` | `#6D28D9` | Fill hover                     |
| `--landing-accent`        | `#A78BFA` | Accent text, icons, focus ring |

### Verified contrast (WCAG 2.1)

Computed, not estimated. All body/UI text meets **AA 4.5:1**.

| Pair                   | Ratio | Result |
| ---------------------- | ----- | ------ |
| `#F5F5F8` on `#0A0A0F` | 18.15 | AA ✅  |
| `#A8A8BA` on `#0A0A0F` | 8.44  | AA ✅  |
| `#83839A` on `#0A0A0F` | 5.34  | AA ✅  |
| `#A8A8BA` on `#121218` | 7.97  | AA ✅  |
| `#83839A` on `#121218` | 5.05  | AA ✅  |
| `#F5F5F8` on `#121218` | 17.15 | AA ✅  |
| white on `#7C3AED`     | 5.70  | AA ✅  |
| `#A78BFA` on `#0A0A0F` | 7.26  | AA ✅  |

### The hero bloom

A large violet light rises from the bottom-centre of the hero (`landing-glow`: three
stacked ellipses — bright core, wide falloff, cool accent wash) and spills over the
section divider via `glow-seam`.

Its brightest cores sit **below** the copy block deliberately. Measured against
rendered pixels rather than assumed, a core level with the hero text pushed the muted
trust line down to **3.10:1**. Two changes fixed it: the cores moved lower, and that
line moved from `fg-muted` to `fg-secondary`. All 18 hero text nodes now clear their AA
threshold at 375/768/1440 when sampled from real screenshots.

**Why the primary is split into two tokens.** The app's existing `#8B5CF6` gives white
label text only **4.23:1** — below AA, and the generator's own pattern note calls this
out ("verify at least 4.5:1 against the button fill"). No single violet satisfies both
roles at once: darkening it to pass on a button pushes it below 4.5:1 as accent text on
the dark background. So fills use `#7C3AED` (5.70 with white) and accent text/icons use
`#A78BFA` (7.26 on base). The app's `--primary` is deliberately left alone so the
authenticated UI is unaffected.

## Typography

`--domain typography` → **Geometric Modern**: Outfit (headings) + Work Sans (body).
Outfit closely matches the reference's geometric display face. JetBrains Mono is
retained for code, file paths, and log output — it carries the developer-tool identity
that run 1 surfaced.

| Role         | Family         | Weight  | Size (desktop → mobile)                                       |
| ------------ | -------------- | ------- | ------------------------------------------------------------- |
| Display / h1 | Outfit         | 600     | `clamp(2.5rem, 6vw, 4.25rem)`, leading 1.05, tracking -0.03em |
| h2           | Outfit         | 600     | `clamp(1.875rem, 3.5vw, 2.75rem)`, leading 1.15               |
| h3           | Outfit         | 600     | 1.125rem                                                      |
| Body large   | Work Sans      | 400     | 1.125rem, leading 1.65                                        |
| Body         | Work Sans      | 400     | 1rem, leading 1.6                                             |
| Meta / label | Work Sans      | 500     | 0.8125rem, tracking 0.08em, uppercase                         |
| Code         | JetBrains Mono | 400/500 | 0.8125rem                                                     |

Headings are **600, not 800** — the previous extrabold + animated gradient read as heavy
and muddy. Body minimum is 16px; nothing below 12px.

## Spacing & layout

- 4px base scale; section rhythm `py-20` (mobile) → `py-28`/`py-32` (desktop).
- Container `max-width: 1200px`, gutters `1.5rem`.
- Hero is a 2-column asymmetric grid (`1.1fr / 1fr`) at ≥1024px, stacked below.
- Breakpoints verified: **375 / 768 / 1024 / 1440**.

## Motion

The generator's UX database flags the previous implementation directly — _"Excessive
Motion: animate 1–2 key elements per view maximum; don't animate everything that moves"_,
**severity High**. The old page ran 12+ concurrent animation groups (aurora pulse, 3
floating orbs, cursor spotlight, per-character 3D letter entrance, radar sweep + rings +
blips, marquee, 3D card tilt, shimmer).

Policy now — the distinction that matters is **purposeful vs ambient**. Motion is
allowed when it is driven by the user's scroll or fires once on arrival; it is not
allowed to loop forever in the background, which is what made the old page read as
auto-generated.

- `opacity` and `transform` only — never `width`/`height`. Compositor-friendly, no
  layout thrash.
- Transitions 150–300ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- Scroll reveals fire **once** (`viewport={{ once: true }}`).
- No infinite ambient loops anywhere.
- **`prefers-reduced-motion: reduce` is honoured globally** in CSS _and_ via
  `useReducedMotion()` for JS-driven values. Every motion primitive returns plain
  markup under reduced motion, so those users get the finished layout — never a
  hidden one waiting on a trigger that will not fire.

### Inventory

| Motion                                              | Kind           | Notes                               |
| --------------------------------------------------- | -------------- | ----------------------------------- |
| Hero parallax (copy / console / grid / glow)        | scroll-linked  | Four rates for depth                |
| Reading progress hairline                           | scroll-linked  | Spring-smoothed                     |
| Step connector draw                                 | scroll-linked  | `scaleX` mapped to section progress |
| Masked word reveals                                 | once, on enter | Words, not characters (see below)   |
| Grid cascades (stats, features, CWEs, steps, trust) | once, on enter | Staggered children                  |
| Finding card assembly                               | once, on enter | Mirrors what the scanner does       |
| Console typing + one scan sweep                     | once, on mount | Was an infinite loop; now runs once |
| Card hover lift                                     | interaction    | 200ms                               |

**Words, not characters.** Per-character headline animation was in the original. It is
the clearest tell of an auto-generated page and it destroys screen-reader output. Word
level masking reads as more considered; the real string stays in `aria-label`.

## Smooth scrolling

`scroll-behavior: smooth` with `scroll-padding-top: 5rem` on `html`, so anchor
navigation glides and the target clears the 4rem sticky header. Verified: an anchor
click produces ~46 intermediate scroll frames (an instant jump produces ~1), and the
target lands at 80px.

Per-section `scroll-mt-*` was removed — it stacked with `scroll-padding-top` and
doubled the offset to 160px.

This is native CSS, not a scroll-hijacking library. Wheel scrolling stays at the OS
level, which keeps trackpad feel, native scrollbars, and accessibility intact, and it
falls back to `auto` under reduced motion automatically.

## Components

- **Buttons** — ≥44px touch target, `cursor-pointer`, visible `focus-visible` ring
  (`--landing-accent`, 2px, offset 2px against the page base).
- **Cards** — 1px `--landing-border`, radius 14px, hover lifts border to
  `--landing-border-strong` + 1px translate. No 3D tilt, no spotlight.
- **Icons** — Lucide SVG only. No emoji as icons, anywhere.

## Pre-delivery checklist

- [x] No emoji as icons (Lucide SVG throughout)
- [x] `cursor-pointer` on every clickable element
- [x] Hover states with 150–300ms transitions
- [x] Text contrast ≥4.5:1 (computed, table above)
- [x] Focus states visible for keyboard navigation
- [x] `prefers-reduced-motion` respected (CSS + JS)
- [x] Responsive at 375 / 768 / 1024 / 1440 with no horizontal overflow

---

# Authenticated app

The marketing surfaces above and the signed-in app are deliberately separate
systems: the app keeps its slate base (`--background: #0F172A`) and its denser
rhythm. What follows applies to `/dashboard`, `/repositories`, `/scans`,
`/vulnerabilities`, `/reports`, `/settings` and the scan detail page.

## Measured before/after

Every number below was measured in a real browser against the rendered pixels,
not asserted. Auth was faked at the network layer so the pages could actually
be inspected; no app code was changed to enable it.

| Check                             | Before | After     |
| --------------------------------- | ------ | --------- |
| Text contrast failures (AA)       | 13     | **0**     |
| Controls below the 24px AA target | 11     | **0***    |
| Controls with no accessible name  | 5      | **0**     |
| Raw enum strings shown to users   | 3      | **0**     |
| Pages with skeleton loading       | 0 / 7  | **7 / 7** |
| Pointer cursor missing            | 15     | **0**     |

\* The six notification switches render 20px tall, but their clickable target
is the 44px label row that wraps them — verified by clicking 30px away from
the switch and confirming a single write fires.

## Colour: text on tints

Severity and status badges paint coloured text on a 15% tint of the same hue.
The base severity colours are correct for fills, bars and icons but fail as
text in that position:

| Badge                           | Base      | Measured | Token now used            | Measured |
| ------------------------------- | --------- | -------- | ------------------------- | -------- |
| critical / vulnerable / failed  | `#EF4444` | 3.50     | `--critical-fg` `#FCA5A5` | 6.75     |
| high / open                     | `#F97316` | 4.27     | `--high-fg` `#FDBA74`     | 7.10     |
| medium / queued                 | `#EAB308` | 5.66     | `--medium-fg` `#FDE047`   | 8.23     |
| low / secure / completed        | `#22C55E` | 4.94     | `--low-fg` `#86EFAC`      | 8.02     |
| running / testing / in progress | `#8B5CF6` | 2.85     | `--accent-fg` `#A78BFA`   | 6.72     |

`--primary` `#8B5CF6` also fails as a link on card/page surfaces (3.45 / 4.22)
and as a button fill under white text (4.23). Links use `--accent-fg`; filled
buttons use `--primary-strong` `#7C3AED` (5.70 with white). This is the same
split documented for the landing page, applied to the app's own surfaces.

## Target sizes

Targeting **WCAG 2.5.8 (AA), 24×24 CSS px** — not the 44px AAA figure — for
dense in-table controls. Forcing 44px onto every row action in a data table
destroys the scanning rhythm the table exists for. Primary navigation, the
header controls and settings rows are all 44px; table actions sit at 32–36px,
comfortably above the AA floor.

## Shared primitives

`src/components/app/ui.tsx` holds `SeverityBadge`, `StatusBadge`, `PageShell`,
`SectionCard`, `Skeleton`/`SkeletonRows`/`SkeletonCards`, `EmptyState` and
`ErrorState`; `src/lib/labels.ts` holds `humanize`. Every page previously
hand-rolled these, which is exactly why the same badge failed contrast in four
places and three raw enum values reached the UI.

Loading is skeletons with `role="status"` + `aria-busy`, not a `Loading…`
text swap — the UX guidance rates loading feedback High severity and asks for
a stable skeleton, and the text swap made the layout jump when data landed.

## Page headers

Each route supplies its own subtitle. Previously all seven pages showed
"Welcome back, {name}" beneath the heading, spending the most prominent line
on the screen on something that said nothing on six of them.
