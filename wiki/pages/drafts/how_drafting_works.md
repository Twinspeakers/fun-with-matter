---
devOnly: true
canon: false
status: Guide
authority: Author
---

# How drafting works

## Dev Mode

Draft tools only appear in **Dev Mode**.

- Enable with `?dev=1` in the URL
- Or press **Ctrl+Shift+D** (toggles Dev Mode in your browser)

## Draft scenes → Story preview

You can write a scene as simple lines, and preview it inside the **Story** frame.

### Draft syntax (simple)

- `Name: Dialogue` becomes a speaker line
- Lines without `Name:` are narrator lines
- Optional meta directives:
  - `::chapter=Monster Brawl`
  - `::bg=./assets/...png`
  - `::cg=./assets/...png`

### Publishing

In any draft page, add:

- `{{publish_scene:your_node_id}}` → saves this page as a dev-only Story override and jumps to it
- `{{clear_scene:your_node_id}}` → removes the override

Saved overrides live in browser storage under the key:

- `fwm_dev_scene:your_node_id`

They do **not** edit canon story files.
