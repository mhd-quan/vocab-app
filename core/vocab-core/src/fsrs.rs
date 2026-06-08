const DAY_MS: f64 = 86_400_000.0;
const MINUTE_MS: i64 = 60_000;

pub const DIFFICULTY_DEFAULT: f64 = 5.0;
pub const DIFFICULTY_MIN: f64 = 1.0;
pub const DIFFICULTY_MAX: f64 = 10.0;
pub const STABILITY_FLOOR: f64 = 0.2;
pub const LAPSE_RETENTION_FACTOR: f64 = 0.3;
pub const RELEARN_INTERVAL_MIN: i64 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FsrsState {
    New,
    Learning,
    ShortTerm,
    LongTerm,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FsrsRating {
    Again = 1,
    Hard = 2,
    Good = 3,
    Easy = 4,
}

impl FsrsRating {
    pub fn from_clamped(raw: u8) -> Self {
        match raw.clamp(1, 4) {
            1 => Self::Again,
            2 => Self::Hard,
            3 => Self::Good,
            _ => Self::Easy,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FsrsThresholds {
    pub short_term_days: f64,
    pub long_term_days: f64,
}

impl Default for FsrsThresholds {
    fn default() -> Self {
        Self {
            short_term_days: 1.0,
            long_term_days: 21.0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FsrsMemoryState {
    pub stability: f64,
    pub difficulty: f64,
    pub state: FsrsState,
    pub reps: u32,
    pub lapses: u32,
}

impl Default for FsrsMemoryState {
    fn default() -> Self {
        Self {
            stability: 0.0,
            difficulty: DIFFICULTY_DEFAULT,
            state: FsrsState::New,
            reps: 0,
            lapses: 0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ApplyAnswerResult {
    pub stability: f64,
    pub difficulty: f64,
    pub state: FsrsState,
    pub reps: u32,
    pub lapses: u32,
    pub due_at_ms: i64,
    pub last_reviewed_at_ms: i64,
}

impl ApplyAnswerResult {
    pub fn memory_state(self) -> FsrsMemoryState {
        FsrsMemoryState {
            stability: self.stability,
            difficulty: self.difficulty,
            state: self.state,
            reps: self.reps,
            lapses: self.lapses,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SelfGrade {
    Again,
    Hard,
    Good,
    Easy,
}

pub fn rating_from_outcome(correct: bool, self_grade: Option<SelfGrade>) -> FsrsRating {
    match self_grade {
        Some(SelfGrade::Again) => FsrsRating::Again,
        Some(SelfGrade::Hard) => FsrsRating::Hard,
        Some(SelfGrade::Good) => FsrsRating::Good,
        Some(SelfGrade::Easy) => FsrsRating::Easy,
        None if correct => FsrsRating::Good,
        None => FsrsRating::Again,
    }
}

pub fn apply_answer(
    prev: Option<FsrsMemoryState>,
    rating: FsrsRating,
    now_ms: i64,
    thresholds: FsrsThresholds,
) -> ApplyAnswerResult {
    let prev = prev.unwrap_or_default();

    if rating == FsrsRating::Again {
        let stability = STABILITY_FLOOR.max(prev.stability * LAPSE_RETENTION_FACTOR);
        let difficulty = clamp(prev.difficulty + 0.4, DIFFICULTY_MIN, DIFFICULTY_MAX);
        return ApplyAnswerResult {
            stability,
            difficulty,
            state: FsrsState::Learning,
            reps: 0,
            lapses: prev.lapses + 1,
            due_at_ms: now_ms + RELEARN_INTERVAL_MIN * MINUTE_MS,
            last_reviewed_at_ms: now_ms,
        };
    }

    let seed_stability = match rating {
        FsrsRating::Easy => 3.0,
        FsrsRating::Good => 1.0,
        FsrsRating::Hard => 0.5,
        FsrsRating::Again => unreachable!("again path returns above"),
    };
    let success_factor = match rating {
        FsrsRating::Easy => 2.5,
        FsrsRating::Good => 1.6,
        FsrsRating::Hard => 1.2,
        FsrsRating::Again => unreachable!("again path returns above"),
    };

    let next_stability = if prev.state == FsrsState::New || prev.stability < STABILITY_FLOOR {
        seed_stability
    } else {
        prev.stability * success_factor * 0.9_f64.powf(prev.difficulty - DIFFICULTY_DEFAULT)
    };

    let difficulty_delta = match rating {
        FsrsRating::Easy => -0.15,
        FsrsRating::Good => 0.0,
        FsrsRating::Hard => 0.2,
        FsrsRating::Again => unreachable!("again path returns above"),
    };
    let next_difficulty = clamp(
        prev.difficulty + difficulty_delta,
        DIFFICULTY_MIN,
        DIFFICULTY_MAX,
    );

    let next_state = if next_stability >= thresholds.long_term_days {
        FsrsState::LongTerm
    } else if next_stability >= thresholds.short_term_days {
        FsrsState::ShortTerm
    } else {
        FsrsState::Learning
    };

    ApplyAnswerResult {
        stability: round_decimal(next_stability, 4),
        difficulty: round_decimal(next_difficulty, 3),
        state: next_state,
        reps: prev.reps + 1,
        lapses: prev.lapses,
        due_at_ms: now_ms + (next_stability * DAY_MS).round() as i64,
        last_reviewed_at_ms: now_ms,
    }
}

fn clamp(n: f64, lo: f64, hi: f64) -> f64 {
    n.max(lo).min(hi)
}

fn round_decimal(n: f64, places: i32) -> f64 {
    let factor = 10_f64.powi(places);
    (n * factor).round() / factor
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW_MS: i64 = 1_768_521_600_000;

    #[test]
    fn new_good_card_seeds_short_term_state() {
        let result = apply_answer(None, FsrsRating::Good, NOW_MS, FsrsThresholds::default());

        assert_eq!(result.stability, 1.0);
        assert_eq!(result.state, FsrsState::ShortTerm);
        assert_eq!(result.reps, 1);
        assert_eq!(result.lapses, 0);
        assert_eq!(result.difficulty, DIFFICULTY_DEFAULT);
        assert_eq!(result.due_at_ms - NOW_MS, DAY_MS as i64);
    }

    #[test]
    fn new_easy_card_seeds_larger_stability() {
        let result = apply_answer(None, FsrsRating::Easy, NOW_MS, FsrsThresholds::default());

        assert_eq!(result.stability, 3.0);
        assert_eq!(result.state, FsrsState::ShortTerm);
        assert!(result.difficulty < DIFFICULTY_DEFAULT);
    }

    #[test]
    fn new_hard_card_stays_learning() {
        let result = apply_answer(None, FsrsRating::Hard, NOW_MS, FsrsThresholds::default());

        assert_eq!(result.stability, 0.5);
        assert_eq!(result.state, FsrsState::Learning);
        assert!(result.difficulty > DIFFICULTY_DEFAULT);
    }

    #[test]
    fn again_schedules_short_relearn() {
        let result = apply_answer(None, FsrsRating::Again, NOW_MS, FsrsThresholds::default());

        assert_eq!(result.state, FsrsState::Learning);
        assert_eq!(result.lapses, 1);
        assert_eq!(result.reps, 0);
        assert!(result.stability >= STABILITY_FLOOR);
        assert_eq!(result.due_at_ms - NOW_MS, MINUTE_MS);
    }

    #[test]
    fn repeated_good_and_easy_reviews_reach_long_term() {
        let mut state = apply_answer(None, FsrsRating::Good, NOW_MS, FsrsThresholds::default());
        assert_eq!(state.state, FsrsState::ShortTerm);

        state = apply_answer(
            Some(state.memory_state()),
            FsrsRating::Good,
            NOW_MS,
            FsrsThresholds::default(),
        );
        assert_eq!(state.state, FsrsState::ShortTerm);
        assert!(state.stability > 1.0);

        for _ in 0..30 {
            if state.state == FsrsState::LongTerm {
                break;
            }
            state = apply_answer(
                Some(state.memory_state()),
                FsrsRating::Easy,
                NOW_MS,
                FsrsThresholds::default(),
            );
        }
        assert_eq!(state.state, FsrsState::LongTerm);
        assert!(state.stability >= FsrsThresholds::default().long_term_days);
    }

    #[test]
    fn lapse_from_long_term_reduces_stability() {
        let prev = FsrsMemoryState {
            stability: 30.0,
            difficulty: 4.0,
            state: FsrsState::LongTerm,
            reps: 8,
            lapses: 0,
        };
        let result = apply_answer(
            Some(prev),
            FsrsRating::Again,
            NOW_MS,
            FsrsThresholds::default(),
        );

        assert_eq!(result.state, FsrsState::Learning);
        assert_eq!(result.lapses, 1);
        assert_eq!(result.stability, 9.0);
    }

    #[test]
    fn custom_thresholds_drive_state_assignment() {
        let prev = FsrsMemoryState {
            stability: 5.0,
            difficulty: 5.0,
            state: FsrsState::ShortTerm,
            reps: 3,
            lapses: 0,
        };

        let aggressive = apply_answer(
            Some(prev),
            FsrsRating::Good,
            NOW_MS,
            FsrsThresholds {
                short_term_days: 3.0,
                long_term_days: 30.0,
            },
        );
        assert_eq!(aggressive.state, FsrsState::ShortTerm);

        let conservative = apply_answer(
            Some(prev),
            FsrsRating::Good,
            NOW_MS,
            FsrsThresholds {
                short_term_days: 1.0,
                long_term_days: 7.0,
            },
        );
        assert_eq!(conservative.state, FsrsState::LongTerm);
    }

    #[test]
    fn rating_from_outcome_matches_typescript_scheduler() {
        assert_eq!(
            rating_from_outcome(false, Some(SelfGrade::Again)),
            FsrsRating::Again
        );
        assert_eq!(
            rating_from_outcome(false, Some(SelfGrade::Hard)),
            FsrsRating::Hard
        );
        assert_eq!(
            rating_from_outcome(false, Some(SelfGrade::Good)),
            FsrsRating::Good
        );
        assert_eq!(
            rating_from_outcome(false, Some(SelfGrade::Easy)),
            FsrsRating::Easy
        );
        assert_eq!(rating_from_outcome(true, None), FsrsRating::Good);
        assert_eq!(rating_from_outcome(false, None), FsrsRating::Again);
    }
}
