---

id: systems_combat_hp
title: HP
section: Systems
canon: false
authority: high
status: seed
tone_tags: []
design_intent:
  - "Explain how HP works (including how training increases max HP)."
constraints:
  - "Document both player-facing behavior and exact code rules."
tags:
  - combat
  - hp
related:
  - systems_combat_mechanics
  - systems_combat_defense
---

# HP

> **Path:** Systems / Combat / HP

## Player-facing behavior

- **HP is your health bar.** If it hits `0`, you lose the fight.
- **Max HP grows by training HP.** In this game, **HP level == Max HP**.
- You start with **10 Max HP** (HP level 10).

## Under the hood

Each character has a `stats.hp` entry:

```js
stats: {
  hp: { level: 10, xp: LEVEL_XP_REQUIREMENTS[10] }
}
```

### HP level == Max HP

When HP XP levels up, the game does this:

- `character.maxHp = hpLevel`
- If max HP increased by `Δ`, the character is immediately healed by `+Δ` (so levelling HP feels like “free” max health gain).

In pseudo-code:

```txt
newMax = newHpLevel
Δ = newMax - oldMax
maxHp = newMax
hp = min(maxHp, hp + max(0, Δ))
```

### How HP is trained

Whenever you deal damage `D` during combat:

- HP XP increases by `+D`

This happens *even if you’re not training HP*, because HP is always trained.

(Separately, your chosen training stat gets `+4D` — see [[systems_combat_mechanics]].)

## Healing sources

### In-battle item: Synthfruit

- The battle starts with `2` Synthfruit.
- Using one heals **25% of max HP** (floored), minimum `1`.

Pseudo:

```txt
heal = max(1, floor(maxHp * 0.25))
```

### Victory heal

On victory you heal a flat **+2 HP**, capped to max HP.

### Passive regen tick

There is a small passive regen function:

- If your active character is below max HP, it can tick **+1 HP**.

(Exactly when this runs depends on where it’s called from in the UI loop.)

## “Resolve” (survive a lethal hit)

Jackson has a utility move called **Resolve**.

- It sets a one-time “endure next hit” flag.
- If the next enemy hit would drop you to `0`, you instead drop to **1 HP**.

## Related

- [[systems_combat_defense]] (defence reduces how often you take HP damage)
- [[systems_combat_mechanics]] (turn flow + where training XP is awarded)
