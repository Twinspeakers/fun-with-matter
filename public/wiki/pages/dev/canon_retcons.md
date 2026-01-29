---
id: start_canon_retcons
title: Canon & Retcons
section: Dev
canon: true
authority: high
status: active
tags: [canon, retcon, workflow]
tone_tags: [grounded, transparent]
design_intent:
  - Canon changes must be deliberate and traceable.
  - Avoid silent contradictions between the game and the Wiki.
constraints:
  - Locked pages cannot be changed without a retcon entry.
related: [start_design_pillars, start_reference]
---

# Canon & Retcons

The Wiki is meant to stay coherent as the game grows. This page defines how we handle changes without drifting into contradictions.

## Canon levels

- **canon: true** → authoritative. The game should move toward this.
- **canon: false** → notes, drafts, brainstorming, optional ideas.

## Page statuses

- **seed** → idea seed. Not implemented yet. Safe to change freely.
- **active** → currently intended truth. Should match the game (or be a clearly planned gap).
- **locked** → stable canon. Changing it requires a retcon.
- **deprecated** → replaced by another page; keep for history, link the replacement.

## The conflict ritual

When you notice a mismatch between *canon* and *the game*:

1. **Flag the conflict**
   - Add a short note to the top of the relevant page: “⚠️ Conflict: …”
   - Or add an entry to `docs/CHANGELOG.md` with a link to the page.

2. **Decide the direction**
   - If canon is correct: adjust the game to match.
   - If the game is correct: write a retcon (below) and update the page.

3. **Record the change**
   - Update the wiki page’s frontmatter (`status`, `authority`) if needed.
   - Add a retcon entry.

## Retcon format

Add retcons to this page in chronological order:

- **Date:** YYYY-MM-DD
- **What changed:** one sentence
- **Why:** one sentence
- **Pages affected:** list of `[[page_ids]]`
- **Implementation note:** what to change in code/assets (if applicable)

### Retcon log

- _(none yet)_

## Related
- [[start_design_pillars]]
- [[start_reference]]
