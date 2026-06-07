# UI Redesign Readiness

This is preparation for a later visual redesign, not the redesign itself. The backend/native-core
work should make the UI easier to replace by keeping domain logic, persistence, and expensive
runtime work out of screen components.

## Principles

- Keep screens as orchestration layers, not domain engines.
- Prefer shared tokens and primitives over one-off visual recipes.
- Keep mascot and media assets behind stable components.
- Avoid adding visual churn while backend correctness and performance are still moving.

## Prep Checklist

- Inventory route shells: tutor, student home, sessions, pronunciation lab, imports, settings.
- Consolidate repeated session chrome around `SessionPlayer`, `GrammarSessionPlayer`, and summary
  surfaces before redesigning their appearance.
- Keep query keys and IPC facades centralized so redesign work does not touch transport details.
- Preserve stable dimensions for cards, boards, toolbars, and mascot/media slots before styling.
- Audit design tokens in `src/styles/tokens/` and Tailwind theme usage before introducing new
  palettes or motion.
- Treat mascot selection and student preferences as product identity assets, not decoration.

## Backend Boundaries The Redesign Should Rely On

- Practice deck generation stays in `src/modules/exercises`.
- FSRS/SRS logic stays in `src/modules/srs` and native `core/vocab-core`.
- Pronunciation runtime stays behind `electron/pronunciation` and future `electron/core` facades.
- Dictionary work stays behind `electron/dictionary` until the native service is activated.
- Renderer components call typed APIs and should not know whether a backend path is TypeScript,
  WASM, service, or N-API.
