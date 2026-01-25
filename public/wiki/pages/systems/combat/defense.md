---

id: systems_combat_defense
title: Defense
section: Systems
canon: false
authority: high
status: seed
tone_tags: []
design_intent:
  - "Explain how Defense reduces incoming hits and what modifies your defence roll." 
constraints:
  - "Call out the internal key spelling (defence) so devs can find it." 
tags:
  - combat
  - defense
related:
  - systems_combat_mechanics
  - systems_combat_hp
  - systems_combat_attack
---

# Defense

> **Path:** Systems / Combat / Defense

## Player-facing behavior

Defense reduces how often enemies hit you.

- Higher Defense = enemies **miss more**.
- Gear, Tech, and some enemy debuffs can temporarily change this.

> **Dev note:** In code the stat key is spelled `defence`.

## Under the hood

Enemy hit chance is computed using the same two-roll model as player accuracy, just flipped:

- **Attack roll** (enemy) = `enemyAttackLevel * (enemyAttackBonus + 64)`
- **Defence roll** (player) = `defenceLevel * (defenceBonus + 64)`

Then hit chance uses the same formula as [[systems_combat_attack]]:

```txt
if attackRoll > defenceRoll:
  chance = 1 - (defenceRoll + 2) / (2 * (attackRoll + 1))
else:
  chance = attackRoll / (2 * (defenceRoll + 1))
```

Final caps: **minimum 5%**, **maximum 98%**.

### What counts as defenceBonus

Your `defenceBonus` comes from equipped items:

- `defense` item effect → `defenceBonus += round(defense * 8)`

### Guard (Tech)

**Guard** is a one-time defensive boost:

- It sets `buffs.guardOnce = true`
- The next enemy hit uses `defBonus = floor(defBonus * 1.25)`
- Then `guardOnce` is consumed

### Enemy accuracy debuffs

Some actions lower enemy accuracy instead of raising your defence:

- **Show Off** sets an enemy accuracy multiplier: `enemyAccDownMult = 0.85`

When this is active:

```txt
hitChance = hitChance * enemyAccDownMult
```

## Training

Defense can be trained (only one combat stat at a time).
When you deal damage `D`:

- Defence XP gains `+4D` **if Defence is your selected training target**.

(HP still gains `+D` regardless.)

## Related

- [[systems_combat_hp]] (HP is the buffer; defence reduces how often it drops)
- [[systems_combat_attack]] (same hit chance math, but player vs enemy)
- [[systems_combat_mechanics]] (buff/debuff tick rules live there)
