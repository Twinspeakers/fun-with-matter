---
id: items_scraps
title: Scraps
section: Codex
canon: false
authority: medium
status: seed
tone_tags: []
design_intent: []
constraints: []
tags: [items, scraps]
related: []
---

# Scraps

> **Path:** Items / Scraps

Scraps are Junkyard finds. You can **salvage** them (distill into elements) or **sell** them for MU.

## In-world

The Junkyard coughs up the stuff nobody wanted to carry home: crushed cans, cloudy bottles, dented cartons, and the occasional dead bit of tech. Most of it is worthless until you run it through the Distiller.

## Under the hood

Scraps come from the Story → **The Junkyard** loop (repeatable). Each run takes **20 seconds** and yields **1 scrap**.

The Junkyard picks from the available scrap pool using **weighted random**. Scraps can be sold at the **General Store** for MU, or **distilled** into elements (distilling consumes the scrap and yields a min–max range that gets deposited into the **Distillery Cabinet**).

### Current drop pool


> **Weight** is a *relative* number used for rarity tuning (higher = more common).

| Scrap | Buy | Sell | Weight | Yield |
|---|---:|---:|---:|---|
| [[item_scrap_soda_can]] 🥫 {{tier:6}} | 10 | 5 | 50 | **Al** 10–14, **O** 0–2 |
| [[item_scrap_plastic_bottle]] 🧴 {{tier:6}} | 10 | 5 | 70 | **C** 8–12, **H** 6–10, **O** 2–5 |
| [[item_scrap_milk_carton]] 🧃 {{tier:6}} | 10 | 5 | 50 | **C** 6–10, **H** 4–8, **O** 4–8 |
| [[item_scrap_rusty_spoon]] 🥄 {{tier:6}} | 10 | 5 | 20 | **Fe** 2–4, **O** 8–12 |
| [[item_scrap_usb_drive]] 💾 {{tier:6}} | 20 | 10 | 10 | **Si** 12–16, **Cu** 2–6, **Fe** 1–3, **C** 1–3 |
| [[item_scrap_old_doorknob]] 🚪 {{tier:6}} | 10 | 5 | 30 | **Cu** 6–9, **Zn** 4–8, **O** 2–4 |
| [[item_scrap_toaster_coil]] 🌀 {{tier:5}} | 10 | 5 | 20 | **Fe** 3–6, **Ni** 3–6 |
| [[item_scrap_paint_tin]] 🪣 {{tier:5}} | 10 | 5 | 10 | **Fe** 6–12, **Ti** 2–4 |
| [[item_scrap_broken_lightbulb]] 💡 {{tier:6}} | 10 | 5 | 30 | **O** 5–10, **Si** 6–9 |
| [[item_scrap_coat_hanger]] 🪝 {{tier:6}} | 10 | 5 | 40 | **Fe** 4–8, **O** 4–8 |
| [[item_scrap_plastic_bag]] 🛍️ {{tier:6}} | 10 | 5 | 60 | **O** 5–10, **Si** 6–9 |

## Scrap pages

{{autolist:scraps}}
