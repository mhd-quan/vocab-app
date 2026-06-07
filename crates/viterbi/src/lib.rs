// CTC Viterbi alignment for vocab-app pronunciation scoring.
//
// Linked into a single-file Wasm cdylib with no wasm-bindgen JS glue:
// inputs and outputs flow through linear memory that the JS host writes
// via the `alloc`/`dealloc` exports below. The recurrence mirrors
// `src/modules/pronunciation/ctc.ts` so the two implementations stay in
// parity (`tests/unit/pronunciation/viterbi-parity.test.ts` enforces).

#![allow(clippy::missing_safety_doc)]

use core::slice;
use vocab_core::ctc::align_indices;

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

    let Some(frame_values) = frame_count.checked_mul(label_count) else {
        return STATUS_EMPTY;
    };

    let target = slice::from_raw_parts(target_ptr, target_len);
    let frames = slice::from_raw_parts(frames_ptr, frame_values);
    let out = slice::from_raw_parts_mut(out_ptr, target_len * 4);

    let alignment = align_indices(target, blank_index, frames, frame_count, label_count);
    if alignment.spans.len() != target_len {
        return STATUS_EMPTY;
    }
    for (i, span) in alignment.spans.iter().enumerate() {
        let base = i * 4;
        out[base] = span.start_frame as f32;
        out[base + 1] = span.end_frame as f32;
        out[base + 2] = span.avg_log_prob;
        out[base + 3] = span.detected_index as f32;
    }
    STATUS_OK
}
