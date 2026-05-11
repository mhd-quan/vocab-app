import { type ParsedGrammarFile, parseGrammarFile } from "./grammar.parse";
import { type ParsedVocabFile, parseVocabFile } from "./vocab.parse";

export type ParsedContentFile =
  | { kind: "vocabulary"; file: ParsedVocabFile }
  | { kind: "grammar"; file: ParsedGrammarFile };

export function parseContentFile(rawData: unknown): ParsedContentFile {
  const kind = readLessonKind(rawData);
  if (kind === "grammar") {
    return { kind, file: parseGrammarFile(rawData) };
  }
  return { kind: "vocabulary", file: parseVocabFile(rawData) };
}

function readLessonKind(rawData: unknown): unknown {
  if (!rawData || typeof rawData !== "object") return undefined;
  const lesson = (rawData as { lesson?: unknown }).lesson;
  if (!lesson || typeof lesson !== "object") return undefined;
  return (lesson as { kind?: unknown }).kind;
}
