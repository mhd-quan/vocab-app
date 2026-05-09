import { PageHeader } from "@/ui/components/PageHeader";
import { PlaceholderPanel } from "@/ui/components/PlaceholderPanel";

export function TutorContent() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Content browser"
        subtitle="Browse books → units → lessons → vocab entries. Read-only; authoring stays in YAML files for v0.0.1."
      />
      <PlaceholderPanel
        title="Books / units / lessons / entries view"
        body="Three-pane Lingvist-style browser with entry detail card (headword, IPA, senses, examples with cloze highlight, collocations, relations). Lands in PR #6."
        hint="The data is already in SQLite — try `npm run import` then check api.curriculum.listBooks() returns the row."
      />
    </>
  );
}
