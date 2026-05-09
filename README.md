# Vocab App

Interactive vocabulary & grammar tutoring platform for students working through
Destination B1 / B2. Single-tutor app with a hybrid mode (tutor dashboard +
student practice) running as a desktop app on Windows and macOS.

> **Status:** v0.0.1 — PR #6 (Tutor screens). Students CRUD, three-pane
> content browser with cloze highlight, and import-history view are now
> wired to live IPC. Exercise engine + practice player land in PRs #7+.

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Shell        | Electron 33 + electron-forge (Vite plugin)        |
| UI           | React 18 + TypeScript + Vite                      |
| Routing      | TanStack Router (memory history)                  |
| Data fetch   | TanStack Query                                    |
| Style        | Tailwind CSS 3 (Lingvist-inspired tokens)         |
| Lint/format  | Biome                                             |
| Test         | Vitest + Testing Library + jsdom                  |
| DB           | SQLite via `better-sqlite3` + Drizzle ORM         |
| Migrations   | drizzle-kit (SQL files in `drizzle/`)             |
| Validation   | Zod (IPC inputs + YAML import)                    |
| Auth         | scrypt-hashed tutor PIN (Node `crypto`)           |
| Content      | YAML files in `content/`, parsed via `js-yaml`    |
| Watch        | chokidar (`npm run import:watch`)                 |

## Folder layout

```
vocab-app/
├── electron/             # Main process + preload (Node only)
│   ├── main.ts
│   ├── preload.ts        # contextBridge → window.api (typed)
│   ├── db/               # SQLite client, paths, migration runner
│   │   └── repositories/ # curriculum, vocab, students, settings, imports
│   └── ipc/              # defineProcedure + Zod-validated handlers
│       └── procedures/   # meta, curriculum, vocab, students, settings
├── src/
│   ├── data/
│   │   ├── schema/       # Drizzle table definitions (1 file per domain)
│   │   └── types.ts      # Inferred row types re-exports
│   ├── application/
│   │   └── import/       # YAML schema, parser, hash, ImportVocabUseCase
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles/
│   └── types/            # Ambient types (window.api, etc.)
├── content/              # YAML content sources — versioned in git
│   └── books/
│       └── destination-b1/
├── drizzle/              # Generated SQL migrations + meta (versioned)
├── scripts/
│   ├── migrate-dev.ts    # Apply migrations without launching Electron
│   └── import-content.ts # CLI: import / dry-run / watch
├── tests/
│   ├── helpers.ts
│   ├── setup.ts
│   └── unit/
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

npm run import         # import all YAML in content/books/**/*-vocab.yaml
npm run import:dry-run # validate + show plan; no DB writes
npm run import:watch   # re-import on file change (chokidar)
npm run import -- ./content/books/destination-b1   # specific path
npm run import -- --force                          # bypass file-hash short-circuit
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

## Authoring vocab content

Vocab lessons are YAML files under `content/books/<book-code>/`. Filename
convention: `unit-NN-vocab.yaml`. Inside one file you describe one lesson:

```yaml
book: destination-b1
unit: { ordinal: 1, code: U01, title: People & Relationships }
lesson:
  ordinal: 1
  kind: vocabulary
  title: Family & Friends
  slug: family-and-friends
entries:
  - id: relative-noun       # stable id; powers idempotent re-import
    headword: relative
    pos: noun
    ipa: /ˈrelətɪv/
    cefr: B1
    tags: [family, people]
    senses:
      - definition_en: a member of your family
        definition_vi: người thân, họ hàng
    examples:
      - text: I have many {{relatives}} in Hanoi.
        cloze_hint: r____
    forms:
      - { kind: plural, text: relatives }
    collocations:
      - { collocation: close relative, pattern: adj+noun }
    relations:
      - { relation: synonym, text: family member }
```

Highlights:

- `{{token}}` in `examples[].text` automatically becomes the cloze target.
  You can override or supply explicitly via `cloze_target`.
- `id` is optional; missing ids are auto-derived from `<headword>-<pos>`.
  Keep stable across edits — it's how the importer matches existing rows.
- Re-running `npm run import` on an unchanged file is a no-op (file-hash
  short-circuit). Editing one entry results in `inserted/updated/skipped`
  diff and only changed rows are touched.
- Failures inside a file roll the whole file back; other files in a batch
  are independent. Every run is logged in `import_runs` + `import_items`.

## App shell & modes

The app boots into one of three modes:

| Mode      | Trigger                                       | What renders                          |
| --------- | --------------------------------------------- | ------------------------------------- |
| `loading` | initial mount, before `auth.hasPin` resolves  | small spinner                         |
| `locked`  | after probe; or after the tutor presses Lock  | `UnlockScreen` (setup or verify)      |
| `tutor`   | successful PIN unlock or first-time setup     | TanStack Router → `TutorLayout`       |
| `student` | "Continue to student practice" or sidebar btn | TanStack Router → `StudentLayout`     |

The PIN is stored as an scrypt hash (`scrypt$1$<salt>$<key>`) in
`app_settings.tutor_pin_hash`. There's no recovery path — clearing the local
DB is the only reset. Switching tutor → student is free; the reverse always
goes through the lock screen.

`AppModeProvider` (in `src/providers/`) owns the mode state and exposes:

```ts
const { mode, hasPin, pinReady,
        unlockTutor, setupPin, changePin,
        enterStudent, switchToStudent, lock } = useAppMode();
```

Routes live in `src/router.tsx` (memory history — no URL bar). Adding a new
tutor screen = drop a component under `src/ui/screens/tutor/`, register a
`createRoute` entry, add the sidebar item in `TutorLayout`. No other
plumbing required.

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
| v0.0.1  | Scaffold + vocab DB + import + app shell + **tutor screens (this PR)** |
| v0.0.2  | Grammar DB + import + browse                              |
| v0.0.3  | Exercise engine + flashcard + multiple-choice plugins     |
| v0.0.4  | Practice session + spaced repetition                      |
| v0.0.5  | Reward + micro-rewards                                    |
| v0.0.6  | Analytics dashboard                                       |
| v0.0.7  | In-app authoring GUI                                      |
| v0.0.8  | More exercise types (fill-blank, matching, ordering, ...) |
| v0.1.0  | Beta packaging (signed installers, auto-update)           |
