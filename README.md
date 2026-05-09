# Vocab App

Interactive vocabulary & grammar tutoring platform for students working through
Destination B1 / B2. Single-tutor app with a hybrid mode (tutor dashboard +
student practice) running as a desktop app on Windows and macOS.

> **Status:** v0.0.1 — PR #1 (Scaffold). App shell only. Database, content
> import, and UI flows arrive in later PRs (see _Roadmap_).

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Shell        | Electron 33 + electron-forge (Vite plugin)        |
| UI           | React 18 + TypeScript + Vite                      |
| Style        | Tailwind CSS 3 (Lingvist-inspired tokens)         |
| Lint/format  | Biome                                             |
| Test         | Vitest + Testing Library + jsdom                  |
| DB (PR #2)   | SQLite via `better-sqlite3` + Drizzle ORM         |
| Validation   | Zod (PR #3+)                                      |

## Folder layout

```
vocab-app/
├── electron/             # Main process + preload (Node)
│   ├── main.ts
│   └── preload.ts        # contextBridge → window.api (typed)
├── src/                  # Renderer (React)
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles/
│   └── types/            # Ambient types (window.api, etc.)
├── tests/
│   ├── setup.ts
│   └── unit/
├── content/              # YAML content sources (PR #4) — versioned in git
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
```

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
| v0.0.1  | **Scaffold (this PR)** + vocabulary DB + import + browse  |
| v0.0.2  | Grammar DB + import + browse                              |
| v0.0.3  | Exercise engine + flashcard + multiple-choice plugins     |
| v0.0.4  | Practice session + spaced repetition                      |
| v0.0.5  | Reward + micro-rewards                                    |
| v0.0.6  | Analytics dashboard                                       |
| v0.0.7  | In-app authoring GUI                                      |
| v0.0.8  | More exercise types (fill-blank, matching, ordering, ...) |
| v0.1.0  | Beta packaging (signed installers, auto-update)           |
