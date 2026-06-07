# Native Core Phase 2

Phase 2 splits the app's reusable engine work out of the Electron shell without
forcing a UI rewrite. The goal is a Rust-first core that can be called from the
current Electron app today and from future macOS / Windows native shells later.

## Decisions

- Language: Rust.
- Primary integration: utilityProcess/service for dictionary, CAPT, and DB-heavy work.
- Secondary integration: N-API only for small pure hot functions if benchmarks justify it.
- Build targets for this phase: macOS x64 and Windows x64.
- Rollout rule: every slice ships with a fallback or no runtime behavior change until tests and
  package verification pass.

## Workspace

```txt
core/
  Cargo.toml
  vocab-core/          pure logic, no Electron or Node assumptions
  vocab-core-service/  utilityProcess service adapter scaffold
```

`vocab-core` currently owns pure FSRS-lite scheduling and CTC alignment. The existing
`crates/viterbi` WASM adapter now calls into `vocab-core::ctc`, so the production WASM path and
future service/N-API paths do not drift.

## Current Gate

Phase 2.0 and 2.1 are intentionally behavior-preserving for the app runtime:

- `npm run core:check`
- `npm run core:test`
- `npm run build:wasm`
- existing TypeScript lint, typecheck, and Vitest suite

## Next Slices

1. CAPT assessment service: move alignment/scoring into the existing CAPT worker and return compact
   assessment payloads instead of frame matrices.
2. Dictionary service: move MDX/MDD index + record-block cache into Rust, keep the TypeScript HTML
   parser as the first fallback boundary.
3. DB actor: move analytics/export/report jobs behind a serialized service queue before considering
   a full SQLite engine migration.
4. Packaging: add platform-specific service binary copy/verify checks for macOS x64 and Windows x64.

## Runtime Contract Shape

Future service messages should stay versioned and narrow:

```json
{
  "id": 1,
  "protocolVersion": 1,
  "kind": "health",
  "payload": {}
}
```

The Electron side should keep a TypeScript facade under `electron/core/` so renderers and IPC
procedures never depend on native transport details.
