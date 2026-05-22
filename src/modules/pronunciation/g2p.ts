import type { PronunciationTarget } from "./types";

const CMU_FALLBACK: Record<string, string> = {
  fantastic: "F AE1 N T AE2 S T IH0 K",
  family: "F AE1 M AH0 L IY0",
  relative: "R EH1 L AH0 T IH0 V",
  pronunciation: "P R AH0 N AH2 N S IY0 EY1 SH AH0 N",
  vocabulary: "V OW0 K AE1 B Y AH0 L EH2 R IY0",
  grammar: "G R AE1 M ER0",
  student: "S T UW1 D AH0 N T",
  tutor: "T UW1 T ER0",
};

const DIGRAPH_PHONEMES: Array<[string, string]> = [
  ["tion", "SH AH0 N"],
  ["sion", "ZH AH0 N"],
  ["ough", "AO1"],
  ["igh", "AY1"],
  ["ph", "F"],
  ["sh", "SH"],
  ["ch", "CH"],
  ["th", "TH"],
  ["ng", "NG"],
  ["qu", "K W"],
  ["ck", "K"],
  ["ee", "IY1"],
  ["oo", "UW1"],
  ["ai", "EY1"],
  ["ay", "EY1"],
  ["oa", "OW1"],
  ["ow", "AW1"],
  ["oi", "OY1"],
  ["oy", "OY1"],
  ["er", "ER0"],
  ["ir", "ER0"],
  ["ur", "ER0"],
  ["ar", "AA1 R"],
  ["or", "AO1 R"],
];

const LETTER_PHONEMES: Record<string, string> = {
  a: "AE1",
  b: "B",
  c: "K",
  d: "D",
  e: "EH1",
  f: "F",
  g: "G",
  h: "HH",
  i: "IH1",
  j: "JH",
  k: "K",
  l: "L",
  m: "M",
  n: "N",
  o: "AA1",
  p: "P",
  q: "K",
  r: "R",
  s: "S",
  t: "T",
  u: "AH1",
  v: "V",
  w: "W",
  x: "K S",
  y: "Y",
  z: "Z",
};

export function buildPronunciationTarget(text: string, ipa?: string | null): PronunciationTarget {
  const normalized = normalizeTerm(text);
  const cmu = CMU_FALLBACK[normalized];
  if (cmu) return targetFromCmu(text, cmu, "cmudict");

  const ipaTarget = targetFromIpa(text, ipa);
  if (ipaTarget) return ipaTarget;

  return targetFromCmu(text, heuristicCmu(normalized), "heuristic");
}

export function stripStress(phoneme: string): string {
  return phoneme.replace(/[012]$/, "");
}

export function stressOf(phoneme: string): 0 | 1 | 2 | null {
  const last = phoneme.at(-1);
  if (last === "0" || last === "1" || last === "2") return Number(last) as 0 | 1 | 2;
  return null;
}

function targetFromCmu(
  text: string,
  cmu: string,
  source: PronunciationTarget["source"],
): PronunciationTarget {
  const raw = cmu.split(/\s+/).filter(Boolean);
  return {
    text,
    phonemes: raw.map(stripStress),
    stressPattern: raw.map(stressOf),
    source,
  };
}

function targetFromIpa(text: string, ipa?: string | null): PronunciationTarget | null {
  const cleaned = ipa?.trim().replace(/^\/|\/$/g, "");
  if (!cleaned) return null;
  const phonemes = cleaned
    .replace(/[ˈˌ.]/g, " ")
    .split(/\s+/)
    .map((part) => ipaTokenToArpabet(part))
    .filter((part): part is string => Boolean(part));
  if (phonemes.length === 0) return null;
  return {
    text,
    phonemes,
    stressPattern: phonemes.map(() => null),
    source: "ipa",
  };
}

function heuristicCmu(term: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < term.length) {
    const char = term[i];
    if (!char || /[^a-z]/.test(char)) {
      i += 1;
      continue;
    }
    const match = DIGRAPH_PHONEMES.find(([pattern]) => term.startsWith(pattern, i));
    if (match) {
      out.push(...match[1].split(/\s+/));
      i += match[0].length;
      continue;
    }
    out.push(...(LETTER_PHONEMES[char] ?? "").split(/\s+/).filter(Boolean));
    i += 1;
  }
  return out.join(" ");
}

function ipaTokenToArpabet(token: string): string | null {
  const map: Record<string, string> = {
    f: "F",
    v: "V",
    p: "P",
    b: "B",
    t: "T",
    d: "D",
    k: "K",
    g: "G",
    s: "S",
    z: "Z",
    m: "M",
    n: "N",
    l: "L",
    r: "R",
    h: "HH",
    w: "W",
    j: "Y",
    i: "IY",
    "i:": "IY",
    ɪ: "IH",
    e: "EH",
    æ: "AE",
    ə: "AH",
    ʌ: "AH",
    ɑ: "AA",
    "ɑ:": "AA",
    ɔ: "AO",
    "ɔ:": "AO",
    u: "UW",
    "u:": "UW",
    ʊ: "UH",
    θ: "TH",
    ð: "DH",
    ʃ: "SH",
    ʒ: "ZH",
    tʃ: "CH",
    dʒ: "JH",
    ŋ: "NG",
  };
  return map[token] ?? null;
}

function normalizeTerm(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z'\s-]/g, "")
      .split(/[\s-]+/)[0]
      ?.replace(/^'+|'+$/g, "") ?? ""
  );
}
