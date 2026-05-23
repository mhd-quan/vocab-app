# Vocab App

Interactive vocabulary & grammar tutoring platform for students working through
Destination B1 / B2. Single-tutor app with a hybrid mode (tutor dashboard +
student practice) running as a desktop app on Windows and macOS.

> **Status:** v0.15.0 — local-first tutor workspace, student practice,
> FSRS-lite review, personal dictionary learning, rewards, imports, and
> the HuBERT-backed CAPT pronunciation pipeline. v0.15.0 hardens the
> CAPT subsystem: HuBERT inference now runs in an Electron
> `utilityProcess`, audio flows as `Float32Array` end-to-end, the
> recorder uses `AudioWorklet`, and CTC Viterbi alignment is served by a
> precompiled Rust→WASM crate (`crates/viterbi`, ~14 KB).

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
| CAPT         | Transformers.js + ONNX Runtime Node, offline model resources |
| Watch        | chokidar (`npm run import:watch`)                 |

## Folder layout

```
vocab-app/
├── electron/             # Main process + preload (Node only)
│   ├── main.ts
│   ├── preload.ts        # contextBridge → window.api (typed)
│   ├── db/               # SQLite client, paths, migration runner
│   │   └── repositories/ # domain data access, analytics, evidence
│   └── ipc/              # defineProcedure + Zod-validated handlers
│       └── procedures/   # meta, curriculum, vocab, pronunciation, settings
├── src/
│   ├── data/
│   │   ├── schema/       # Drizzle table definitions (1 file per domain)
│   │   └── types.ts      # Inferred row types re-exports
│   ├── application/
│   │   └── import/       # YAML schema, parser, hash, ImportVocabUseCase
│   ├── modules/          # pure domain engines: exercises, SRS, rewards, analytics
│   ├── ui/               # role shells, screens, shared components
│   ├── providers/        # app mode, theme, display preferences
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles/
│   └── types/            # Ambient types (window.api, etc.)
├── content/              # YAML content sources — versioned in git
│   ├── books/
│   │   └── destination-b1/
│   └── templates/        # authoring templates + exercise reference
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

The runtime spine is intentionally narrow: Electron owns the database,
migrations, native dialogs, file IO, and typed IPC; `src/application` parses
and imports content; `src/modules` contains pure engines; `src/ui` renders
tutor and student routes through the typed `window.api` bridge.

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
npm run verify:artifacts # verify app/dictionary/CAPT package resources
npm run rebuild        # rebuild better-sqlite3 against Electron's Node ABI
npm run build:wasm     # build crates/viterbi → assets/pronunciation/viterbi.wasm (needs rustup + wasm32 target)

npm run db:generate    # drizzle-kit generate (after editing src/data/schema)
npm run db:migrate:dev # apply migrations to ./data/dev.db without Electron

npm run import         # import all YAML/YML in content/books/**/*-(vocab|grammar).{yaml,yml}
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

### Schema overview

26 tables, organized by domain:

- **Curriculum**: `books`, `units`, `lessons`
- **Vocabulary**: `vocab_entries`, `vocab_senses`, `vocab_examples`,
  `vocab_forms`, `vocab_collocations`, `vocab_relations`
- **Grammar**: `grammar_topics` with authoring metadata for patterns, examples, mistakes, and checks
- **Polymorphic content**: `content_items` (kind + ref_table + ref_id)
- **Learner**: `students`, `enrollments`, `unit_assignments`
- **Progress** (event-sourced): `practice_sessions`, `learning_events`,
  `item_progress_v2`, plus read-only `item_progress_v1_archive`
- **Personal dictionary**: `dictionary_search_events`,
  `dictionary_learning_items`, `dictionary_learning_reviews`
- **Rewards**: `student_achievements` (cache; recomputable from the event log)
- **Import**: `import_runs`, `import_items`
- **Settings**: `app_settings`
- **Evidence**: `session_evidence_events`

CAPT pronunciation attempts are stored as `pronunciation_assessment` rows in
`session_evidence_events`, so tutor dashboards and exported student bundles use
the same evidence pipeline as focus/camera review data.

Adding a new content kind later (custom exercise type, listening clip, …) is
a single migration that adds the concrete table plus a row in `content_items`
— no downstream change to progress or session code.

## Authoring content

See `content/templates/IMPORT-SYNTAX.md` for the full accepted YAML surface.

## Authoring vocab content

Vocab lessons are YAML files under `content/books/<book-code>/`. Filename
convention: `unit-NN-vocab.yaml`. Inside one file you describe one lesson:

```yaml
book: destination-b1
book_title: Destination B1
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
- `book_title` is optional. Missing titles are derived from `book`; once a
  tutor edits a book title in the Content browser, re-imports without
  `book_title` preserve that stored title.
