---devOnly: true
canon: false
status: Experimental
authority: Local
section: Dev
---

# Dev Theme Overrides (local-only)

This page is **only read when Dev Mode is ON**.

- Enable Dev Mode with `?dev=1` in the URL, or press **Ctrl+Shift+D** to toggle.
- When enabled, the game will load this file and apply any CSS variables you list below.
- These overrides are **local-only** (stored in your browser state), and are intended for **testing and development**.

## How to use

Edit the code block below. Each line should be a CSS variable assignment:

```css
--tier-1: 50.5% 0.213 27.518;   /* Singular (Highest) — Red */
--tier-2: 68.1% 0.162 75.834;   /* Unbounded — Gold */
--tier-3: 49.6% 0.265 301.924;  /* Distorted — Purple */
--tier-4: 48.8% 0.243 264.376;  /* Hazardous — Blue */
--tier-5: 64.8% 0.2 131.684;    /* Reactive — Green */
--tier-6: 44.4% 0.011 73.639;   /* Stable (Lowest) — Grey */

--hp-low: var(--tier-1);        /* 0–19% */
--hp-mid: 90.5% 0.182 98.111;   /* 20–49% (Yellow) */
--hp-high: var(--tier-5);       /* 50–100% */
```

### Notes

- Variables live in `css/fwm-theme.css`.
- Tier variables are OKLCH component triples (`L C H`) and are used as: `oklch(var(--tier-1) / 1)`.
- You can override other design tokens too (surfaces, borders, link colors) if you want—just add them here.
