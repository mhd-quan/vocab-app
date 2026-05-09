import type {
  appSettings,
  books,
  contentItems,
  enrollments,
  grammarTopics,
  importItems,
  importRuns,
  itemProgress,
  learningEvents,
  lessons,
  practiceSessions,
  students,
  units,
  vocabCollocations,
  vocabEntries,
  vocabExamples,
  vocabForms,
  vocabRelations,
  vocabSenses,
} from "./schema";

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type VocabEntry = typeof vocabEntries.$inferSelect;
export type NewVocabEntry = typeof vocabEntries.$inferInsert;
export type VocabSense = typeof vocabSenses.$inferSelect;
export type NewVocabSense = typeof vocabSenses.$inferInsert;
export type VocabExample = typeof vocabExamples.$inferSelect;
export type NewVocabExample = typeof vocabExamples.$inferInsert;
export type VocabForm = typeof vocabForms.$inferSelect;
export type NewVocabForm = typeof vocabForms.$inferInsert;
export type VocabCollocation = typeof vocabCollocations.$inferSelect;
export type NewVocabCollocation = typeof vocabCollocations.$inferInsert;
export type VocabRelation = typeof vocabRelations.$inferSelect;
export type NewVocabRelation = typeof vocabRelations.$inferInsert;

export type GrammarTopic = typeof grammarTopics.$inferSelect;
export type NewGrammarTopic = typeof grammarTopics.$inferInsert;

export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type PracticeSession = typeof practiceSessions.$inferSelect;
export type NewPracticeSession = typeof practiceSessions.$inferInsert;
export type LearningEvent = typeof learningEvents.$inferSelect;
export type NewLearningEvent = typeof learningEvents.$inferInsert;
export type ItemProgress = typeof itemProgress.$inferSelect;
export type NewItemProgress = typeof itemProgress.$inferInsert;

export type ImportRun = typeof importRuns.$inferSelect;
export type NewImportRun = typeof importRuns.$inferInsert;
export type ImportItem = typeof importItems.$inferSelect;
export type NewImportItem = typeof importItems.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
