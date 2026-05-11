# Exercise Reference

This reference describes the current exercise data requirements and planned grading rules.

## Current Types

### flashcard

- Purpose: show a word and let the student self-grade recall.
- YAML requirements: a vocab entry with `headword`; definitions and examples improve the card but are not mandatory.
- Example:

```yaml
entries:
  - id: relative-noun
    headword: relative
    pos: noun
    senses:
      - definition_en: a member of your family
```

- Grading: student chooses Again, Hard, Good, or Easy; the answer is mapped to SM-2 quality.

### multiple_choice

- Purpose: choose the matching headword for a definition prompt.
- YAML requirements: a vocab entry with at least one English or Vietnamese definition; the lesson needs enough other entries to build distractors.
- Example:

```yaml
entries:
  - id: accurate-adjective
    headword: accurate
    pos: adjective
    senses:
      - definition_en: correct and true in every detail
```

- Grading: exact option index match; correct answers advance SRS, wrong answers are scheduled sooner.

## Planned Types

### fill_blank

- YAML requirements: an example with `{{cloze}}` in `examples[].text`; optional `cloze_hint`.
- Example:

```yaml
examples:
  - text: Passing the exam was a real {{achievement}}.
    cloze_hint: a__________
```

- Grading: normalized text match against `cloze_target`.

### matching

- YAML requirements: multiple entries with headwords and definitions.
- Example:

```yaml
entries:
  - { id: adapt-verb, headword: adapt, pos: verb, senses: [{ definition_en: to change for a new situation }] }
  - { id: accurate-adjective, headword: accurate, pos: adjective, senses: [{ definition_en: correct in every detail }] }
```

- Grading: all pairs must match their source entry ids.

### ordering

- YAML requirements: an example sentence that can be tokenized into an ordered sequence.
- Example:

```yaml
examples:
  - text: New students need time to adapt to the course.
```

- Grading: token order is compared after punctuation normalization.

### translation

- YAML requirements: bilingual definitions or examples with `translation`.
- Example:

```yaml
examples:
  - text: You should {{look up}} any word you do not know.
    translation: Bạn nên tra cứu bất kỳ từ nào bạn không biết.
```

- Grading: manual/self-grade first; later versions can add accepted answers.

### dictation

- YAML requirements: `audio_ref` on an entry or example, plus target text.
- Example:

```yaml
audio_ref: audio/achievement.mp3
examples:
  - text: Passing the exam was a real achievement.
    audio_ref: audio/examples/achievement-01.mp3
```

- Grading: normalized transcript match against target text, with typo tolerance planned.
