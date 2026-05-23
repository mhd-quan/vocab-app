export function clampInPlace(buf: Float32Array): Float32Array {
  for (let i = 0; i < buf.length; i += 1) {
    const value = buf[i] ?? 0;
    if (!Number.isFinite(value)) {
      buf[i] = 0;
    } else if (value > 1) {
      buf[i] = 1;
    } else if (value < -1) {
      buf[i] = -1;
    }
  }
  return buf;
}

export function resampleLinear(buf: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (buf.length === 0 || fromRate <= 0 || toRate <= 0 || fromRate === toRate) return buf;
  const outLength = Math.max(1, Math.round((buf.length * toRate) / fromRate));
  const ratio = fromRate / toRate;
  const out = new Float32Array(outLength);
  const lastIndex = buf.length - 1;

  for (let i = 0; i < outLength; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(lastIndex, left + 1);
    const t = sourceIndex - left;
    out[i] = (buf[left] ?? 0) * (1 - t) + (buf[right] ?? 0) * t;
  }
  return out;
}

/**
 * Prepare audio for the acoustic processor: resample to the target rate,
 * then clamp to [-1, 1] in place. The returned buffer may alias the input
 * when no resampling was needed — callers must not mutate it afterwards.
 */
export function preparePcmForModel(
  buf: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  const resampled = resampleLinear(buf, fromRate, toRate);
  return clampInPlace(resampled);
}
