import { useSiteConfig } from "@/config/SiteConfigContext";
import type { CallPublication } from "../../../supabase/functions/_shared/callFunnels";

/** Approved builder proof for a page, in the order the owner selected it. */
export function selectedProof(
  publication: CallPublication,
  ids: string[] = publication.config.proofIds,
) {
  return ids.flatMap(
    (id) => publication.proof.find((item) => item.id === id) || [],
  );
}

/** Site-level sales sections for one funnel page, if the site defines them. */
export function useCallShowcase(slug: string) {
  const site = useSiteConfig();
  const showcase = site.callShowcases?.[slug] ?? null;
  return {
    showcase,
    results: showcase?.showResults ? site.results : [],
  };
}
