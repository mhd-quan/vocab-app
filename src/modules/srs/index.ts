// Legacy SM-2 scheduler. Kept for tests and archive-read compatibility;
// v0.10+ production review writes use the namespaced FSRS-lite export below.
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

// FSRS-lite — the v0.10+ scheduler used by curated and personal review
// repositories. Surfaced under a namespaced re-export so callers explicitly
// opt in: `import { fsrs } from "@/modules/srs"`.
export * as fsrs from "./fsrsLite";
