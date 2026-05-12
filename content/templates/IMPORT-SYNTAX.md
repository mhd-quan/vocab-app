# Import Syntax Reference

This reference describes the YAML syntax accepted by the current importer.
Files can be imported from the app or via `npm run import`.

## File Names

Use these suffixes so directory imports can discover files:

- Vocabulary: `*-vocab.yaml` or `*-vocab.yml`
- Grammar: `*-grammar.yaml` or `*-grammar.yml`

The in-app importer accepts any `.yaml` or `.yml` file, then routes by
`lesson.kind`.

Current import-backed lesson kinds are `vocabulary` and `grammar`. The
database enum also reserves `mixed`, `reading`, `listening`, `revision`,
`exercise`, and `exam_practice`, but those kinds do not have concrete import
parsers or student-runtime screens yet. For v0.5.x, author revision/exercise
practice as `lesson.kind: grammar` with `topics[].activities`.

## Shared Header

Both vocab and grammar files share the same top-level curriculum shape:

```yaml
book: sample-b1
book_title: Sample B1 Authoring Pack
unit:
  ordinal: 1
  code: U01
  title: Unit title
  summary_md: Optional markdown summary.
  metadata:
    source: optional metadata
lesson:
  ordinal: 1
  kind: vocabulary # or grammar
  title: Lesson title
  slug: lowercase-kebab-slug
  metadata:
    authoring_notes: optional metadata
```

Rules:

- `book` is the stable book code.
- `book_title` is optional. If omitted, the importer preserves the existing
  edited title or derives one from `book`.
- `unit.ordinal` and `lesson.ordinal` are positive integers.
- `lesson.slug` must be lowercase kebab case: `present-simple`.
- `unit.metadata` and `lesson.metadata` are optional JSON objects persisted
  with the curriculum rows. Keep learner-facing text in `title` or
  `summary_md`; use metadata for authoring hints, source tags, and workflow
  notes.
- Re-importing an unchanged file is skipped by file hash.
- Entries/topics are matched inside a lesson by stable `id`.

## Templates

Use the full templates when checking the entire accepted field surface:

- `vocab-template.yaml`
- `grammar-template.yaml`

Use the focused starters when building actual lesson content:

- `vocab-study-page-template.yaml` shows how to seed a vocabulary lesson so
  the student Unit Study page can split cards into core vocabulary, phrasal
  verbs, phrases/collocations, word patterns, and word formation.
- `revision-practice-grammar-template.yaml` shows the current import-safe
  way to create exercise/revision sessions through grammar activities.

## Vocabulary Files

Vocabulary files require `lesson.kind: vocabulary` and an `entries` array.

Required entry fields:

- `headword`
- `pos`

Optional entry fields:

- `id`
- `lemma`
- `ipa`
- `cefr`
- `frequency_rank`
- `image_ref`
- `audio_ref`
- `tags`
- `metadata`
- `senses`
- `examples`
- `forms`
- `collocations`
- `relations`

Accepted `pos` values:

`noun`, `verb`, `adjective`, `adverb`, `phrase`, `idiom`,
`phrasal_verb`, `collocation`, `pattern`, `determiner`, `preposition`,
`conjunction`, `pronoun`, `interjection`, `article`, `auxiliary`, `modal`,
`number`, `abbreviation`, `prefix`, `suffix`, `root`

Rules:

- Use canonical enum values exactly as written above.
- Do not use legacy aliases such as `adj`, `adv`, `phrasal verb`,
  `adj/verb`, or `verb/noun`.
- For entries that can belong to more than one part of speech, choose the
  primary card type and store the rest in `metadata.related_forms` or as
  separate entries.
- Use `pattern` for word-pattern cards such as `inform sb about sth`,
  `believe in sth`, or `surprised at sth`.

Accepted `cefr` values:

`A1`, `A2`, `B1`, `B2`, `C1`, `C2`

### Senses

Each sense must include at least one of `definition_en` or `definition_vi`.

```yaml
senses:
  - definition_en: correct and true in every detail
    definition_vi: chính xác
    register: academic
    domain: education
    notes_md: Optional markdown note.
```

