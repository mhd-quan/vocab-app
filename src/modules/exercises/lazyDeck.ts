/**
 * Lazy deck builder.
 *
 * The original `buildDeck` materialised every exercise × every kind
 * upfront. For a 200-entry lesson × 2 kinds that's 400 payloads built
 * before the first card paints — visibly stalling sessions on a 4GB /
 * 1 GHz target.
 *
 * `createLazyDeck` splits planning from construction:
 *   - Planning walks `(entry, kind)` pairs once, applies the intro-gate
 *     and kind-diversity rules, then shuffles → cheap arithmetic only.
 *   - Construction (calling `plugin.build`) happens on demand inside
 *     `peek(offset)` / `prefetch(upTo)`. Built exercises are cached so
 *     a re-read is free.
 *
 * Backwards compatibility: `buildDeck` in `engine.ts` keeps its eager
 * return shape — it can be implemented internally as `materialize()`
 * over a lazy deck. Callers that opt into the lazy API import this
 * module directly.
 */
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { rngFromSeed, shuffle } from "./random";
import type {
  AnyExercisePlugin,
  BuildContext,
  BuildSkipReason,
  DefinitionPriority,
  Exercise,
  ExerciseKind,
} from "./types";

export interface LazyBuildOptions {
  entries: VocabEntryFull[];
  kinds: ExerciseKind[];
  sessionSeed: string;
  /**
   * Resolver — given a kind, return the matching plugin. Lets the
   * `engine.ts` registry stay the single source of truth; this module
   * has no plugin dependency of its own.
   */
  getPlugin: (kind: ExerciseKind) => AnyExercisePlugin;
  definitionPriority?: DefinitionPriority;
  shuffle?: boolean;
  seenEntryIds?: Iterable<number>;
  requireFlashcardForNew?: boolean;
  /** Soft cap. Defaults to all planned slots. */
  maxExercises?: number;
  /**
   * Max number of cards of the same kind allowed back-to-back after
   * planning. Defaults to 3 — enough to feel grouped but not droning.
   */
  maxConsecutiveSameKind?: number;
}

interface PlannedSlot {
  entry: VocabEntryFull;
  kind: ExerciseKind;
  /** Slot order in the final deck. */
  index: number;
  /** Pre-built exercise cache. Set lazily on first `peek`. */
  built: Exercise | null;
  /** Set when `plugin.build` returns null at peek time. */
  skipped: BuildSkipReason | null;
}

export interface LazyDeck {
  /** Total slot count (some slots may resolve to a build failure). */
  size: number;
  /** Materialise + return the slot at `offset`, or null if skipped/out-of-range. */
  peek(offset: number): Exercise | null;
  /** Eagerly build slots up to and including `upToOffset`. No-op for already-built. */
  prefetch(upToOffset: number): void;
  /** Build all slots and return only the successful ones. Mirrors the eager API. */
  materialize(): { exercises: Exercise[]; skipped: SkipRecord[] };
}

export interface SkipRecord {
  entryId: number;
  kind: ExerciseKind;
  reason: BuildSkipReason;
}

const DEFAULT_MAX_RUN = 3;

export function createLazyDeck(opts: LazyBuildOptions): LazyDeck {
  const rng = rngFromSeed(opts.sessionSeed);
  const seen = new Set(opts.seenEntryIds ?? []);
  const shouldGateNew = opts.requireFlashcardForNew === true;
  const maxRun = Math.max(1, opts.maxConsecutiveSameKind ?? DEFAULT_MAX_RUN);
  const distractorPool = opts.entries.map((e) => e.headword);

  const introPlan: Array<{ entry: VocabEntryFull; kind: ExerciseKind }> = [];
  const reviewPlan: Array<{ entry: VocabEntryFull; kind: ExerciseKind }> = [];
  const skippedUpfront: SkipRecord[] = [];

  for (const entry of opts.entries) {
    const isNew = shouldGateNew && !seen.has(entry.id);
    if (isNew) {
      introPlan.push({ entry, kind: "flashcard" });
      for (const kind of opts.kinds) {
        if (kind !== "flashcard") {
          skippedUpfront.push({ entryId: entry.id, kind, reason: "requires_flashcard_first" });
        }
      }
    } else {
      for (const kind of opts.kinds) {
        reviewPlan.push({ entry, kind });
      }
    }
  }

  const ordered =
    opts.shuffle === false
      ? [...introPlan, ...reviewPlan]
      : [...shuffle(introPlan, rng), ...applyKindDiversity(shuffle(reviewPlan, rng), maxRun)];

  const limited =
    typeof opts.maxExercises === "number" && opts.maxExercises >= 0
      ? ordered.slice(0, opts.maxExercises)
      : ordered;

  const slots: PlannedSlot[] = limited.map((slot, index) => ({
    entry: slot.entry,
    kind: slot.kind,
    index,
    built: null,
    skipped: null,
  }));

  const lateSkipped: SkipRecord[] = [];

  function buildSlot(slot: PlannedSlot): Exercise | null {
    if (slot.built) return slot.built;
    if (slot.skipped) return null;
    const plugin = opts.getPlugin(slot.kind);
    const ctx: BuildContext = {
      distractorPool,
      entryPool: opts.entries,
      definitionPriority: opts.definitionPriority ?? "en_first",
      rng,
      sessionSeed: opts.sessionSeed,
    };
    const built = plugin.build(slot.entry, ctx);
    if (built) {
      slot.built = built;
      return built;
    }
    slot.skipped = "build_returned_null";
    lateSkipped.push({ entryId: slot.entry.id, kind: slot.kind, reason: "build_returned_null" });
    return null;
  }

  return {
    size: slots.length,
    peek(offset) {
      const slot = slots[offset];
      if (!slot) return null;
      return buildSlot(slot);
    },
    prefetch(upToOffset) {
      const stop = Math.min(slots.length - 1, Math.max(0, upToOffset));
      for (let i = 0; i <= stop; i++) {
        const slot = slots[i];
        if (slot) buildSlot(slot);
      }
    },
    materialize() {
      const out: Exercise[] = [];
      for (const slot of slots) {
        const ex = buildSlot(slot);
        if (ex) out.push(ex);
      }
      return { exercises: out, skipped: [...skippedUpfront, ...lateSkipped] };
    },
  };
}

/**
 * After shuffling, run a single-pass "spread" that breaks up runs of
 * more than `maxRun` consecutive cards of the same kind. The displaced
 * card swaps with the next slot of a different kind. Deterministic
 * because the input is already seeded-shuffled — no extra RNG draws.
 */
function applyKindDiversity<T extends { kind: ExerciseKind }>(plan: T[], maxRun: number): T[] {
  if (plan.length <= maxRun) return plan;
  const out = [...plan];
  for (let i = maxRun; i < out.length; i++) {
    const anchor = out[i];
    if (!anchor) continue;
    const head = out[i - maxRun];
    if (!head) continue;
    const windowKind = head.kind;
    let allSame = true;
    for (let k = i - maxRun; k <= i; k++) {
      if (out[k]?.kind !== windowKind) {
        allSame = false;
        break;
      }
    }
    if (!allSame) continue;
    // Swap with the nearest later card of a different kind.
    for (let j = i + 1; j < out.length; j++) {
      const cand = out[j];
      if (cand && cand.kind !== anchor.kind) {
        out[i] = cand;
        out[j] = anchor;
        break;
      }
    }
  }
  return out;
}
