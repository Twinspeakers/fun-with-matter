## This is how I would like the filesystem to be ##

fun-with-matter/
├─ docs/
│  ├─ CONTEXT.md              # living context log (your request)
│  ├─ STORY_CHAR.md           # current character/story snapshot
│  ├─ DESIGN.md               # UI rules, style tokens, layout patterns
│  ├─ DATA_MODEL.md           # item schema, tiers, xp rules, etc.
│  └─ CHANGELOG.md            # optional: human-readable changes
│
├─ public/
│  ├─ icons/                  # static icons (if you don’t import them in TS)
│  └─ fonts/
│
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ routes.tsx           # router config / route map
│  │  ├─ providers.tsx        # context providers (theme, store, etc.)
│  │  └─ bootstrap.ts         # init/load save, migrations, seed defaults
│  │
│  ├─ assets/
│  │  ├─ icons/               # SVGs you import as modules (preferred)
│  │  ├─ sprites/             # sprite PNGs / atlases
│  │  └─ ui/                  # small decorative assets, textures
│  │
│  ├─ core/
│  │  ├─ engine/              # pure game rules (no React)
│  │  │  ├─ combat/
│  │  │  ├─ xp/
│  │  │  ├─ tiers/
│  │  │  └─ rng/
│  │  ├─ persistence/
│  │  │  ├─ storage.ts        # localStorage wrapper
│  │  │  ├─ migrations.ts     # save versioning + migrations
│  │  │  └─ keys.ts
│  │  ├─ state/
│  │  │  ├─ store.ts          # global store setup (zustand/redux/etc.)
│  │  │  ├─ selectors.ts
│  │  │  └─ slices/           # split state by domain
│  │  ├─ types/
│  │  │  ├─ item.ts
│  │  │  ├─ character.ts
│  │  │  ├─ save.ts
│  │  │  └─ story.ts
│  │  └─ utils/
│  │     ├─ clamp.ts
│  │     ├─ format.ts
│  │     └─ ids.ts
│  │
│  ├─ data/
│  │  ├─ items/               # JSON/TS definitions
│  │  │  ├─ elements.ts
│  │  │  ├─ gadgets.ts
│  │  │  ├─ blueprints.ts
│  │  │  └─ store.ts
│  │  ├─ story/
│  │  │  ├─ nodes.ts           # story graph / dialogue nodes
│  │  │  └─ triggers.ts        # unlock conditions tied to gameplay
│  │  └─ balance/
│  │     ├─ xpTable.ts         # 1-99 values
│  │     └─ dropTables.ts
│  │
│  ├─ features/
│  │  ├─ inventory/
│  │  │  ├─ InventoryPage.tsx
│  │  │  ├─ components/
│  │  │  ├─ inventory.logic.ts # feature-level glue, still mostly pure
│  │  │  └─ inventory.slice.ts
│  │  ├─ gathering/
│  │  ├─ crafting/
│  │  ├─ combat/
│  │  ├─ gadgets/              # its own page (as you wanted)
│  │  └─ story/
│  │
│  ├─ ui/
│  │  ├─ layout/              # AppShell, columns, panels
│  │  ├─ components/          # shared UI: Modal, Tabs, IconTile, XpBar, etc.
│  │  ├─ patterns/            # “ItemFloatingCard”, “DetailsPanel”, etc.
│  │  └─ styles/              # tailwind helpers, CSS variables if any
│  │
│  ├─ main.tsx
│  └─ vite-env.d.ts
│
├─ scripts/
│  ├─ packSprites.ts          # optional: build sprite atlas
│  └─ validateData.ts         # sanity-check item ids, drop tables, etc.
│
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts

NEW (2026-01-13)
- wiki/index.json       # Wiki navigation tree (drives sidebar + category pills)
- wiki/pages/           # One markdown file per page (your writing lives here)
- js/data/wiki/wikiFS.js # Loader + frontmatter parser for the wiki filesystem
