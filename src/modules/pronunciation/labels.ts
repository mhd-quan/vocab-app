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
