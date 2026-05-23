// CTC Viterbi alignment for vocab-app pronunciation scoring.
//
// Linked into a single-file Wasm cdylib with no wasm-bindgen JS glue:
// inputs and outputs flow through linear memory that the JS host writes
// via the `alloc`/`dealloc` exports below. The recurrence mirrors
// `src/modules/pronunciation/ctc.ts` so the two implementations stay in
// parity (`tests/unit/pronunciation/viterbi-parity.test.ts` enforces).

#![allow(clippy::missing_safety_doc)]

use core::f32;
use core::slice;

/// Allocate `size` bytes inside the Wasm linear memory and return a
/// pointer the JS host can write into.
#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    let mut buf: Vec<u8> = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

/// Reclaim a previously allocated buffer. `size` must match the original
/// allocation length so the underlying `Vec` is reconstructed correctly.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, size: usize) {
    if ptr.is_null() {
        return;
    }
    let _ = Vec::from_raw_parts(ptr, 0, size);
}

const IMPOSSIBLE: f32 = f32::NEG_INFINITY;
const LOG_PROB_FALLBACK: f32 = -14.0;
const BLANK_PENALTY: f32 = 6.0;

const STATUS_OK: i32 = 0;
const STATUS_EMPTY: i32 = 1;

/// CTC Viterbi alignment.
///
/// * `target_ptr` — `[i32; target_len]` of phoneme indices (negative
///   entries are treated as blank with a penalty — matches the JS port).
/// * `frames_ptr` — `[f32; frame_count * label_count]` flat log-prob
///   matrix, row-major (one frame per row).
/// * `out_ptr` — caller-allocated `[f32; target_len * 4]` interleaved
///   `[start_frame, end_frame, avg_log_prob, detected_index]` per
///   expected phoneme. `detected_index` is encoded as `f32` so the JS
///   side can read all four fields from a single Float32Array view.
///
/// Returns `STATUS_OK` (0) on success, `STATUS_EMPTY` (1) when either
/// the target or the frame matrix is empty (no alignment possible).
#[no_mangle]
pub unsafe extern "C" fn ctc_align(
    target_ptr: *const i32,
    target_len: usize,
    blank_index: i32,
    frames_ptr: *const f32,
    frame_count: usize,
    label_count: usize,
    out_ptr: *mut f32,
) -> i32 {
    if target_len == 0 || frame_count == 0 || label_count == 0 {
        return STATUS_EMPTY;
    }

    let target = slice::from_raw_parts(target_ptr, target_len);
    let frames = slice::from_raw_parts(frames_ptr, frame_count * label_count);
    let out = slice::from_raw_parts_mut(out_ptr, target_len * 4);

    align(target, blank_index, frames, frame_count, label_count, out);
    STATUS_OK
}

fn align(
    target: &[i32],
    blank_index: i32,
    frames: &[f32],
    frame_count: usize,
    label_count: usize,
    out: &mut [f32],
) {
    let target_len = target.len();
    let cols = target_len * 2 + 1;
    let blank = blank_index;

    // CTC label sequence interleaves blanks between target phonemes.
    let mut labels: Vec<i32> = Vec::with_capacity(cols);
    labels.push(blank);
    for &phoneme in target {
        labels.push(if phoneme >= 0 { phoneme } else { blank });
        labels.push(blank);
    }

    let mut dp = vec![IMPOSSIBLE; frame_count * cols];
    let mut back = vec![0i32; frame_count * cols];

    // Init row 0: can start at either a leading blank (s=0) or the
    // first emitted symbol (s=1).
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
            let skip_allowed =
                s > 1 && labels[s] != blank && labels[s] != labels[s - 2];
            if skip_allowed {
                let cand = dp[prev_offset + s - 2];
                if cand > best_score {
                    best_score = cand;
                    best_prev = (s - 2) as i32;
                }
            }
            let label = labels[s];
            dp[row_offset + s] = best_score + log_prob(frames, label_count, t, label, blank);
            back[row_offset + s] = best_prev;
        }
    }

    // Backtrack from the better of the two valid terminal states.
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

    // Build per-target-phoneme spans and per-span averaged log-prob.
    let mut totals = vec![0.0f64; label_count];
    for (i, &phoneme) in target.iter().enumerate() {
        let ctc_state = (i * 2 + 1) as i32;
        let mut first: i64 = -1;
        let mut last: i64 = -1;
        for t in 0..frame_count {
            if state_path[t] == ctc_state {
                if first < 0 {
                    first = t as i64;
                }
                last = t as i64;
            }
        }
        if first < 0 {
            // Fallback: spread phonemes uniformly across the frame range.
            let denom = if target_len == 0 { 1 } else { target_len };
            let fallback = (((i as f32) / (denom as f32)) * (frame_count as f32))
                .round() as i64;
            let clamped = fallback.min((frame_count as i64) - 1).max(0);
            first = clamped;
            last = clamped;
        }

        let phoneme_for_span = if phoneme >= 0 { phoneme } else { blank };
        let mut sum = 0.0f32;
        // Per-label accumulator for "most likely detected label".
        for total in totals.iter_mut() {
            *total = 0.0;
        }
        for t in (first as usize)..=(last as usize) {
            sum += log_prob(frames, label_count, t, phoneme_for_span, blank);
            let offset = t * label_count;
            for j in 0..label_count {
                totals[j] += frames[offset + j] as f64;
            }
        }
        let span = ((last - first + 1).max(1)) as f32;
        let avg = sum / span;

        let mut best_idx: i32 = -1;
        let mut best_total = f64::NEG_INFINITY;
        for j in 0..label_count {
            if totals[j] > best_total {
                best_total = totals[j];
                best_idx = j as i32;
            }
        }

        let base = i * 4;
        out[base] = first as f32;
        out[base + 1] = last as f32;
        out[base + 2] = avg;
        out[base + 3] = best_idx as f32;
    }
}

#[inline]
fn log_prob(frames: &[f32], label_count: usize, frame_idx: usize, label: i32, blank: i32) -> f32 {
    if label < 0 || (label as usize) >= label_count {
        let blank_offset = frame_idx * label_count + (blank as usize);
        let blank_val = frames.get(blank_offset).copied().unwrap_or(LOG_PROB_FALLBACK);
        return if blank_val.is_finite() {
            blank_val - BLANK_PENALTY
        } else {
            LOG_PROB_FALLBACK
        };
    }
    let offset = frame_idx * label_count + (label as usize);
    let v = frames[offset];
    if v.is_finite() {
        return v;
    }
    let blank_offset = frame_idx * label_count + (blank as usize);
    let blank_val = frames.get(blank_offset).copied().unwrap_or(LOG_PROB_FALLBACK);
    if blank_val.is_finite() {
        blank_val - BLANK_PENALTY
    } else {
        LOG_PROB_FALLBACK
    }
}
