// Legacy SM-2 scheduler (still the production writer until Phase 3.2 swaps).
export {
  applyAnswer,
  type ApplyAnswerInput,
  type ApplyAnswerResult,
  EASE_DEFAULT,
  EASE_MIN,
  initialSchedule,
  PASSING_QUALITY,
  qualityFromOutcome,
  type ScheduleState,
} from "./sm2";

// FSRS-lite — the v0.10.0 unified scheduler. Pure module, ready to wire
// into the v2 schema (see plan.md Phase 3). Surfaced under a namespaced
// re-export so callers explicitly opt in: `import { fsrs } from "@/modules/srs"`.
export * as fsrs from "./fsrsLite";
