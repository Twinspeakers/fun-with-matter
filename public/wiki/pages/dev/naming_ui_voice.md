---
id: start_naming_ui_voice
title: Naming & UI Voice
section: Dev
canon: true
authority: high
status: active
tags: [ui, voice, naming]
tone_tags: [playful, clear, grounded]
design_intent:
  - UI text should feel confident, helpful, and non-intrusive.
  - Prefer short labels in nav; detailed explanations live in pages.
constraints:
  - Don't use protected third-party game terminology in UI text.
related: [start_design_pillars, start_reference]
---

# Naming & UI Voice

This page sets the writing rules for UI labels and Wiki tone.

## Naming rules

- Use **short nav labels** (e.g. **Store**, **Tiers**, **Reference**).
- Prefer **one clear term** per concept; avoid synonyms in the UI.
- If a term changes, keep page `id` stable and update the `title`.

## UI voice

- Friendly, direct, not cringe.
- Explain the *why* when needed, but keep default UI text short.
- Avoid tutorial popups; prefer small links to the Wiki.

## “Under the hood” style

- Use plain language.
- Put numbers in tables when helpful.
- Mention edge-cases.
- Be honest about randomness (weights vs guarantees).

## Lore-to-Game Hooks

**UI hooks**
- Tooltips, “?” buttons, and linkable terms should open the relevant Wiki page.

**Asset hooks**
- Iconography should match the term set here (don’t invent new label icons that contradict).

**System hooks**
- As mechanics mature, the Wiki should describe the real behavior.

## Related
- [[start_design_pillars]]
- [[start_reference]]
