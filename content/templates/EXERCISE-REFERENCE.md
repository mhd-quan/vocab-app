# Exercise Reference

This reference describes the current exercise data requirements and grading rules.

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

### grammar_fill_blank

- Purpose: type the missing grammar form inside a sentence.
- YAML requirements: grammar topic `activities` with `kind: fill_blank`.
- Example:

```yaml
activities:
  - kind: fill_blank
    sentence: She {{goes}} to school every day.
    hint: he/she/it takes -s.
```

- Grading: normalized text match against the marked answer, `answer`, and `accepted_answers`.

### grammar_choice

- Purpose: choose the correct tense, form, preposition, connector, or word order option.
- YAML requirements: `kind: choice` with at least two options and one correct option or `answer`.
- Example:

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

- Grading: selected option index maps to an option marked `correct: true`.

### grammar_order

- Purpose: arrange words into the target sentence.
- YAML requirements: `kind: order`, `tokens`, and `answer`.
- Example:

```yaml
activities:
  - kind: order
    tokens: [He, does, not, like, coffee]
    answer: He does not like coffee.
```

- Grading: selected tokens are joined and normalized against `answer` and `accepted_answers`.

### grammar_rewrite

- Purpose: transform a sentence according to a rule.
- YAML requirements: `kind: rewrite`, `prompt`, `instruction`, and `answer`.
- Example:

```yaml
activities:
  - kind: rewrite
    prompt: I watch TV after dinner.
    instruction: Rewrite with he.
    answer: He watches TV after dinner.
```

- Grading: normalized text match against `answer` and `accepted_answers`.

### grammar_prompted_sentence

- Purpose: write a sentence from required words or structures.
- YAML requirements: `kind: prompted_sentence`, `instruction`, `words`, and `answer`.
- Example:

```yaml
activities:
  - kind: prompted_sentence
    instruction: Write a present continuous sentence.
    words: [she, write, now]
    answer: She is writing now.
```

- Grading: normalized text match against `answer` and `accepted_answers`.

### grammar_error_correction

- Purpose: correct a sentence that contains a grammar error.
- YAML requirements: `kind: error_correction`, `sentence`, and `answer`.
- Example:

```yaml
activities:
  - kind: error_correction
    sentence: She go to school every day.
    answer: She goes to school every day.
```

- Grading: normalized text match against `answer` and `accepted_answers`.

## Planned Types

### matching

- YAML requirements: multiple entries with headwords and definitions.
- Example:

```yaml
entries:
  - { id: adapt-verb, headword: adapt, pos: verb, senses: [{ definition_en: to change for a new situation }] }
  - { id: accurate-adjective, headword: accurate, pos: adjective, senses: [{ definition_en: correct in every detail }] }
```

- Grading: all pairs must match their source entry ids.

### translation

- YAML requirements: bilingual definitions or examples with `translation`.
- For phrasal verbs, keep `pos: phrasal_verb` and mark the full target phrase
  in one cloze marker.
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
