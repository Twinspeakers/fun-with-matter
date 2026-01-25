# UI Design System

This page is the **source of truth** for the look & feel of Fun With Matter.
If styling drifts or "reverts," use this as the checklist to bring everything back into line.

---

## Core vibe
- **Space + steel**: calm, dark, minimal surfaces; colorful assets provide the contrast.
- **Open layouts**: generous spacing; avoid dense clutter.
- **Sharp geometry**: crisp corners, clean dividers, machined / industrial feel.

## Color meaning
Color is reserved for meaning, not decoration:
- **Green** = safe / confirm / success
- **Yellow** = neutral / caution / warning
- **Red** = danger / destructive / urgent

Everything else stays **neutral** (grays + desaturated blues).

## Panels & surfaces
**Dark mode rule:** no bright borders. Panels separate using *barely-visible surfaces*:
- slightly lighter/different background than the page
- subtle inner highlight
- soft shadow
- optional blur

**Light mode rule:** clearer surfaces are OK, but still avoid thick borders.

## Typography
- One primary UI font across the app.
- Use weight and spacing to create hierarchy, not color.
- Long text (story / wiki) should have comfortable line height and sensible max width.

## Buttons
- Default buttons are neutral (monochrome).
- Only use colored buttons when meaning demands it:
  - confirm = green
  - caution = yellow
  - danger = red
- Buttons must be thumb-friendly on mobile.

## Pills / badges
Use pills for:
- tiers
- statuses (locked/new/coming soon)
- small metadata

Keep them compact and consistent.

## Tier UI rules
Item-related UI must always show tier meaning.
Tier color is an **accent**, not a full repaint.

Allowed accent placements:
- left border strip
- header underline
- tier badge pill
- subtle glow around the window

Never remove tier accents from item inspect / tooltip UI.

### Tier mapping (canon colors)
1. **Singular** — Red `oklch(50.5% 0.213 27.518)`
2. **Unbounded** — Gold `oklch(68.1% 0.162 75.834)`
3. **Distorted** — Purple `oklch(49.6% 0.265 301.924)`
4. **Hazardous** — Blue `oklch(48.8% 0.243 264.376)`
5. **Reactive** — Green `oklch(64.8% 0.2 131.684)`
6. **Stable** — Grey `oklch(44.4% 0.011 73.639)`

### HP bar color meaning (canon)
HP colors are **status tokens**, not tier tokens (even if the values overlap).
- **0–19% (Low)** → Red `oklch(50.5% 0.213 27.518)`
- **20–49% (Mid)** → Yellow `oklch(90.5% 0.182 98.111)`
- **50–100% (High)** → Green `oklch(64.8% 0.2 131.684)`

### Where the tokens live
All color values live in **one place**:
- `css/fwm-theme.css` → the `:root{}` block

Components must **never** hard-code tier/HP colors; they must reference tokens.


## Story screen rules (sacred)
The Story screen is a **shell** that hosts chapters (VN / Combat / Explore).
The shell stays consistent; chapters plug into it.

**Stage contract**
- Stage is always 16:9 and scales responsively.
- Layer order:
  1) background
  2) scene FX
  3) characters
  4) chapter overlay
  5) dialogue + choices
  6) modals

**Click safety**
- Decorative layers use `pointer-events: none`.
- Only explicit interactables receive clicks.
- If an overlay appears, it must be dismissible/actionable.

## Layout rules
- Icon rows stay horizontal unless intentionally stacked on small screens.
- Avoid unexpected reflow between breakpoints.
- Wiki uses two columns on desktop and one column on mobile.

## Regression checklist
If something looks broken:
1) Check CSS **load order** (theme must win).
2) Check for unscoped legacy selectors affecting new UI.
3) Check z-index + pointer-events (especially Story).
4) Check flex direction / wrapping rules for icon rows.
5) Verify tier accents are still applied to item UI.