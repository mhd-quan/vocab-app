import { cn } from "@/lib/cn";

export interface ClozeTextProps {
  text: string;
  /** Visual style: `highlight` (default) shows the word, `mask` blanks it. */
  mode?: "highlight" | "mask";
  className?: string;
}

const CLOZE_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

interface Segment {
  text: string;
  cloze: boolean;
}

/**
 * Render a sentence whose cloze targets are wrapped in `{{...}}` markers
 * (the YAML import preserves these in `vocab_examples.text`). The author
 * can target one cloze per example; multiple markers degrade gracefully —
 * each is rendered, but our import pipeline rejects multi-marker examples.
 */
export function ClozeText({ text, mode = "highlight", className }: ClozeTextProps) {
  const segments = parseSegments(text);
  return (
    <span className={cn("leading-relaxed", className)}>
      {segments.map((seg, i) =>
        seg.cloze ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional render
            key={`c-${i}`}
            data-cloze="true"
            className={cn(
              "rounded px-1 font-medium",
              mode === "mask"
                ? "bg-accent/30 text-transparent select-none [letter-spacing:0.5em]"
                : "bg-accent/15 text-accent",
            )}
          >
            {mode === "mask" ? "_".repeat(Math.max(seg.text.length, 3)) : seg.text}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional render
          <span key={`t-${i}`}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CLOZE_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), cloze: false });
    }
    segments.push({ text: match[1]?.trim() ?? "", cloze: true });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), cloze: false });
  }
  if (segments.length === 0) {
    segments.push({ text, cloze: false });
  }
  return segments;
}
