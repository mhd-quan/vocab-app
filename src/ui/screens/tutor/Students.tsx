import { PageHeader } from "@/ui/components/PageHeader";
import { PlaceholderPanel } from "@/ui/components/PlaceholderPanel";

export function TutorStudents() {
  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Students"
        subtitle="Create, edit, and archive student profiles. Hooked up to students.* IPC procedures."
      />
      <PlaceholderPanel
        title="Student CRUD UI"
        body="The repository, IPC procedures, and tests are all live — only the form & list UI remain. Lands in PR #6."
        hint="api.students.create / update / archive / restore are already wired."
      />
    </>
  );
}
