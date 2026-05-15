import type {
  DictionaryAudioRef,
  DictionaryEntry,
  DictionarySense,
} from "../../src/data/dictionary";
import {
  type CefrLevel,
  type PartOfSpeech,
  cefrLevels,
  partsOfSpeech,
} from "../../src/data/schema";

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function parseDictionaryRecordHtml(
  key: string,
  html: string,
  sourceFile: string,
): DictionaryEntry {
  const headword = firstText(html, "headword") ?? firstText(html, "pv") ?? key;
  const posLabel = firstText(html, "pos");
  const posKey = normalizePartOfSpeech(posLabel);
  const ipaUk = firstTextFromContainer(html, "phons_br", "phon") ?? null;
  const ipaUs = firstTextFromContainer(html, "phons_n_am", "phon") ?? null;
  const cefr = extractCefr(html);
  const labels = uniqueText(extractTexts(html, "labels"));
  const senses = extractSenses(html);
  const examples = uniqueText(
    senses.flatMap((sense) => sense.examples).concat(extractTexts(html, "x")),
  ).slice(0, 12);
  const audio = extractAudioRefs(html);

  return {
    key,
    headword,
    posLabel,
    posKey,
    ipaUk,
    ipaUs,
    cefr,
    labels,
    senses,
    examples,
    audio,
    source: {
      dictionary: "oald10",
      file: sourceFile,
    },
  };
}

function extractSenses(html: string): DictionarySense[] {
  const senseBlocks = extractElementsByClass(html, "sense");
  const parsed = senseBlocks
    .map((block) => {
      const definitionEn = firstText(block, "def");
      if (!definitionEn) return null;
      return {
        definitionEn,
        labels: uniqueText(extractTexts(block, "labels")),
        examples: uniqueText(extractTexts(block, "x")).slice(0, 4),
      };
    })
    .filter((sense): sense is DictionarySense => sense !== null);

  if (parsed.length > 0) return parsed;

  return uniqueText(extractTexts(html, "def")).map((definitionEn) => ({
    definitionEn,
    labels: [],
    examples: [],
  }));
}

function extractAudioRefs(html: string): DictionaryAudioRef[] {
  const seen = new Set<string>();
  const refs: DictionaryAudioRef[] = [];
  for (const match of html.matchAll(/href=["']sound:\/\/([^"']+)["']/gi)) {
    const file = decodeHtml(match[1] ?? "").trim();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const accent =
      file.includes("__gb_") || file.includes("_gb_")
        ? "uk"
        : file.includes("__us_") || file.includes("_us_")
          ? "us"
          : "other";
    refs.push({
      ref: `sound://${file}`,
      label: accent === "uk" ? "UK" : accent === "us" ? "US" : "Audio",
      accent,
    });
  }
  return refs;
}

function extractCefr(html: string): CefrLevel | null {
  for (const match of html.matchAll(/entry:\/\/@ox3000&level=([a-c][12])/gi)) {
    const level = match[1]?.toUpperCase();
    if (cefrLevels.includes(level as CefrLevel)) return level as CefrLevel;
  }
  return null;
}

function normalizePartOfSpeech(value: string | null): PartOfSpeech {
  const normalized = (value ?? "")
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const mapped =
    normalized === "phrasal_verb" || normalized === "phrasal_verbs"
      ? "phrasal_verb"
      : normalized === "modal_verb"
        ? "modal"
        : normalized === "exclamation"
          ? "interjection"
          : normalized;

  return partsOfSpeech.includes(mapped as PartOfSpeech) ? (mapped as PartOfSpeech) : "phrase";
}

function firstText(html: string, className: string): string | null {
  return extractTexts(html, className)[0] ?? null;
}

function firstTextFromContainer(
  html: string,
  containerClass: string,
  childClass: string,
): string | null {
  for (const block of extractElementsByClass(html, containerClass)) {
    const text = firstText(block, childClass);
    if (text) return text;
  }
  return null;
}

function extractTexts(html: string, className: string): string[] {
  return uniqueText(extractElementsByClass(html, className).map(toText).filter(Boolean));
}

function extractElementsByClass(html: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startTag = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\bclass=["'][^"']*\\b${escaped}\\b[^"']*["'])[^>]*>`,
    "gi",
  );
  const out: string[] = [];
  let match = startTag.exec(html);

  while (match !== null) {
    const tag = match[1];
    if (tag) {
      const start = match.index + match[0].length;
      const end = findMatchingEnd(html, tag, start);
      if (end > start) {
        out.push(html.slice(start, end));
        startTag.lastIndex = end;
      }
    }
    match = startTag.exec(html);
  }

  return out;
}

function findMatchingEnd(html: string, tag: string, from: number): number {
  const tagPattern = new RegExp(`</?${tag}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = from;
  let depth = 1;
  let match = tagPattern.exec(html);
  while (match !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return match.index;
    } else if (!match[0].endsWith("/>")) {
      depth += 1;
    }
    match = tagPattern.exec(html);
  }
  return html.length;
}

function toText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    return ENTITY_MAP[body.toLowerCase()] ?? entity;
  });
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
