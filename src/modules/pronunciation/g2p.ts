import { isArpabetVowel, normalizeAcousticLabel } from "./labels";
import type { PronunciationTarget } from "./types";

const PRIMARY_STRESS = "ˈ";
const SECONDARY_STRESS = "ˌ";

export interface BuildPronunciationTargetOptions {
  lookup?: (word: string) => string | null;
}

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

export function buildPronunciationTarget(
  text: string,
  ipa?: string | null,
  options?: BuildPronunciationTargetOptions,
): PronunciationTarget {
  const normalized = normalizeTerm(text);
  const cmu = options?.lookup?.(normalized);
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
  const cleaned = ipa
    ?.trim()
    .replace(/^\/|\/$/g, "")
    .replace(/^\[|\]$/g, "");
  if (!cleaned) return null;
  const phonemes: string[] = [];
  const stressPattern: Array<0 | 1 | 2 | null> = [];
  let pendingStress: 0 | 1 | 2 = 0;

  let i = 0;
  while (i < cleaned.length) {
    const char = cleaned[i] ?? "";
    if (char === PRIMARY_STRESS) {
      pendingStress = 1;
      i += 1;
      continue;
    }
    if (char === SECONDARY_STRESS) {
      pendingStress = 2;
      i += 1;
      continue;
    }
    if (char === "." || /\s/.test(char)) {
      i += 1;
      continue;
    }

    const matched = matchIpaToken(cleaned, i);
    if (!matched) {
      i += 1;
      continue;
    }

    phonemes.push(matched.arpabet);
    if (isArpabetVowel(matched.arpabet)) {
      stressPattern.push(pendingStress);
      pendingStress = 0;
    } else {
      stressPattern.push(null);
    }
    i += matched.length;
  }

  if (phonemes.length === 0) return null;
  return { text, phonemes, stressPattern, source: "ipa" };
}

function matchIpaToken(input: string, offset: number): { arpabet: string; length: number } | null {
  for (const length of [3, 2, 1]) {
    const slice = input.slice(offset, offset + length);
    if (slice.length !== length) continue;
    const arpabet = normalizeAcousticLabel(slice);
    if (arpabet && arpabet !== "<blank>") return { arpabet, length };
  }
  return null;
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
