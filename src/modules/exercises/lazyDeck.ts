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
import { rngFromSeed, shuffle } from "./random";
import type {
  AnyExercisePlugin,
  BuildContext,
  BuildSkipReason,
  DefinitionPriority,
  Exercise,
  ExerciseKind,
  ExerciseSource,
} from "./types";

export interface LazyBuildOptions {
  sources: ExerciseSource[];
  /** Optional wider pool for distractors and cross-source exercises. */
  sourcePool?: ExerciseSource[];
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
  seenSourceKeys?: Iterable<string>;
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
  source: ExerciseSource;
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
  const seen = new Set(opts.seenSourceKeys ?? []);
  const shouldGateNew = opts.requireFlashcardForNew === true;
  const maxRun = Math.max(1, opts.maxConsecutiveSameKind ?? DEFAULT_MAX_RUN);
  const sourcePool = opts.sourcePool ?? opts.sources;
  const distractorPool = sourcePool.map((source) => source.headword);

  const groups: Array<Array<{ source: ExerciseSource; kind: ExerciseKind }>> = [];
  const skippedUpfront: SkipRecord[] = [];

  for (const source of opts.sources) {
    const isNew = shouldGateNew && !seen.has(source.ref.sourceKey);
    const group: Array<{ source: ExerciseSource; kind: ExerciseKind }> = [];
    if (isNew) {
      group.push({ source, kind: "flashcard" });
      for (const kind of opts.kinds) {
        if (kind !== "flashcard") {
          group.push({ source, kind });
        }
      }
    } else {
      for (const kind of opts.kinds) {
        group.push({ source, kind });
      }
    }
    if (group.length > 0) groups.push(group);
  }

  const grouped = opts.shuffle === false ? groups : shuffle(groups, rng);
  const flatPlan = grouped.flat();
  const ordered = opts.shuffle === false ? flatPlan : applyKindDiversity(flatPlan, maxRun);

  const limited =
    typeof opts.maxExercises === "number" && opts.maxExercises >= 0
      ? ordered.slice(0, opts.maxExercises)
      : ordered;

  const slots: PlannedSlot[] = limited.map((slot, index) => ({
    source: slot.source,
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
      sourcePool,
      definitionPriority: opts.definitionPriority ?? "en_first",
      rng,
      sessionSeed: opts.sessionSeed,
    };
    const built = plugin.build(slot.source, ctx);
    if (built) {
      slot.built = built;
      return built;
    }
    slot.skipped = "build_returned_null";
    lateSkipped.push({ entryId: slot.source.id, kind: slot.kind, reason: "build_returned_null" });
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
