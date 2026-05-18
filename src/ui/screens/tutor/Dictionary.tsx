import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Button } from "@/ui/components/Button";
import { PageHeader } from "@/ui/components/PageHeader";
import { DictionaryLookupPanel } from "@/ui/components/dictionary/DictionaryLookupPanel";
import { TutorPanel } from "@/ui/tutor/components/Material";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function TutorDictionary() {
  const queryClient = useQueryClient();
  const statusQ = useQuery({
    queryKey: queryKeys.dictionary.status(),
    queryFn: () => api.dictionary.status(),
  });

  async function choosePack() {
    await api.dictionary.selectPackFolder();
    await queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.status() });
  }

  return (
    <>
      <PageHeader
        eyebrow="Tutor"
        title="Dictionary"
        subtitle="Offline OALD10 reference for lesson authoring, pronunciation checks, and example mining."
        actions={
          <Button variant="secondary" onClick={choosePack}>
            Select pack...
          </Button>
        }
      />
      {statusQ.data?.active ? (
        <DictionaryLookupPanel showYamlAction />
      ) : (
        <section className="px-8 py-6">
          <TutorPanel title="No dictionary pack" className="p-6">
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Select the external folder that contains `oald10.mdxbak` or `oald10_og.mdx` plus
              matching `.mdd` assets. The pack remains outside GitHub and outside packaged app
              artifacts.
            </p>
            <Button className="mt-5" onClick={choosePack}>
              Select dictionary pack
            </Button>
          </TutorPanel>
        </section>
      )}
    </>
  );
}
