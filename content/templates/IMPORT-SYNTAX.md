# Import Syntax Reference

This reference describes the YAML syntax accepted by the current importer.
Files can be imported from the app or via `npm run import`.

## File Names

Use these suffixes so directory imports can discover files:

- Vocabulary: `*-vocab.yaml` or `*-vocab.yml`
- Grammar: `*-grammar.yaml` or `*-grammar.yml`

The in-app importer accepts any `.yaml` or `.yml` file, then routes by
`lesson.kind`.

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
lesson:
  ordinal: 1
  kind: vocabulary # or grammar
  title: Lesson title
  slug: lowercase-kebab-slug
```

Rules:

- `book` is the stable book code.
- `book_title` is optional. If omitted, the importer preserves the existing
  edited title or derives one from `book`.
- `unit.ordinal` and `lesson.ordinal` are positive integers.
- `lesson.slug` must be lowercase kebab case: `present-simple`.
- Re-importing an unchanged file is skipped by file hash.
- Entries/topics are matched inside a lesson by stable `id`.

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
`phrasal_verb`, `collocation`, `determiner`, `preposition`,
`conjunction`, `pronoun`, `interjection`

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

`formal`, `informal`, `neutral`, `slang`, `academic`

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

- One `{{cloze}}` marker is supported per example.
- `cloze_target` is optional and inferred from `{{...}}`.
- If both are present, `cloze_target` must exactly match the marker text.

### Forms

```yaml
forms:
  - kind: past
    text: adapted
    ipa: /əˈdæptɪd/
```

Accepted `kind` values:

`plural`, `past`, `past_participle`, `gerund`, `third_person`,
`comparative`, `superlative`, `infinitive`

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
`noun+prep`, `prep+noun`, `adv+adj`, `adv+verb`, `other`

### Relations

```yaml
relations:
  - relation: synonym
    text: accomplishment
```

Accepted `relation` values:

`synonym`, `antonym`, `see_also`, `derived_from`, `confused_with`,
`hypernym`, `hyponym`

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
- `tags`
- `patterns`
- `examples`
- `common_mistakes`
- `checks`
- `metadata`

Rules:

- `id` must match `[a-z0-9][a-z0-9_-]*`.
- `slug` must be lowercase kebab case.
- `difficulty` is an integer from `1` to `5`.
- `patterns`, `examples`, `common_mistakes`, and `checks` are stored in the
  topic metadata and rendered in the Content browser.

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

## Current Exercise Support

Student practice currently builds exercises from vocabulary entries:

- `flashcard`
- `multiple_choice`

Grammar topics import and render in the tutor Content browser. Grammar-specific
student exercises can be added later without changing the YAML curriculum
header or topic ids.
