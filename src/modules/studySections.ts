export const vocabStudySections = [
  {
    id: "vocabulary",
    label: "Vocabulary",
    description: "Core topic words and contrast pairs.",
    tone: "xp",
  },
  {
    id: "phrasal_verbs",
    label: "Phrasal verbs",
    description: "Verb + particle patterns students must recall as a unit.",
    tone: "focus",
  },
  {
    id: "phrases_collocations",
    label: "Phrases & collocations",
    description: "Fixed phrases, idioms, and natural word partnerships.",
    tone: "rare",
  },
  {
    id: "word_patterns",
    label: "Word patterns",
    description: "Preposition, infinitive, gerund, and clause patterns.",
    tone: "sky",
  },
  {
    id: "word_formation",
    label: "Word formation",
    description: "Word families, prefixes, suffixes, and derived forms.",
    tone: "mastery",
  },
] as const;

export type VocabStudySectionId = (typeof vocabStudySections)[number]["id"];

export interface VocabSectionEntry {
  pos: string;
  tags: string[] | null;
  metadata?: Record<string, unknown> | null;
}

const SECTION_IDS = new Set<VocabStudySectionId>(vocabStudySections.map((section) => section.id));

export function isVocabStudySectionId(value: string): value is VocabStudySectionId {
  return SECTION_IDS.has(value as VocabStudySectionId);
}

export function parseStudySectionParam(value: unknown): VocabStudySectionId[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(isVocabStudySectionId);
}

export function encodeStudySectionParam(sections: VocabStudySectionId[]): string {
  return [...new Set(sections)].filter(isVocabStudySectionId).join(",");
}

export function classifyVocabEntry(entry: VocabSectionEntry): VocabStudySectionId[] {
  const tags = new Set((entry.tags ?? []).map(normalizeToken));
  const pos = normalizeToken(entry.pos);
  const sections = new Set<VocabStudySectionId>();

  if (pos === "phrasal-verb" || tags.has("phrasal-verb")) {
    sections.add("phrasal_verbs");
  }

  if (
    pos === "collocation" ||
    pos === "phrase" ||
    pos === "idiom" ||
    tags.has("collocation") ||
    tags.has("phrase") ||
    tags.has("phrases-collocations")
  ) {
    sections.add("phrases_collocations");
  }

  if (pos === "pattern" || tags.has("word-pattern") || tags.has("pattern")) {
    sections.add("word_patterns");
  }

  if (tags.has("word-formation") || hasRelatedForms(entry.metadata)) {
    sections.add("word_formation");
  }

  if (sections.size === 0) sections.add("vocabulary");
  return [...sections];
}

export function filterVocabEntriesBySections<T extends VocabSectionEntry>(
  entries: T[],
  sections: VocabStudySectionId[],
): T[] {
  const selected = new Set(sections);
  if (selected.size === 0) return entries;
  return entries.filter((entry) =>
    classifyVocabEntry(entry).some((section) => selected.has(section)),
  );
}

export function countVocabSections(
  entries: VocabSectionEntry[],
): Record<VocabStudySectionId, number> {
  const counts = Object.fromEntries(vocabStudySections.map((section) => [section.id, 0])) as Record<
    VocabStudySectionId,
    number
  >;

  for (const entry of entries) {
    for (const section of classifyVocabEntry(entry)) {
      counts[section] += 1;
    }
  }
  return counts;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function hasRelatedForms(metadata: Record<string, unknown> | null | undefined): boolean {
  const related = metadata?.related_forms;
  return Array.isArray(related) && related.length > 0;
}
