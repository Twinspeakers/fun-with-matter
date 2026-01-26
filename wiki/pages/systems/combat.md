---

id: systems_combat
title: Combat
section: Systems
canon: false
authority: medium
status: seed
tone_tags: []
design_intent:
  - "Explain how Monster Brawl works in-game and in-code."
constraints:
  - "Keep terminology player-facing (avoid direct RuneScape naming)."
tags:
  - combat
  - monster-brawl
related:
  - systems_inventory
  - systems_tiers
---

# Combat

> **Path:** Systems / Combat

Combat in **Fun With Matter** currently lives in the repeatable chapter **EVENT: Monster Brawl**.

It’s a turn-based, menu-driven encounter where your active character fights an enemy (right now: a Vulkraine Minion). Your four combat stats are trained by doing damage:

- **HP** (always trained)
- **Attack / Strength / Defense** (you pick *one* to train at a time)

## Pages

- [[systems_combat_mechanics]]
- [[systems_combat_hp]]
- [[systems_combat_attack]]
- [[systems_combat_strength]]
- [[systems_combat_defense]]

## Quick mental model

- **Attack** = how often you *land* hits.
- **Strength** = how hard you *can* hit.
- **Defense** = how often the enemy *misses* you.
- **HP** = your max HP (HP level == max HP).

## Where the code lives

- Combat state + formulas: `js/core/state/store.js`
- Battle UI actions: `js/app/bootstrap.js`
- Story nodes that start / end the brawl: `js/data/story/nodes.js`

## Related

- [[systems_inventory]] (gear + gadgets matter in battle)
- [[systems_tiers]] (tiers are used for items, not combat tuning… yet)
