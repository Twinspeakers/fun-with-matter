---
devOnly: true
canon: false
status: Template
authority: Author
---

# Scene Template

Use this as a starting point.

> Tip: pick a **node id** that won't clash with canon nodes.
> A safe pattern is: `draft_<chapter>_<slug>`

## Draft scene

::chapter=Draft
::bg=
::cg=

Narrator: (Set the mood. One or two lines.)

Jackson: (Dialogue...)
Colt: (Dialogue...)

Narrator: (Beat. Something changes.)

## Publish

{{publish_scene:draft_example_scene}}
{{clear_scene:draft_example_scene}}

## Preview controls

{{publish_scene:draft_example_scene}}
{{clear_scene:draft_example_scene}}

### What happens

- **Publish** saves this page’s text into your browser as a dev-only story override.
- The game then jumps to Story node `draft_example_scene` and renders the beats.
- **Clear** removes that override.
