---
name: Zola theme
description: Color palette decision — Cursor-inspired warm cream light theme
---

The `index.css` @theme block uses a warm cream palette (hue 80, low chroma) matching cursor.com.

- background: oklch(0.975 0.008 80) — warm off-white
- foreground: oklch(0.13 0.005 80) — near-black with warm tint
- primary: oklch(0.16 0.005 80) — dark button, light text
- card: oklch(0.99 0.005 80) — slightly lighter than bg
- muted: oklch(0.93 0.008 80)
- border: oklch(0.88 0.01 80)

**Why:** User requested "same color like cursor" — cursor.com uses a warm beige/cream background, not pure white or dark.
**How to apply:** Keep hue 80 across the scale to preserve warmth; adjust lightness only.
