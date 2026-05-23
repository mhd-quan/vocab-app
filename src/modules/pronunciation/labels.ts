const BLANK_LABEL = "<blank>";

const SPECIAL_LABELS = new Set(["<s>", "</s>", "<unk>", "|"]);

const ACOUSTIC_TO_ARPABET: Record<string, string> = {
  p: "P",
  b: "B",
  t: "T",
  d: "D",
  k: "K",
  g: "G",
  ɡ: "G",
  f: "F",
  v: "V",
  θ: "TH",
  ð: "DH",
  s: "S",
  z: "Z",
  ʃ: "SH",
  ʒ: "ZH",
  h: "HH",
  m: "M",
  n: "N",
  ŋ: "NG",
  l: "L",
  r: "R",
  ɹ: "R",
  w: "W",
  j: "Y",
  y: "Y",
  tʃ: "CH",
  tS: "CH",
  dʒ: "JH",
  dZ: "JH",
  i: "IY",
  "i:": "IY",
  iː: "IY",
  ɪ: "IH",
  e: "EH",
  ɛ: "EH",
  æ: "AE",
  ə: "AH",
  ʌ: "AH",
  ɐ: "AH",
  ɑ: "AA",
  "ɑ:": "AA",
  ɑː: "AA",
  ɒ: "AA",
  ɔ: "AO",
  "ɔ:": "AO",
  ɔː: "AO",
  u: "UW",
  "u:": "UW",
  uː: "UW",
  ʊ: "UH",
  ɜ: "ER",
  "ɜ:": "ER",
  ɜː: "ER",
  ɚ: "ER",
  ɝ: "ER",
  o: "OW",
  oʊ: "OW",
  əʊ: "OW",
  eɪ: "EY",
  ei: "EY",
  ai: "AY",
  aɪ: "AY",
  au: "AW",
  aʊ: "AW",
  ɔɪ: "OY",
  oɪ: "OY",
};

const ARPABET = new Set(Object.values(ACOUSTIC_TO_ARPABET));

export const ARPABET_VOWELS = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
]);

export function isArpabetVowel(label: string): boolean {
  return ARPABET_VOWELS.has(label);
}

export function normalizeAcousticLabel(label: string): string | null {
  const normalized = label.trim();
  if (!normalized) return null;
  if (normalized === BLANK_LABEL || normalized === "<pad>") return BLANK_LABEL;
  if (SPECIAL_LABELS.has(normalized)) return null;
  if (ARPABET.has(normalized)) return normalized;
  return ACOUSTIC_TO_ARPABET[normalized] ?? null;
}

/**
 * Canonical ARPABET → IPA mapping used for display when an entry has no
 * authored IPA. Vowels resolve to the closest single IPA glyph; stress
 * markers come from the per-phoneme `stressPattern` so the rendered
 * string mirrors what a dictionary entry would look like.
 */
const ARPABET_TO_IPA: Record<string, string> = {
  P: "p",
  B: "b",
  T: "t",
  D: "d",
  K: "k",
  G: "ɡ",
  F: "f",
  V: "v",
  TH: "θ",
  DH: "ð",
  S: "s",
  Z: "z",
  SH: "ʃ",
  ZH: "ʒ",
  HH: "h",
  M: "m",
  N: "n",
  NG: "ŋ",
  L: "l",
  R: "ɹ",
  W: "w",
  Y: "j",
  CH: "tʃ",
  JH: "dʒ",
  AA: "ɑ",
  AE: "æ",
  AH: "ə",
  AO: "ɔ",
  AW: "aʊ",
  AY: "aɪ",
  EH: "ɛ",
  ER: "ɜr",
  EY: "eɪ",
  IH: "ɪ",
  IY: "iː",
  OW: "oʊ",
  OY: "ɔɪ",
  UH: "ʊ",
  UW: "uː",
};

/**
 * Render a phoneme list as a display-ready IPA string. Phonemes resolve
 * via the canonical ARPABET → IPA map; stress markers (`ˈ` / `ˌ`) come
 * from the parallel `stressPattern` array. If `wordBoundaries` is
 * provided, words are separated by a single space — useful for phrase
 * targets so `[JH OY N | IH N]` renders as `dʒɔɪn ɪn`. Returns an empty
 * string when no phoneme is recognised so callers can fall back.
 */
export function arpabetToIpa(
  phonemes: readonly string[],
  stressPattern: ReadonlyArray<0 | 1 | 2 | null>,
  wordBoundaries: readonly number[] = [],
): string {
  if (phonemes.length === 0) return "";
  const boundaries = new Set(wordBoundaries.filter((idx) => idx > 0 && idx < phonemes.length));
  const out: string[] = [];
  for (let i = 0; i < phonemes.length; i += 1) {
    if (boundaries.has(i)) out.push(" ");
    const stress = stressPattern[i] ?? null;
    if (stress === 1) out.push("ˈ");
    else if (stress === 2) out.push("ˌ");
    const phoneme = phonemes[i] ?? "";
    const ipa = ARPABET_TO_IPA[phoneme];
    if (!ipa) return "";
    out.push(ipa);
  }
  return out.join("");
}
