export { flashcardPlugin } from "./flashcard";
export { multipleChoicePlugin } from "./multipleChoice";
export { audioRecallPlugin, normaliseSpelling } from "./audioRecall";
export { definitionMatchPlugin } from "./definitionMatch";
export { sentenceRebuildPlugin, tokenise } from "./sentenceRebuild";
export { fromDictionaryItem, fromVocabEntry, sourceKey } from "./sources";
export {
  type BuildDeckOptions,
  type BuildDeckResult,
  buildDeck,
  createLazyDeck,
  defaultSessionSeed,
  getPlugin,
  gradeExercise,
} from "./engine";
export type { LazyDeck, LazyBuildOptions, SkipRecord } from "./engine";
export {
  cyrb53,
  mulberry32,
  rngFromSeed,
  sampleWithoutReplacement,
  shuffle,
} from "./random";
export type {
  Answer,
  AnyExercisePlugin,
  AudioRecallExercise,
  AudioRecallPayload,
  BuildContext,
  DefinitionMatchExercise,
  DefinitionMatchItem,
  DefinitionMatchPayload,
  DefinitionPriority,
  Exercise,
  ExerciseBase,
  ExerciseKind,
  ExercisePlugin,
  ExerciseSource,
  ExerciseSourceExample,
  ExerciseSourceRef,
  ExerciseSourceSense,
  ExerciseTrack,
  FlashcardExercise,
  FlashcardPayload,
  GradeOutcome,
  MultipleChoiceExercise,
  MultipleChoiceOption,
  MultipleChoicePayload,
  SelfGrade,
  SentenceRebuildExercise,
  SentenceRebuildPayload,
} from "./types";
export { selfGrades } from "./types";