- Re-running `npm run import` on an unchanged file is a no-op (file-hash
  short-circuit). Editing one entry results in `inserted/updated/skipped`
  diff and only changed rows are touched.
- Failures inside a file roll the whole file back; other files in a batch
  are independent. Every run is logged in `import_runs` + `import_items`.

## App shell & modes

The app boots into these visible modes:

| Mode      | Trigger                                       | What renders                          |
| --------- | --------------------------------------------- | ------------------------------------- |
| `loading` | initial mount, before `auth.hasPin` resolves  | small spinner                         |
| `welcome` | after PIN probe; or after the tutor locks     | mode selection                        |
| `locked`  | tutor selects Tutor from welcome              | `UnlockScreen` (setup or verify)      |
| `tutor`   | successful PIN unlock or first-time setup     | TanStack Router → `TutorLayout`       |
| `student` | Student on welcome or sidebar switch          | TanStack Router → `StudentLayout`     |

The PIN is stored as an scrypt hash (`scrypt$1$<salt>$<key>`) in
`app_settings.tutor_pin_hash`. There's no recovery path — clearing the local
DB is the only reset. Switching tutor → student is free; the reverse always
goes through the lock screen.

`AppModeProvider` (in `src/providers/`) owns the mode state and exposes:

```ts
const { mode, hasPin, pinReady,
        unlockTutor, setupPin, changePin,
        selectTutor, selectStudent,
        enterStudent, switchToStudent, lock } = useAppMode();
```

Routes live in `src/router.tsx` (memory history — no URL bar). Adding a new
tutor screen = drop a component under `src/ui/screens/tutor/`, register a
`createRoute` entry, add the navigation item in `TutorLayout`. No other
plumbing required.

## UX + settings

- Theme preference is stored in `app_settings.theme` as `light`, `dark`, or
  `system`. System mode follows `prefers-color-scheme` while the app is open.
- Settings now includes session defaults, display density, app language,
  definition priority, idle auto-lock, lock-on-close preference, reward sound,
  and a local version/database summary.
- The Imports screen supports drag/drop upload and native file selection for
  `.yaml` and `.yml`. Imported files are copied into
  `content/books/<book-code>/` and then processed by the same
  `ImportVocabUseCase` used by the CLI.
- `content/templates/` contains validating vocab and grammar templates,
  focused vocab-study and revision-practice starters, `IMPORT-SYNTAX.md`,
  and an exercise reference for current and planned exercise kinds.

## Exercise engine

The exercise engine lives in `src/modules/exercises/` as pure functions
plus React renderers. The plugin contract:

```ts
interface ExercisePlugin<TExercise, TAnswer> {
  kind: ExerciseKind;
  build(entry: VocabEntryFull, ctx: BuildContext): TExercise | null;
  grade(exercise: TExercise, answer: TAnswer): GradeOutcome;
}
```

`build` returns `null` when the entry can't satisfy the kind's
preconditions (e.g. multiple-choice needs ≥3 distinct distractors), so
the deck shrinks gracefully rather than throwing.

Adding a new kind = three steps:

1. Add `'<kind>'` to the `ExerciseKind` union in `types.ts`.
2. Drop a `<kind>.ts` file with `build` + `grade`, register it in
   `engine.ts` `PLUGINS`.
3. Add a renderer under `src/ui/screens/student/session/` and wire the
   case into `ExerciseCard` in `SessionPlayer.tsx`.

Decks are deterministic for a given `sessionSeed`: `buildDeck` hashes
the seed → mulberry32 PRNG → Fisher–Yates shuffle. Two calls with the
same seed produce the same deck in the same order. Vocabulary-only units
launch directly into the session route; the unit study/practice layer is
reserved for grammar units. For vocabulary sessions, entries that have no
student progress are placed in a flashcard-only intro phase before any
recognition/review exercise can be generated for that word.

Currently shipping kinds:

- **flashcard** — flip card, self-graded (Again / Hard / Good / Easy);
  the grade flows through FSRS-lite.
- **multiple_choice** — definition prompt + 4 headword options, one
  correct; auto-graded.
- **grammar activities** — grammar lessons can supply `fill_blank`,
  `choice`, `order`, `rewrite`, `prompted_sentence`, and
  `error_correction` activities. For now, unit revision/exercise pages should
  be authored as `lesson.kind: grammar`; `revision` and `exercise` are reserved
  lesson enum values, not importable file kinds yet.

## Spaced repetition

