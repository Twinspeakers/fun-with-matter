---

id: items_gadgets
title: Gadgets
section: Codex
canon: false
authority: medium
status: seed
tone_tags: []
design_intent: []
constraints: []
tags: []
related: []
---

# Gadgets

> **Path:** Items / Gadgets

## In-world

Gadgets are the “dumb little things” you bring into a fight that somehow end up deciding the whole brawl. They’re not guns or magic—just kid-grade equipment, used with maximum confidence.

## Under the hood

### What makes something a Gadget

A **Gadget** is an item flagged with `isGadget: true`. Gadgets are special because they have **Rank** and **Charges** that persist on the player:

- **Rank**: upgrade level (starts at 0).
- **Charges**: how many times you can use it in battle.

### Charge and duration rules

For a gadget with rank **R**:

- **Max charges** = `1 + R`
- **Duration (turns)** = `durationBaseTurns + R`

Charging happens outside of battle:

- **Charge Gadget**: adds **+1 charge** (up to Max charges).

Upgrading is also outside of battle:

- **Upgrade Gadget**: consumes **1 spare copy** of the gadget (you must own **2+** copies).
- Increases Rank by **+1** (up to Max Rank).
- After upgrade, you keep at least **1 charge**.

### Using gadgets in battle

- Using a gadget consumes **-1 charge** from your persistent gadget state.
- Gadgets are **level-gated** (per gadget). If you’re under the required level, you can’t use that gadget’s battle action.

> Note: Some gadgets are implemented as **attacks** (they call a move like *Squirt*/*Soak*). Others are implemented as **buffs** (they directly apply a status effect). This matters for their exact effects (see below).

### Current in-game list

#### Basketball (🏀) — *Point Guard*
- **Tier:** 4
- **Use level:** 8+
- **Base duration:** 1 turn
- **Max rank:** 3
- **Battle effect (buff-style):**
  - **Accuracy up** for `durationTurns`
  - Exact numbers:
    - `accBoost = +0.12`
    - `accBoostTurns = durationTurns`

#### Water Pistol (🔫) — *Squirt*
- **Tier:** 4
- **Use level:** 12+
- **Base duration:** 1 turn
- **Max rank:** 3
- **Battle effect (attack-style):** calls the **Squirt** move.
  - **Type:** Water
  - **Accuracy mod:** 0.90
  - **Max hit mod:** 1.00
  - **Hits:** `1–2`

> Implementation note: There is a defined “defence down + chip damage” gadget effect block for Water Pistol, but because Water Pistol is currently wired as an **attack-style gadget**, the attack path runs and the buff/debuff effect block does not execute.

#### Mouthguard (🦷) — *Grin*
- **Tier:** 4
- **Use level:** 18+
- **Base duration:** 1 turn
- **Max rank:** 3
- **Battle effect (buff-style):** primes your next attack.
  - Next attack damage is multiplied by **1.5×**.
  - Next attack accuracy is multiplied by **0.88×**.
  - The “next attack” portion is consumed after you attempt an attack.
  - The buff window lasts `durationTurns` (tracked as `grinTurns`).

#### Super Soaker (💦) — *Soak*
- **Tier:** 3
- **Use level:** 36+
- **Base duration:** 2 turns
- **Max rank:** 3
- **Battle effect (attack-style):** calls the **Soak** move.
  - **Type:** Water
  - **Accuracy mod:** 0.90
  - **Max hit mod:** 1.20
  - **Hits:** `2–4`

> Implementation note: Like Water Pistol, there is a defined “bigger defence down + chip damage” gadget effect block for Super Soaker, but the current wiring uses the **attack-style** path.

## Related

- [[world_characters_jackson_movepool]]
- [[systems_combat_mechanics]]
