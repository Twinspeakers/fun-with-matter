---

id: systems_leveling
title: Leveling & XP
section: Systems
canon: true
authority: high
status: active
tone_tags: [clear]
design_intent:
  - Document the XP curve (1–99) and how levels are derived from XP.
constraints:
  - Treat this page as the single source of truth for XP thresholds.
tags: [xp, leveling]
related:
  - systems_combat_hp
  - systems_combat_mechanics
---

# Leveling & XP

> **Path:** Systems / Leveling & XP

## Player-facing behavior

- XP is tracked per stat/skill (HP, Attack, Strength, Defence, Gathering, Refining, Crafting).
- Your **level** for a stat is determined by your **total XP** for that stat.
- Level cap is **99**.

## Under the hood

### XP thresholds (1–99)

These are **total XP thresholds** (not “XP-to-next”).

- Level **1** starts at **0 XP**.
- To reach level **N**, you must have **≥ the threshold listed for N**.

### How level is computed from XP

Given total XP `xp`, the level is the highest `L` such that:

- `xp >= threshold[L]` and `L <= 99`

### Starting HP level baseline

Design rule: players start at **HP level 10** (Max HP == HP level).

In code, the XP required for the starting HP level is treated as a **baseline** and should not inflate any derived “overall level” (if/when an overall level is shown).

## Table

| Level | Total XP (threshold) |
|---:|---:|
| 1 | 0 |
| 2 | 83 |
| 3 | 174 |
| 4 | 276 |
| 5 | 388 |
| 6 | 512 |
| 7 | 650 |
| 8 | 801 |
| 9 | 969 |
| 10 | 1,154 |
| 11 | 1,358 |
| 12 | 1,584 |
| 13 | 1,833 |
| 14 | 2,107 |
| 15 | 2,411 |
| 16 | 2,746 |
| 17 | 3,115 |
| 18 | 3,523 |
| 19 | 3,973 |
| 20 | 4,470 |
| 21 | 5,018 |
| 22 | 5,624 |
| 23 | 6,291 |
| 24 | 7,028 |
| 25 | 7,842 |
| 26 | 8,740 |
| 27 | 9,730 |
| 28 | 10,824 |
| 29 | 12,031 |
| 30 | 13,363 |
| 31 | 14,833 |
| 32 | 16,456 |
| 33 | 18,247 |
| 34 | 20,224 |
| 35 | 22,406 |
| 36 | 24,815 |
| 37 | 27,473 |
| 38 | 30,408 |
| 39 | 33,648 |
| 40 | 37,224 |
| 41 | 41,171 |
| 42 | 45,529 |
| 43 | 50,339 |
| 44 | 55,649 |
| 45 | 61,512 |
| 46 | 67,983 |
| 47 | 75,127 |
| 48 | 83,014 |
| 49 | 91,721 |
| 50 | 101,333 |
| 51 | 111,945 |
| 52 | 123,660 |
| 53 | 136,594 |
| 54 | 150,872 |
| 55 | 166,636 |
| 56 | 184,040 |
| 57 | 203,254 |
| 58 | 224,466 |
| 59 | 247,886 |
| 60 | 273,742 |
| 61 | 302,288 |
| 62 | 333,804 |
| 63 | 368,599 |
| 64 | 407,015 |
| 65 | 449,428 |
| 66 | 496,254 |
| 67 | 547,953 |
| 68 | 605,032 |
| 69 | 668,051 |
| 70 | 737,627 |
| 71 | 814,445 |
| 72 | 899,257 |
| 73 | 992,895 |
| 74 | 1,096,278 |
| 75 | 1,210,421 |
| 76 | 1,336,443 |
| 77 | 1,475,581 |
| 78 | 1,629,200 |
| 79 | 1,798,808 |
| 80 | 1,986,068 |
| 81 | 2,192,818 |
| 82 | 2,421,087 |
| 83 | 2,673,114 |
| 84 | 2,951,373 |
| 85 | 3,258,594 |
| 86 | 3,597,792 |
| 87 | 3,972,294 |
| 88 | 4,385,776 |
| 89 | 4,842,295 |
| 90 | 5,346,332 |
| 91 | 5,902,831 |
| 92 | 6,517,253 |
| 93 | 7,195,629 |
| 94 | 7,944,614 |
| 95 | 8,771,558 |
| 96 | 9,684,577 |
| 97 | 10,692,629 |
| 98 | 11,805,606 |
| 99 | 13,034,431 |

## Related

- [[systems_combat_hp]]
- [[systems_combat_mechanics]]