`SessionPlayer` accepts an `onResult` callback that fires once per
answered exercise. The `StudentSession` route plugs that into
`progress.recordAnswer`, which:

1. Resolves `vocab_entries.id → content_items.id` (one row per entry,
   created during import).
2. Appends a `learning_events` row (`answered_correct` / `answered_wrong`
   plus payload).
3. Loads or seeds the matching `item_progress` row.
4. Maps the answer to the FSRS-lite 1..4 rating scale and applies the
   scheduler in `src/modules/srs/fsrsLite.ts`.
5. Upserts the new `(stability, difficulty, state, reps, lapses, dueAt)` state.

Everything happens in a single `db.transaction(...)` so the event log
and the materialised schedule never disagree — if a write fails, both
roll back together.

The student home then queries:

- `progress.dueByLesson` per vocab lesson — surfaces *N due / N new*
  badges so the student knows what to practise.
- `progress.studentSummary` — totals + accuracy in the page header.

Two design choices worth knowing:

- **FSRS thresholds are settings-backed.** `fsrs_short_term_days` and
  `fsrs_long_term_days` control when stability graduates a card to
  short-term or long-term memory.
- **`learning_events` is append-only.** Item progress is just a fast
  cache built on top — wiping `item_progress` and replaying the event
  log would yield the same state.

## Rewards

The reward layer sits on top of `learning_events` + the in-session
state inside `SessionPlayer`. Three pieces:

1. **In-session streak feedback.** Hitting 5 or 10 correct answers in a
   row inside one session fires a confetti burst (and an optional chime
   the tutor can toggle in Settings). Pure UI: no DB write needed.
2. **Achievement catalogue.** Eight rules in
   `src/modules/rewards/achievements.ts` — first answer, in-session 5/10,
   3- and 7-day calendar streaks, 25 / 100 distinct correct entries,
   and 90 %+ accuracy with ≥ 50 attempts. The evaluator is pure: it
   takes a stats snapshot and returns the earned ID set.
3. **Persistence.** `progress.recordAnswer` evaluates achievements
   inside the same SQLite transaction that wrote the event +
   `item_progress` row, then INSERTs newly-earned rows into
   `student_achievements` (`ON CONFLICT DO NOTHING`). The freshly-
   unlocked subset bubbles back to `SessionPlayer` and renders as a
   slide-in toast. Rolling back the event also rolls back the unlock.

Streak math (`computeStreak`) groups events by local-calendar day and
walks back from "today" (or yesterday if no practice yet today, so a
streak doesn't reset until midnight rolls over without practice). Pure
function — every clock read is the caller's responsibility, which makes
timezone-edge tests trivial to pin.

The achievement table is a *cache*, not a source of truth: dropping it
and re-running `rewards.evaluate` over the event log + `item_progress`
yields the same set. So adding a new rule is a code-only change.

## Tutor analytics

The dashboard (`/tutor/dashboard`) shows a per-student roll-up table
sourced from `progress.tutorOverview` — one DB pass over `item_progress`
joined with `students` (active only). Click a row to land on the
per-student detail screen (`/tutor/students/$studentId`).

The detail screen stitches four narrow IPC slices:

- `progress.dailyActivity({since, until})` → `Heatmap` (90 days). The
  pure `bucketByDay` helper in `src/modules/analytics/heatmap.ts` does
  the dense fill + intensity bucketing so the renderer just paints
  cells. Same shape feeds any future sparkline.
- `progress.weakItems({minAttempts: 3})` → top-10 weakest words sorted
  by accuracy ascending. Each row carries `entryId` + `bookId` so the
  link drops the tutor straight into Content browser via
  `?entry=…&book=…` search params (validated on the route).
- `progress.recentSessions` → last 10 sessions with answered/correct
  totals from a `groupBy(sessionId, kind)` aggregation over
  `learning_events`.
- `rewards.listUnlocked` → existing achievement cache; renders a chip
  strip via the same `getAchievement` catalogue used by the toast in
  `SessionPlayer`.

No new tables; analytics is a query-only feature. That keeps the
schema flat and means swapping the SRS algorithm later doesn't drag
the analytics view with it.

## Dev environment

- Node ≥ 20 (tested on Node 22).
- macOS or Windows. Cross-build from macOS → Windows works for ZIP; Squirrel
  installers require Windows or Wine.
- Electron uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration:
  false`. Renderer talks to main only via the typed `window.api` bridge.

## Roadmap

| Version | Scope                                                     |
| ------- | --------------------------------------------------------- |
| v0.12.0 | Session evidence, focus/camera check-ins, tutor reports |
| v1.0.0  | Beta packaging (signed installers, auto-update)           |
