# Vocab App

Interactive vocabulary & grammar tutoring platform for students working through
Destination B1 / B2. Single-tutor app with a hybrid mode (tutor dashboard +
student practice) running as a desktop app on Windows and macOS.

> **Status:** v0.0.1 — PR #2 (DB layer). App shell + full SQLite schema +
> migrations. Repositories, IPC bridge, content import, and UI flows arrive
> in later PRs (see _Roadmap_).

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Shell        | Electron 33 + electron-forge (Vite plugin)        |
| UI           | React 18 + TypeScript + Vite                      |
| Style        | Tailwind CSS 3 (Lingvist-inspired tokens)         |
| Lint/format  | Biome                                             |
| Test         | Vitest + Testing Library + jsdom                  |
| DB           | SQLite via `better-sqlite3` + Drizzle ORM         |
| Migrations   | drizzle-kit (SQL files in `drizzle/`)             |
| Validation   | Zod (PR #4+)                                      |

## Folder layout

```
vocab-app/
├── electron/             # Main process + preload (Node only)
│   ├── main.ts
│   ├── preload.ts        # contextBridge → window.api (typed)
│   └── db/               # SQLite client, paths, migration runner
├── src/
│   ├── data/
│   │   ├── schema/       # Drizzle table definitions (1 file per domain)
│   │   └── types.ts      # Inferred row types re-exports
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles/
│   └── types/            # Ambient types (window.api, etc.)
├── drizzle/              # Generated SQL migrations + meta (versioned)
├── scripts/
│   └── migrate-dev.ts    # Apply migrations without launching Electron
├── tests/
│   ├── helpers.ts
│   ├── setup.ts
│   └── unit/
├── content/              # YAML content sources (PR #4) — versioned in git
├── drizzle.config.ts
├── forge.config.ts
├── vite.{main,preload,renderer}.config.ts
├── tailwind.config.ts
├── biome.json
├── vitest.config.ts
└── tsconfig.json
```

The full target architecture (domain / data / application / modules / ui
layers) is described in `docs/architecture.md` and rolled out PR by PR — we
deliberately do not create empty folders before they have content.

## Scripts

```bash
npm install            # one-time
npm start              # launch Electron dev (Vite HMR for renderer)
npm run typecheck      # tsc --noEmit
npm run lint           # biome check
npm run lint:fix       # biome check --write
npm run test           # vitest run
npm run test:watch     # vitest watch
npm run package        # produce unpacked app bundle
npm run make           # produce installers (DMG/ZIP/Squirrel/DEB)
npm run rebuild        # rebuild better-sqlite3 against Electron's Node ABI

npm run db:generate    # drizzle-kit generate (after editing src/data/schema)
npm run db:migrate:dev # apply migrations to ./data/dev.db without Electron
```

After the first `npm install`, run `npm run rebuild` once on your dev machine
so `better-sqlite3` matches Electron's Node ABI. The `make` script does this
automatically when packaging for distribution.

## Database

The app uses a local SQLite file (no server). Drizzle ORM provides typed
schema and queries; SQL migrations live in `drizzle/` and are applied
automatically on Electron startup.

| Context              | DB path                                  |
| -------------------- | ---------------------------------------- |
| Packaged Electron    | `<userData>/vocab.db`                    |
| Dev Electron         | `<userData>/vocab.dev.db`                |
| Plain Node / vitest  | `./data/dev.db` (or `VOCAB_DB_PATH=...`) |

Migrations folder is bundled with the packaged app via Forge's `extraResource`,
resolved at runtime through `electron/db/paths.ts`.

### Schema overview (v0.0.1)

19 tables, organized by domain:

- **Curriculum**: `books`, `units`, `lessons`
- **Vocabulary** (PR #2 focus): `vocab_entries`, `vocab_senses`,
  `vocab_examples`, `vocab_forms`, `vocab_collocations`, `vocab_relations`
- **Grammar**: `grammar_topics` (stub — patterns/examples land in v0.0.2)
- **Polymorphic content**: `content_items` (kind + ref_table + ref_id)
- **Learner**: `students`, `enrollments`
- **Progress** (event-sourced): `practice_sessions`, `learning_events`,
  `item_progress`
- **Import**: `import_runs`, `import_items`
- **Settings**: `app_settings`

Adding a new content kind later (custom exercise type, listening clip, …) is
a single migration that adds the concrete table plus a row in `content_items`
— no downstream change to progress or session code.

## Dev environment

- Node ≥ 20 (tested on Node 22).
- macOS or Windows. Cross-build from macOS → Windows works for ZIP; Squirrel
  installers require Windows or Wine.
- Electron uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration:
  false`. Renderer talks to main only via the typed `window.api` bridge.

## Roadmap

See `docs/roadmap.md` (added with PR #2). Current plan:

| Version | Scope                                                     |
| ------- | --------------------------------------------------------- |
| v0.0.1  | Scaffold + **vocabulary DB (this PR)** + import + browse  |
| v0.0.2  | Grammar DB + import + browse                              |
| v0.0.3  | Exercise engine + flashcard + multiple-choice plugins     |
| v0.0.4  | Practice session + spaced repetition                      |
| v0.0.5  | Reward + micro-rewards                                    |
| v0.0.6  | Analytics dashboard                                       |
| v0.0.7  | In-app authoring GUI                                      |
| v0.0.8  | More exercise types (fill-blank, matching, ordering, ...) |
| v0.1.0  | Beta packaging (signed installers, auto-update)           |
