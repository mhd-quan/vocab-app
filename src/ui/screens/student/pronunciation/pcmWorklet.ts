/**
 * AudioWorklet processor source for PCM capture.
 *
 * The processor runs on the dedicated Web Audio render thread, copies
 * each 128-sample render quantum into a fresh Float32Array, and posts it
 * to the main thread. ScriptProcessorNode (the deprecated alternative)
 * runs its `onaudioprocess` callback on the renderer main thread and is
 * known to cause UI hitches during long captures — AudioWorklet keeps
 * the audio path off-main entirely.
 */
export const PCM_WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;
