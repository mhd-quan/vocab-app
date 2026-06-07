pub const IMPOSSIBLE: f32 = f32::NEG_INFINITY;

const LOG_PROB_FALLBACK: f32 = -14.0;
const BLANK_PENALTY: f32 = 6.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AlignmentSpan {
    pub start_frame: usize,
    pub end_frame: usize,
    pub avg_log_prob: f32,
    pub detected_index: i32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AlignmentResult {
    pub spans: Vec<AlignmentSpan>,
    pub average_log_prob: f32,
}

impl AlignmentResult {
    pub fn empty() -> Self {
        Self {
            spans: Vec::new(),
            average_log_prob: IMPOSSIBLE,
        }
    }
}

pub fn align_indices(
    target: &[i32],
    blank_index: i32,
    frames: &[f32],
    frame_count: usize,
    label_count: usize,
) -> AlignmentResult {
    if target.is_empty() || frame_count == 0 || label_count == 0 {
        return AlignmentResult::empty();
    }
    let Some(expected_frame_values) = frame_count.checked_mul(label_count) else {
        return AlignmentResult::empty();
    };
    if frames.len() < expected_frame_values {
        return AlignmentResult::empty();
    }

    let blank = if blank_index >= 0 && (blank_index as usize) < label_count {
        blank_index
    } else {
        0
    };
    let target_len = target.len();
    let cols = target_len * 2 + 1;

    let mut labels: Vec<i32> = Vec::with_capacity(cols);
    labels.push(blank);
    for &phoneme in target {
        labels.push(if phoneme >= 0 { phoneme } else { blank });
        labels.push(blank);
    }

    let mut dp = vec![IMPOSSIBLE; frame_count * cols];
    let mut back = vec![0i32; frame_count * cols];

    dp[0] = log_prob(frames, label_count, 0, labels[0], blank);
    if cols > 1 {
        dp[1] = log_prob(frames, label_count, 0, labels[1], blank);
    }

    for t in 1..frame_count {
        let row_offset = t * cols;
        let prev_offset = (t - 1) * cols;
        for s in 0..cols {
            let mut best_prev = s as i32;
            let mut best_score = dp[prev_offset + s];
            if s > 0 {
                let cand = dp[prev_offset + s - 1];
                if cand > best_score {
                    best_score = cand;
                    best_prev = (s - 1) as i32;
                }
            }
            let skip_allowed = s > 1 && labels[s] != blank && labels[s] != labels[s - 2];
            if skip_allowed {
                let cand = dp[prev_offset + s - 2];
                if cand > best_score {
                    best_score = cand;
                    best_prev = (s - 2) as i32;
                }
            }
            dp[row_offset + s] = best_score + log_prob(frames, label_count, t, labels[s], blank);
            back[row_offset + s] = best_prev;
        }
    }

    let last_row = (frame_count - 1) * cols;
    let mut final_state = cols - 1;
    if cols >= 2 {
        let alt = cols - 2;
        if dp[last_row + alt] > dp[last_row + final_state] {
            final_state = alt;
        }
    }

    let mut state_path: Vec<i32> = vec![0; frame_count];
    let mut state = final_state;
    for t in (0..frame_count).rev() {
        state_path[t] = state as i32;
        state = back[t * cols + state] as usize;
    }

    let mut totals = vec![0.0f64; label_count];
    let spans = target
        .iter()
        .enumerate()
        .map(|(i, &phoneme)| {
            let ctc_state = (i * 2 + 1) as i32;
            let mut first: i64 = -1;
            let mut last: i64 = -1;
            for (t, state) in state_path.iter().enumerate() {
                if *state == ctc_state {
                    if first < 0 {
                        first = t as i64;
                    }
                    last = t as i64;
                }
            }
            if first < 0 {
                let fallback =
                    (((i as f32) / (target_len as f32)) * (frame_count as f32)).round() as i64;
                let clamped = fallback.min((frame_count as i64) - 1).max(0);
                first = clamped;
                last = clamped;
            }

            let phoneme_for_span = if phoneme >= 0 { phoneme } else { blank };
            let mut sum = 0.0f32;
            totals.fill(0.0);

            for t in (first as usize)..=(last as usize) {
                sum += log_prob(frames, label_count, t, phoneme_for_span, blank);
                let offset = t * label_count;
                for j in 0..label_count {
                    totals[j] += frames[offset + j] as f64;
                }
            }

            let span = ((last - first + 1).max(1)) as f32;
            let avg = sum / span;

            let mut detected_index: i32 = -1;
            let mut best_total = f64::NEG_INFINITY;
            for (j, total) in totals.iter().enumerate() {
                if *total > best_total {
                    best_total = *total;
                    detected_index = j as i32;
                }
            }

            AlignmentSpan {
                start_frame: first as usize,
                end_frame: last as usize,
                avg_log_prob: avg,
                detected_index,
            }
        })
        .collect();

    let best = (dp[last_row + cols - 1]).max(if cols >= 2 {
        dp[last_row + cols - 2]
    } else {
        IMPOSSIBLE
    });

    AlignmentResult {
        spans,
        average_log_prob: best / frame_count as f32,
    }
}

#[inline]
fn log_prob(frames: &[f32], label_count: usize, frame_idx: usize, label: i32, blank: i32) -> f32 {
    if label < 0 || (label as usize) >= label_count {
        let blank_val = frames
            .get(frame_idx * label_count + blank as usize)
            .copied()
            .unwrap_or(LOG_PROB_FALLBACK);
        return if blank_val.is_finite() {
            blank_val - BLANK_PENALTY
        } else {
            LOG_PROB_FALLBACK
        };
    }
    let v = frames[frame_idx * label_count + label as usize];
    if v.is_finite() {
        return v;
    }
    let blank_val = frames
        .get(frame_idx * label_count + blank as usize)
        .copied()
        .unwrap_or(LOG_PROB_FALLBACK);
    if blank_val.is_finite() {
        blank_val - BLANK_PENALTY
    } else {
        LOG_PROB_FALLBACK
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_short_word_matches_expected_spans() {
        let target = [1, 2, 3];
        let label_count = 4;
        let frames = deterministic_frames(&target, label_count);
        let result = align_indices(&target, 0, &frames, frames.len() / label_count, label_count);

        assert_eq!(result.spans.len(), target.len());
        assert_span(result.spans[0], 0, 3, 1);
        assert_span(result.spans[1], 5, 8, 2);
        assert_span(result.spans[2], 10, 13, 3);
        assert!(result.average_log_prob.is_finite());
    }

    #[test]
    fn empty_inputs_return_empty_alignment() {
        let result = align_indices(&[], 0, &[], 0, 2);

        assert!(result.spans.is_empty());
        assert_eq!(result.average_log_prob, IMPOSSIBLE);
    }

    #[test]
    fn invalid_frame_shape_returns_empty_alignment() {
        let result = align_indices(&[1], 0, &[-0.1, -0.2], 2, 2);

        assert!(result.spans.is_empty());
    }

    fn deterministic_frames(target: &[i32], label_count: usize) -> Vec<f32> {
        let mut frames = Vec::new();
        for &phoneme in target {
            for i in 0..4 {
                let mut frame = vec![-9.0; label_count];
                frame[0] = -5.0;
                frame[phoneme as usize] = if i == 0 || i == 3 { -1.4 } else { -0.22 };
                frames.extend(frame);
            }
            let mut trail = vec![-9.0; label_count];
            trail[0] = -0.12;
            trail[phoneme as usize] = -2.5;
            frames.extend(trail);
        }
        frames
    }

    fn assert_span(span: AlignmentSpan, start: usize, end: usize, detected: i32) {
        assert_eq!(span.start_frame, start);
        assert_eq!(span.end_frame, end);
        assert_eq!(span.detected_index, detected);
        assert!(span.avg_log_prob.is_finite());
    }
}
