---devOnly: true
canon: false
status: Drafting
authority: Author
section: Drafts
---

# Draft Hub

This section is for **writing**—messy, incomplete, and fearless.

Nothing in here is automatically canon. The goal is to make it feel like you're **already writing the story**, while the game stays stable.

## Quick start

- Scenes: [[drafts_scene_list|Draft Scene List]] (auto list + one-click creation)
- Character notes: [[drafts_characters]]
- Worldbuilding: [[drafts_worldbuilding]]
- Context pages: [[drafts_context_pages]]

## Create new draft page checklist

Use this anytime you feel yourself slipping into “file management mode”:

- [ ] Decide the draft type (Scene / Character / World / Context)
- [ ] Create the page (Scenes: use **New draft scene**)
- [ ] Give it a clear **title** that reads like a chapter/beat
- [ ] Write first, organise later
- [ ] When you want to preview a Scene, use **Publish to Story (dev)**

## How preview works (Dev Mode)

A scene draft can be previewed in the Story frame without editing `js/data/story/nodes.js`.

1. Write your scene in a wiki page
2. Add a button at the bottom:

- `{{publish_scene:my_draft_node}}`

Clicking it will:
- save the current page markdown into your browser (localStorage)
- jump you into the Story page and load the draft as `my_draft_node`

To clear it:
- `{{clear_scene:my_draft_node}}`

## Recommended formatting for scenes

You can keep it super simple:

- `::chapter=Monster Brawl`
- `::bg=./assets/sprites/backgrounds/whatever.png`

Then dialogue like:

- `Jackson: Stay behind me, I've got this.`
- `Colt: ...oh hell yeah.`

Any line that doesn't use `Name:` becomes narrator text.
