# v0.18.0 UI Redesign

Version 0.18.0 completes the visual-system redesign prepared by the native-core and renderer
boundary work. Domain logic, persistence, and expensive runtime work remain outside screen
components; the release changes presentation and interaction without changing those contracts.

## Principles

- Keep screens as orchestration layers, not domain engines.
- Prefer shared tokens and primitives over one-off visual recipes.
- Keep mascot and media assets behind stable components.
- Use hierarchy, spacing, and typography before adding containers or decorative color.
- Keep radius, elevation, and motion restrained across both roles.

## v0.18.0 Coverage

- Rebuilt the shared neutral surface, typography, spacing, radius, elevation, and motion tokens.
- Reworked tutor navigation, page headers, data tables, fields, dashboard summary, and panels.
- Reworked student navigation, profile picker, home overview, practice tools, session controls, and
  learning surfaces.
- Centralized hierarchical Back navigation in the unified toolbar, including session-aware exit
  handlers and the standard Option-Left / Command-[ keyboard paths.
- Rebalanced profile selection into a compact two-column object grid and curriculum units into a
  responsive shared-border grid so wide windows carry useful information instead of long empty
  rows.
- Rebuilt dictionary search as a focused window-scoped sheet with an integrated titlebar, focus
  trap, smaller bounded canvas, suggested searches, and clear empty-state direction.
- Expanded practice sessions to use the available window height, made the full headword area an
  intentional reveal target, strengthened press feedback, and added concise progress/streak cues.
- Removed decorative gradients, floating hover motion, oversized radii, uppercase label systems,
  and heavy shadows from the default interface language.
- Preserved mascot selection and custom study backgrounds as explicit student preferences.
- Kept Phosphor glyphs at a consistent functional size without decorative icon containers.

## Visual Rules

- Spacing follows the 4/8/12/16/24/32px scale.
- Default controls use 6–10px radii; fully round shapes are reserved for avatars and true circular
  controls.
- Persistent panes rely on a one-pixel divider rather than elevation. Shadows are reserved for
  floating overlays; vibrancy and blur appear only on semantic chrome, popovers, and sheets.
- Motion is limited to opacity, color, border, and short progress transitions. Reduced-motion
  preferences continue to disable non-essential animation.
- Tutor surfaces use a dense productivity layout; student surfaces retain stronger wayfinding and
  mascot identity without turning every section into a reward card.

## Backend Boundaries The Redesign Should Rely On

- Practice deck generation stays in `src/modules/exercises`.
- FSRS/SRS logic stays in `src/modules/srs` and native `core/vocab-core`.
- Pronunciation runtime stays behind `electron/pronunciation` and future `electron/core` facades.
- Dictionary work stays behind `electron/dictionary` until the native service is activated.
- Renderer components call typed APIs and should not know whether a backend path is TypeScript,
  WASM, service, or N-API.

## Verification

- `npm run lint`
- `npm run typecheck`
- Full Vitest suite under Electron's Node runtime: 84 files / 534 tests
- Electron development build and launch at the default 1440 x 900 viewport; the supported window
  minimum remains 1100 x 720. Automated capture respects the app's screenshot-content policy.
