import type { Book, GrammarTopic, Lesson, Unit, VocabEntry } from "@/data/types";
import { TutorContent } from "@/ui/screens/tutor/Content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";
import { mountTutorScreen } from "../../test-router";

function dt(): Date {
  return new Date(0);
}

const book: Book = {
  id: 1,
  code: "destination-b1",
  title: "Destination B1",
  level: null,
  publisher: null,
  language: "en",
  metadata: null,
  createdAt: dt(),
  updatedAt: dt(),
};

const unit: Unit = {
  id: 10,
  bookId: 1,
  ordinal: 1,
  code: "U01",
  title: "People & Relationships",
  summaryMd: null,
  metadata: null,
  createdAt: dt(),
  updatedAt: dt(),
};

const lesson: Lesson = {
  id: 100,
  unitId: 10,
  ordinal: 1,
  kind: "vocabulary",
  title: "Family",
  slug: "family",
  metadata: null,
  createdAt: dt(),
  updatedAt: dt(),
};

const grammarLesson: Lesson = {
  id: 101,
  unitId: 10,
  ordinal: 2,
  kind: "grammar",
  title: "Present simple",
  slug: "present-simple",
  metadata: null,
  createdAt: dt(),
  updatedAt: dt(),
};

const grammarTopic: GrammarTopic = {
  id: 2000,
  lessonId: 101,
  sourceId: "present-simple-routines",
  slug: "present-simple-routines",
  title: "Present simple for routines",
  summaryMd: "Use present simple for habits.",
  explanationMd: "Add -s or -es with he/she/it.",
  difficulty: 1,
  tags: ["tense"],
  metadata: {
    patterns: [{ label: "affirmative", form: "subject + base verb" }],
    examples: [{ text: "She studies every day.", explanation: "A routine." }],
    common_mistakes: [{ wrong: "She study.", correct: "She studies." }],
    checks: [{ prompt: "I watch -> he ...", answer: "He watches." }],
  },
  contentHash: "g",
  createdAt: dt(),
  updatedAt: dt(),
};

const entryRow: VocabEntry = {
  id: 1000,
  lessonId: 100,
  sourceId: "relative-noun",
  headword: "relative",
  lemma: null,
  pos: "noun",
  ipa: "/ˈrelətɪv/",
  cefrLevel: "B1",
  frequencyRank: null,
  imageRef: null,
  audioRef: null,
  tags: ["family"],
  metadata: null,
  contentHash: "h",
  createdAt: dt(),
  updatedAt: dt(),
};

const entryFull: VocabEntryFull = {
  ...entryRow,
  senses: [
    {
      id: 1,
      entryId: 1000,
      ordinal: 0,
      definitionEn: "a member of your family",
      definitionVi: "người thân",
      register: "neutral",
      domain: null,
      notesMd: null,
    },
  ],
  examples: [
    {
      id: 1,
      entryId: 1000,
      senseId: null,
      ordinal: 0,
      text: "I have many {{relatives}} in Hanoi.",
      translation: "Tôi có nhiều họ hàng ở Hà Nội.",
      clozeTarget: "relatives",
      clozeHint: null,
      audioRef: null,
      sourceRef: null,
    },
  ],
  forms: [{ id: 1, entryId: 1000, kind: "plural", formText: "relatives", ipa: null }],
  collocations: [
    {
      id: 1,
      entryId: 1000,
      collocation: "close relative",
      pattern: "adj+noun",
      exampleText: null,
      notesMd: null,
    },
  ],
  relations: [
    {
      id: 1,
      entryId: 1000,
      relatedEntryId: null,
      relatedText: "family member",
      relation: "synonym",
    },
  ],
};

function renderScreen() {
  return mountTutorScreen({ path: "content", screen: TutorContent });
}

describe("TutorContent", () => {
  beforeEach(() => {
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([book]);
    vi.spyOn(window.api.curriculum, "listUnitsByBook").mockResolvedValue([unit]);
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([lesson]);
    vi.spyOn(window.api.vocab, "listByLesson").mockResolvedValue([entryRow]);
    vi.spyOn(window.api.vocab, "getById").mockResolvedValue(entryFull);
    vi.spyOn(window.api.grammar, "listByLesson").mockResolvedValue([]);
    vi.spyOn(window.api.grammar, "getById").mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-selects the first book and shows the lesson with its entries", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Destination B1")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("People & Relationships")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^relative noun$/i })).toBeInTheDocument(),
    );
  });

  it("clicking an entry loads its detail with senses, cloze example, forms, relations", async () => {
    renderScreen();
    const entryButton = await screen.findByRole("button", { name: /^relative noun$/i });
    fireEvent.click(entryButton);

    await waitFor(() => expect(screen.getByText("a member of your family")).toBeInTheDocument());
    expect(window.api.vocab.getById).toHaveBeenCalledWith({ id: 1000 });

    expect(screen.getByText("/ˈrelətɪv/")).toBeInTheDocument();
    expect(screen.getByText(/^B1$/)).toBeInTheDocument();
    expect(screen.getByText("#family")).toBeInTheDocument();

    // Cloze marker rendered as a highlighted span (data-cloze=true).
    const cloze = document.querySelector('[data-cloze="true"]');
    expect(cloze?.textContent).toBe("relatives");

    expect(screen.getByText("plural")).toBeInTheDocument();
    expect(screen.getByText("close relative")).toBeInTheDocument();
    expect(screen.getByText(/family member/)).toBeInTheDocument();
  });

  it("shows the empty state when no books are imported", async () => {
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText(/No books yet/i)).toBeInTheDocument());
  });

  it("shows the lesson empty state when no entries are imported", async () => {
    vi.spyOn(window.api.vocab, "listByLesson").mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText(/No entries imported/i)).toBeInTheDocument());
  });

  it("renders grammar topics and their teaching metadata", async () => {
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([grammarLesson]);
    vi.spyOn(window.api.grammar, "listByLesson").mockResolvedValue([grammarTopic]);
    vi.spyOn(window.api.grammar, "getById").mockResolvedValue(grammarTopic);

    renderScreen();
    const topicButton = await screen.findByRole("button", {
      name: /present simple for routines/i,
    });
    fireEvent.click(topicButton);

    await waitFor(() => expect(window.api.grammar.getById).toHaveBeenCalledWith({ id: 2000 }));
    await waitFor(() =>
      expect(screen.getByText("Use present simple for habits.")).toBeInTheDocument(),
    );
    expect(screen.getByText("subject + base verb")).toBeInTheDocument();
    expect(screen.getByText("She studies every day.")).toBeInTheDocument();
    expect(screen.getByText("She study.")).toBeInTheDocument();
    expect(screen.getByText("He watches.")).toBeInTheDocument();
  });

  it("renders the book code under the same pane as the 'Books' heading", async () => {
    renderScreen();
    // Wait for the book row (loaded asynchronously via TanStack Query) to
    // appear, then assert it sits under the same pane as the heading.
    const code = await screen.findByText("destination-b1");
    const aside = code.closest("aside");
    expect(aside).not.toBeNull();
    if (aside) {
      expect(within(aside).getByText("Books")).toBeInTheDocument();
    }
  });
});