Accepted `register` values:

`formal`, `informal`, `neutral`, `slang`, `academic`, `technical`,
`literary`

### Examples And Cloze

```yaml
examples:
  - text: Passing the exam was a real {{achievement}}.
    translation: Vượt qua kỳ thi là một thành tựu thật sự.
    cloze_hint: a__________
    audio_ref: audio/examples/achievement-01.mp3
    source_ref: teacher-made
```

Rules:

- One or more `{{cloze}}` markers are supported per example.
- `cloze_target` is optional and inferred from `{{...}}`.
- If multiple markers are present, the inferred `cloze_target` joins them with
  spaces, e.g. `{{look}} it {{up}}` becomes `look up`.
- If both marker text and `cloze_target` are present, `cloze_target` must
  exactly match the inferred target.

### Forms

```yaml
forms:
  - kind: past
    text: adapted
    ipa: /əˈdæptɪd/
  - kind: noun
    text: adaptation
```

Accepted `kind` values:

`plural`, `past`, `past_participle`, `gerund`, `third_person`,
`comparative`, `superlative`, `infinitive`, `noun`, `verb`, `adjective`,
`adverb`, `opposite`, `prefix`, `suffix`, `root`, `compound`, `derivative`

Rules:

- Prefer `text`. The importer also accepts legacy `form` and normalizes it to
  `text`.
- Use inflectional kinds for tenses/plurals/comparison.
- Use `noun`, `verb`, `adjective`, `adverb`, `opposite`, `prefix`, `suffix`,
  `root`, `compound`, or `derivative` when the entry is a word-formation card.

### Word Formation Metadata

Word-formation notes are accepted through `metadata.related_forms`. This keeps
the entry compatible with the current importer while preserving the word-family
teaching data.

```yaml
metadata:
  related_forms:
    - form: adaptation
      pos: noun
    - form: adaptable
      pos: adjective
    - form: adaptably
      pos: adverb
```

Rules:

- Use `form`, not `text`, inside `metadata.related_forms`.
- `pos` inside `metadata.related_forms` is teaching metadata, but keep it
  canonical when possible: `noun`, `verb`, `adjective`, `adverb`,
  `phrasal_verb`, `phrase`.
- This metadata is imported into the entry's JSON metadata; it does not create
  separate vocab cards unless you add those as separate `entries`.

### Collocations

```yaml
collocations:
  - collocation: adapt to change
    pattern: verb+prep
    example: Good learners adapt to change.
    notes_md: Optional markdown note.
  - collocation: under pressure
    pattern: prep+noun
```

Accepted `pattern` values:

`verb+noun`, `adj+noun`, `noun+noun`, `verb+prep`, `adj+prep`,
`noun+prep`, `prep+noun`, `verb+object+prep`,
`verb+object+infinitive`, `verb+object+bare_infinitive`, `verb+gerund`,
`verb+infinitive`, `adj+infinitive`, `adj+that_clause`, `noun+of+noun`,
`be+adj+prep`, `adv+adj`, `adv+verb`, `other`

### Relations

```yaml
relations:
  - relation: synonym
    text: accomplishment
```

Accepted `relation` values:

`synonym`, `antonym`, `see_also`, `derived_from`, `confused_with`,
`false_friend`, `hypernym`, `hyponym`, `word_family`, `topic_family`,
`variant`, `prefix_of`, `suffix_of`

### Study Section Tags

The student unit screen can filter practice by section. Use these canonical
tags where possible:

- Core vocabulary: `vocabulary`
- Phrasal verbs: `phrasal-verb` or `phrasal_verb`; `pos: phrasal_verb` also
  counts.
- Phrases & collocations: `collocation`, `phrase`, or
  `phrases-collocations`; `pos: phrase`, `idiom`, or `collocation` also
  counts.
- Word patterns: `word-pattern` or `word_pattern`; `pos: pattern` also
  counts.
- Word formation: `word-formation` or a non-empty `metadata.related_forms`
  array.

## Grammar Files

Grammar files require `lesson.kind: grammar` and a `topics` array.

Required topic fields:

- `slug`
- `title`

