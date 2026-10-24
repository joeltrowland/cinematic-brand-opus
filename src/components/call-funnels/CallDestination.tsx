import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { callUrl } from "../../../supabase/functions/_shared/callFunnels";

/** An external next step (calendar or offer). Disabled in the builder preview. */
export default function CallDestination({
  url,
  children,
  preview,
}: {
  url: string;
  children: ReactNode;
  preview: boolean;
}) {
  if (preview)
    return (
      <>
        <button type="button" className="cf-button" disabled>
          {children}
          <ArrowUpRight size={19} aria-hidden="true" />
        </button>
        <p className="cf-small cf-muted">
          External actions are disabled in preview.
        </p>
      </>
    );
  if (!url || !callUrl(url, true))
    return (
      <p className="cf-notice">
        This next step is not available yet. Please check back soon.
      </p>
    );
  return (
    <a
      className="cf-button"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={19} aria-hidden="true" />
    </a>
  );
}
