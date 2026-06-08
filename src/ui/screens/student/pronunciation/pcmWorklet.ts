export const PCM_WORKLET_PROCESSOR_NAME = "pcm-capture";
export const PCM_WORKLET_MODULE_PATH = "pronunciation/pcm-capture-worklet.js";

export interface PcmWorkletModuleUrl {
  url: string;
  protocol: string;
  path: string;
}

/**
 * AudioWorklet modules are governed by the page CSP. The renderer deliberately
 * keeps `script-src 'self'`, so the processor must load from the Vite/Electron
 * renderer origin instead of a blob URL.
 */
export function pcmWorkletModuleUrl(baseHref = window.location.href): PcmWorkletModuleUrl {
  const base = new URL(baseHref);
  const moduleUrl =
    base.protocol === "file:"
      ? new URL(`./${PCM_WORKLET_MODULE_PATH}`, base)
      : new URL(`/${PCM_WORKLET_MODULE_PATH}`, base);

  return {
    url: moduleUrl.toString(),
    protocol: moduleUrl.protocol,
    path: PCM_WORKLET_MODULE_PATH,
  };
}