Optional topic fields:

- `id`
- `summary_md`
- `explanation_md`
- `difficulty`
- `estimated_minutes`
- `tags`
- `objectives`
- `prerequisites`
- `teacher_notes`
- `contrast_notes`
- `exam_notes`
- `patterns`
- `examples`
- `common_mistakes`
- `checks`
- `activities`
- `metadata`

Rules:

- `id` must match `[a-z0-9][a-z0-9_-]*`.
- `slug` must be lowercase kebab case.
- `difficulty` is an integer from `1` to `5`.
- `estimated_minutes` is a positive integer.
- `patterns`, `examples`, `common_mistakes`, `checks`, and `activities` are
  stored in topic metadata. Student grammar practice is built from
  `activities`; legacy `checks` are used as simple rewrite exercises if a
  topic has no activities.

### Grammar Patterns

```yaml
patterns:
  - label: affirmative
    form: subject + am/is/are + verb-ing
    use: Actions happening now.
    examples:
      - I am reading a new book now.
```

Required: `form`

Optional: `label`, `use`, `examples`

### Grammar Examples

```yaml
examples:
  - text: She studies English every evening.
    translation: Cô ấy học tiếng Anh mỗi tối.
    explanation: A repeated routine.
    correct: true
    note: Optional authoring note.
```

Required: `text`

Optional: `translation`, `explanation`, `correct`, `note`

### Common Mistakes

```yaml
common_mistakes:
  - wrong: She study English every evening.
    correct: She studies English every evening.
    note: Add -s or -es for he/she/it.
```

Required: `wrong`, `correct`

Optional: `note`

### Checks

```yaml
checks:
  - prompt: "Rewrite with he: I watch TV after dinner."
    answer: He watches TV after dinner.
    explanation: watch becomes watches after he.
```

Required: `prompt`, `answer`

Optional: `explanation`

### Grammar Activities

Use `activities` to create the interactive grammar deck for students. A
15-30 question session is assembled from the activities in the lesson's
topics.

Shared optional fields:

- `id`
- `prompt`
- `instruction`
- `hint`
- `explanation`
- `tags`
- `source_ref`
- `points`
- `metadata`

Supported `kind` values:

- `fill_blank`
- `choice`
- `order`
- `rewrite`
- `prompted_sentence`
- `error_correction`

#### fill_blank

```yaml
activities:
  - kind: fill_blank
    sentence: She {{goes}} to school every day.
    hint: he/she/it takes -s in present simple.
    explanation: Use goes after she.
```

Rules:

- Either mark one answer in `sentence` with `{{...}}`, or provide `answer`.
- `accepted_answers` can add alternate correct answers.

#### choice

```yaml
activities:
  - kind: choice
    question: He usually ___ at 7.
    options:
      - text: go
      - text: goes
        correct: true
      - text: is going
```

Rules:

- Provide at least two `options`.
- Mark one or more options with `correct: true`, or provide `answer`.

#### order

```yaml
activities:
  - kind: order
    prompt: Put the words in order.
    tokens: [He, does, not, like, coffee]
    answer: He does not like coffee.
```

#### rewrite

```yaml
activities:
  - kind: rewrite
    prompt: I watch TV after dinner.
    instruction: Rewrite with he.
    answer: He watches TV after dinner.
```

#### prompted_sentence

```yaml
activities:
  - kind: prompted_sentence
    instruction: Write a present continuous sentence.
    words: [she, write, now]
    answer: She is writing now.
```

#### error_correction

```yaml
activities:
  - kind: error_correction
    sentence: She go to school every day.
    answer: She goes to school every day.
    explanation: Add -s after she in present simple.
```

For text-graded activities, matching is case-insensitive, collapses repeated
spaces, and ignores final sentence punctuation. Keep expected answers natural
and add `accepted_answers` when more than one sentence is valid.

## Current Exercise Support

Student practice currently builds these exercise types:

- `flashcard`
- `multiple_choice`
- `grammar_fill_blank`
- `grammar_choice`
- `grammar_order`
- `grammar_rewrite`
- `grammar_prompted_sentence`
- `grammar_error_correction`
