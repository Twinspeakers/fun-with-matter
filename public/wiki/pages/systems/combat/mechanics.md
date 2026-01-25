---

id: systems_combat_mechanics
title: Mechanics
section: Systems
canon: false
authority: high
status: seed
tone_tags: []
design_intent:
  - "Explain the combat loop and the underlying rules."
constraints:
  - "Keep player-facing naming while still exposing the exact formulas."
tags:
  - combat
  - monster-brawl
related:
  - systems_combat_attack
  - systems_combat_strength
  - systems_combat_defense
  - systems_combat_hp
---

# Mechanics

> **Path:** Systems / Combat / Mechanics

## What the player does each turn

Monster Brawl is **menu-driven**. On your turn you pick one action:

- **Move** (your character’s attacks / utility moves)
- **Item** (currently: Synthfruit healing)
- **Tech** (non-damage utilities like Guard / Analyze)
- **Gadgets** (special actions fueled by gadget charges)
- **Run** (ends the fight)

After you act, the **enemy always gets a turn** (unless you won the fight).

## Battle state (what the game stores)

When a brawl starts, the game creates `state.battle`:

- `active`: whether a battle is running
- `menu`: UI menu state (`root`, `move`, `item`, `tech`)
- `playerCharId`: which character is fighting (`jackson` or `colt`)
- `enemy`: stats, typing, HP
- `items`: consumables usable in-battle (ex: `synthfruit: 2`)
- `buffs` and `debuffs`: temporary effects that modify accuracy/defence/etc

The battle ends by:

- **Victory** → routes to `sq_monster_complete`
- **Defeat** → routes to `sq_monster_defeat`
- **Run** → routes to `sq_monster_run`

## Typing (damage multipliers)

There are currently four types:

- `normal`
- `water`
- `fire`
- `electric`

The rock-paper-scissors is:

- **Water beats Fire**
- **Fire beats Electric**
- **Electric beats Water**

Multipliers:

- **Super effective:** `1.5×`
- **Not very effective:** `0.75×`
- **Same-element resistance** (attacking with the same element): `0.75×`
- Multipliers stack if the defender has multiple types (rare right now).

Two important “feel-good” rules exist so early combat doesn’t feel like wet noodles:

- If your **raw roll > 0** and the multiplier would reduce damage to `0`, damage is bumped to `1`.
- If your hit is **super effective** and the multiplier doesn’t change the number (example: `1×1.5` flooring back to `1`), damage is bumped by `+1`.

## Hit chance + damage: the core loop

For each hit:

1. Compute a **hit chance** (see [[systems_combat_attack]] and [[systems_combat_defense]])
2. Roll hit/miss
3. If hit, roll damage from `0..maxHit` (see [[systems_combat_strength]])
4. Apply typing multiplier, apply the anti-feels-bad rules above
5. Subtract HP

Some moves hit multiple times (example: `2-4` hits).

### Extra hit passive

If you have **Twinstrike Gloves equipped**, single-hit attacks become **2 hits**.

## Gear bonuses (how equipment affects combat)

Equipment effects are mapped into three internal “bonus” numbers:

- `attackBonus`
- `strengthBonus`
- `defenceBonus`

Many item effects are expressed as small decimals in item data (example: `accuracy: 0.10`).
The combat system converts them into bonus points (roughly an 8× scale):

- `accuracy` → `attackBonus += round(accuracy * 8)`
- `defense` → `defenceBonus += round(defense * 8)`
- `strength` → `strengthBonus += round(strength * 8)`
- `speed` → small accuracy boost: `attackBonus += round(speed * 4)`

This keeps items meaningful without rewriting every item when the combat system changes.

## Gadgets in combat

Gadgets can be used via **Tech → Gadgets**, and they:

- Require a **minimum character level** (example: Water Pistol requires level 12)
- Consume **1 charge** per use
- Either:
  - act as an attack (using normal hit/damage rules), or
  - apply a buff/debuff (like accuracy up, enemy defence down, etc.)

## Training XP (how stats grow)

Whenever you deal damage `D`:

- **HP XP**: `+D`
- **Selected combat stat XP**: `+4D` where the selected stat is one of:
  - attack
  - strength
  - defence

You pick the training target in the Attributes UI (crosshair / “train” picker).

## Rewards + post-fight effects

On **Victory**:

- Character XP: `+8 XP`
- Heal: `+2 HP` (cannot exceed max HP)
- Loot: 1–3 “slots” rolled from the enemy’s loot pool
  - at most one “rare” reward per win
  - rare gadget rewards are **blueprint-only** (one-time unlock)

On **Defeat**:

- You’re routed to the defeat story node and the battle state is cleared.

## Related

- [[systems_combat_attack]]
- [[systems_combat_strength]]
- [[systems_combat_defense]]
- [[systems_combat_hp]]
