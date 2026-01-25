---

id: systems_combat_attack
title: Attack
section: Systems
canon: false
authority: high
status: seed
tone_tags: []
design_intent:
  - "Explain how Attack influences hit chance and what modifies accuracy."
constraints:
  - "Use plain language first, then show the exact formula." 
tags:
  - combat
  - attack
related:
  - systems_combat_mechanics
  - systems_combat_strength
  - systems_combat_defense
---

# Attack

> **Path:** Systems / Combat / Attack

## Player-facing behavior

Attack is your **accuracy** stat.

- Higher Attack = you **land hits more often**.
- Gear, Tech, and some moves can temporarily raise/lower accuracy.

## Under the hood

### The two-roll model

Every hit uses two internal “rolls”:

- **Attack roll** (player) = `attackLevel * (attackBonus + 64)`
- **Defence roll** (enemy) = `enemyDefenceLevel * (enemyDefenceBonus + 64)`

Where:

- `attackLevel` comes from your character’s `stats.attack.level`
- `attackBonus` is built from your equipped items (see below)
- enemy values come from `state.battle.enemy.stats` and `.bonuses`

### Hit chance formula

The hit chance is computed like this:

```txt
if attackRoll > defenceRoll:
  chance = 1 - (defenceRoll + 2) / (2 * (attackRoll + 1))
else:
  chance = attackRoll / (2 * (defenceRoll + 1))
```

Then the game applies modifiers and caps:

- `chance *= move.accMod` (moves can be more/less accurate)
- **Analyze** adds `+0.10` (capped)
- **Accuracy buffs** add a flat amount (capped)
- Some buffs can multiply accuracy (`nextAttackAccMult`)
- Final cap: **minimum 5%**, **maximum 98%**

In pseudo:

```txt
chance = clamp01(baseChance)
chance = chance * moveAccMod
chance = chance * nextAttackAccMult (if present)
chance = clamp(chance, 0.05, 0.98)
```

## What can change your accuracy

### Gear bonuses

Item effects are mapped into an integer-ish bonus:

- `accuracy` effect → `attackBonus += round(accuracy * 8)`
- `speed` effect → `attackBonus += round(speed * 4)`

This means even “small decimal” item bonuses still matter.

### Buffs / debuffs currently implemented

- **Analyze (Tech):** `+10%` hit chance for 2 turns
- **Basketball (Gadget buff):** `+12%` hit chance for a few turns
- **Breakdown (Jackson move):** large accuracy boost (currently `+25%`)
- **Show Off (Jackson move):** reduces enemy accuracy (enemy side)
- **Mouthguard (Gadget buff):** reduces your next-attack accuracy via `nextAttackAccMult = 0.88`

## Training

Attack can be trained (only one combat stat at a time).
When you deal damage `D`:

- Attack XP gains `+4D` **if Attack is your selected training target**.

(HP still gains `+D` regardless.)

## Related

- [[systems_combat_strength]] (how hard you can hit)
- [[systems_combat_defense]] (how the enemy tries to hit you)
- [[systems_combat_mechanics]] (full turn loop)
