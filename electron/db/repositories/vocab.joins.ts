/**
 * Single-query child hydration for vocab entries.
 *
 * Why this exists:
 *   The naive hydration path ran 5 separate prepared statements (one per
 *   child table). Each one cost a round trip through the SQLite VM —
 *   small individually but compounding when a lesson opens 200+ entries
 *   on a 4GB / 1 GHz target device.
 *
 *   This module replaces that with a single `UNION ALL` query that
 *   normalises every child row into `(entry_id, kind, payload_json)`.
 *   The query plan stays index-bound (each branch uses its
 *   `entry_*_idx`), and only one statement crosses the C++ boundary.
 *
 * Output: a `VocabChildBundle` keyed by entry id, ready to splice onto
 * `VocabEntry` rows. The caller composes the final `VocabEntryFull` —
 * this module makes no assumption about how children get attached.
 */

import type {
  CollocationPattern,
  VocabFormKind,
  VocabRegister,
  VocabRelationKind,
} from "../../../src/data/schema";
import type {
  VocabCollocation,
  VocabExample,
  VocabForm,
  VocabRelation,
  VocabSense,
} from "../../../src/data/types";
import type { AppDatabase } from "../client";

export interface VocabChildBundle {
  senses: VocabSense[];
  examples: VocabExample[];
  forms: VocabForm[];
  collocations: VocabCollocation[];
  relations: VocabRelation[];
}

type ChildKind = "sense" | "example" | "form" | "collocation" | "relation";

interface RawRow {
  entry_id: number;
  kind: ChildKind;
  payload: string; // JSON
}

/**
 * Build a SQL clause `(?, ?, ?, …)` for the given ids. Returns the
 * placeholder block and a flat parameter array. Each branch of the
 * UNION ALL reuses the *same* id list, so we splice the placeholder
 * block five times and pass the params five times.
 *
 * SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 32766 in modern builds;
 * 5 × 200 = 1000 is well under the cap.
 */
function buildPlaceholders(ids: ReadonlyArray<number>): string {
  return ids.map(() => "?").join(", ");
}

/**
 * Fetch every child row for the given entry ids in a single SQL round
 * trip and group them by parent. Empty input short-circuits.
 */
export function hydrateChildrenSingleQuery(
  db: AppDatabase,
  entryIds: ReadonlyArray<number>,
): Map<number, VocabChildBundle> {
  const bundles = new Map<number, VocabChildBundle>();
  if (entryIds.length === 0) return bundles;

  const placeholders = buildPlaceholders(entryIds);
  // Note: json_object() is built into SQLite ≥ 3.38; better-sqlite3 ships
  // its own SQLite, currently 3.46+, so this is guaranteed available.
  const sql = `
    SELECT entry_id, 'sense' AS kind, json_object(
      'id', id,
      'entryId', entry_id,
      'ordinal', ordinal,
      'definitionEn', definition_en,
      'definitionVi', definition_vi,
      'register', register,
      'domain', domain,
      'notesMd', notes_md
    ) AS payload
    FROM vocab_senses WHERE entry_id IN (${placeholders})
    UNION ALL
    SELECT entry_id, 'example', json_object(
      'id', id,
      'entryId', entry_id,
      'senseId', sense_id,
      'ordinal', ordinal,
      'text', text,
      'translation', translation,
      'clozeTarget', cloze_target,
      'clozeHint', cloze_hint,
      'audioRef', audio_ref,
      'sourceRef', source_ref
    )
    FROM vocab_examples WHERE entry_id IN (${placeholders})
    UNION ALL
    SELECT entry_id, 'form', json_object(
      'id', id,
      'entryId', entry_id,
      'kind', kind,
      'formText', form_text,
      'ipa', ipa
    )
    FROM vocab_forms WHERE entry_id IN (${placeholders})
    UNION ALL
    SELECT entry_id, 'collocation', json_object(
      'id', id,
      'entryId', entry_id,
      'collocation', collocation,
      'pattern', pattern,
      'exampleText', example_text,
      'notesMd', notes_md
    )
    FROM vocab_collocations WHERE entry_id IN (${placeholders})
    UNION ALL
    SELECT entry_id, 'relation', json_object(
      'id', id,
      'entryId', entry_id,
      'relatedEntryId', related_entry_id,
      'relatedText', related_text,
      'relation', relation
    )
    FROM vocab_relations WHERE entry_id IN (${placeholders})
    ORDER BY entry_id, kind
  `;

  const params: number[] = [];
  for (let i = 0; i < 5; i++) params.push(...entryIds);

  const rows = db.$sqlite.prepare(sql).all(...params) as RawRow[];

  for (const id of entryIds) {
    bundles.set(id, { senses: [], examples: [], forms: [], collocations: [], relations: [] });
  }
  for (const row of rows) {
    const bundle = bundles.get(row.entry_id);
    if (!bundle) continue;
    const parsed = JSON.parse(row.payload);
    switch (row.kind) {
      case "sense":
        bundle.senses.push(parsed as VocabSense);
        break;
      case "example":
        bundle.examples.push(parsed as VocabExample);
        break;
      case "form":
        bundle.forms.push({
          ...parsed,
          kind: parsed.kind as VocabFormKind,
        } as VocabForm);
        break;
      case "collocation":
        bundle.collocations.push({
          ...parsed,
          pattern: parsed.pattern as CollocationPattern | null,
        } as VocabCollocation);
        break;
      case "relation":
        bundle.relations.push({
          ...parsed,
          relation: parsed.relation as VocabRelationKind,
        } as VocabRelation);
        break;
    }
  }

  // Restore the in-table ordering (senses/examples/forms have an
  // `ordinal` column; the others fall back to insertion order via id).
  for (const bundle of bundles.values()) {
    bundle.senses.sort((a, b) => a.ordinal - b.ordinal || a.id - b.id);
    bundle.examples.sort((a, b) => a.ordinal - b.ordinal || a.id - b.id);
    bundle.forms.sort((a, b) => a.id - b.id);
    bundle.collocations.sort((a, b) => a.id - b.id);
    bundle.relations.sort((a, b) => a.id - b.id);
  }

  // Hint to assistive type-narrowing — `register` is a nullable enum
  // already on `VocabSense`, but JSON parse widens it to string. The
  // shape match is intentional, no runtime cast needed beyond what we
  // already did per kind.
  void (null as unknown as VocabRegister | null);
  return bundles;
}
