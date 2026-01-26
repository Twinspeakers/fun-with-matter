---

id: systems_combat_strength
title: Strength
section: Systems
canon: false
authority: high
status: seed
tone_tags: []
design_intent:
  - "Explain how Strength determines max hit and damage rolls." 
constraints:
  - "Include move modifiers and typing effects." 
tags:
  - combat
  - strength
related:
  - systems_combat_mechanics
  - systems_combat_attack
  - systems_combat_defense
---

# Strength

> **Path:** Systems / Combat / Strength

## Player-facing behavior

Strength is your **power** stat.

- Higher Strength = your attacks can roll a **higher max damage**.
- Damage is still randomized each hit, so Strength raises the ceiling more than the floor.

## Under the hood

### Max hit formula

The system computes a max hit using your Strength level and your gear’s strength bonus:

```txt
maxHit = floor(0.5 + (strengthLevel * (strengthBonus + 64)) / 640)
maxHit = max(1, maxHit)
```

Then the move can modify it:

```txt
maxHit = floor(maxHit * move.maxHitMod + move.flatMaxHit)
```

And some buffs can multiply it:

- Mouthguard sets `nextAttackMult = 1.5` for your next attack.

### Damage roll

Once `maxHit` is known, damage is rolled as an integer from `0..maxHit`:

```txt
damageRoll = randomInt(0, maxHit)
```

### Typing multiplier

After rolling raw damage, typing can multiply it:

- Normal is always `×1`
- Water/Fire/Electric use the rock-paper-scissors rules (see [[systems_combat_mechanics]])

Then the game floors the result:

```txt
damage = floor(damageRoll * multiplier)
```

Two “anti-feels-bad” rules apply:

- If `damageRoll > 0` but multiplication floors to `0`, damage becomes `1`.
- If the hit is **super effective** and flooring would keep the number the same (example `1 → 1`), damage gets `+1`.

### Multi-hit moves

Some moves hit multiple times. The number of hits can be:

- A number (`1`, `2`, etc.)
- A range string like `"2-4"` (a random value in that range)

If **Twinstrike Gloves** are equipped, any single-hit move becomes 2 hits.

## Training

Strength can be trained (only one combat stat at a time).
When you deal damage `D`:

- Strength XP gains `+4D` **if Strength is your selected training target**.

## Related

- [[systems_combat_attack]] (landing the hit)
- [[systems_combat_defense]] (surviving enemy hits)
- [[systems_combat_mechanics]] (overall flow)
