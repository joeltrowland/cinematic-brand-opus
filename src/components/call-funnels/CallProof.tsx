import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  callUrl,
  type CallPublication,
} from "../../../supabase/functions/_shared/callFunnels";
import type { Testimonial } from "@/config/types";
import { selectedProof } from "./callShowcase";

type Quote = Testimonial & { context?: string };

export function Proof({
  publication,
  alternative = false,
  preview,
  selectedIds,
  heading,
}: {
  publication: CallPublication;
  alternative?: boolean;
  preview: boolean;
  selectedIds?: string[];
  heading?: string;
}) {
  const proof = selectedProof(
    publication,
    selectedIds ??
      (alternative
        ? publication.config.alternative.proofIds
        : publication.config.proofIds),
  );
  if (!proof.length)
    return preview ? (
      <div className="cf-proof-guidance">
        <p className="cf-proof-guidance-title">
          Your customer stories belong here
        </p>
        <p>
          Select approved testimonials in the builder to show relevant outcomes
          and honest experiences.
        </p>
      </div>
    ) : null;
  return (
    <section className="cf-proof-section" aria-label="Customer stories">
      <h2>
        {heading ||
          publication.config.invitation.proofHeading ||
          "Hear from people who took the next step"}
      </h2>
      <div className="cf-proof-grid">
        {proof.map((item) => {
          const portrait = publication.config.proofImages[item.id];
          return (
            <figure className="cf-proof-card" key={item.id}>
              {portrait && callUrl(portrait, true) && (
                <img
                  src={portrait}
                  alt=""
                  loading="lazy"
                  width={160}
                  height={160}
                  className="cf-proof-portrait"
                />
              )}
              {item.title && <h3>{item.title}</h3>}
              <blockquote>{item.content}</blockquote>
              <figcaption>{item.attribution}</figcaption>
              {!preview && item.source_url && callUrl(item.source_url) && (
                <a
                  className="cf-small cf-plain-link"
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View original story{" "}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

export function QuoteFigure({
  item,
  featured = false,
}: {
  item: Quote;
  featured?: boolean;
}) {
  return (
    <figure className={`cf-quote${featured ? " is-featured" : ""}`}>
      <blockquote>
        <p>“{item.quote}”</p>
      </blockquote>
      <figcaption>
        <strong>{item.attribution}</strong>
        {item.context && <span>{item.context}</span>}
      </figcaption>
    </figure>
  );
}

/** Site testimonials for funnels whose owner has not selected builder proof. */
export function ShowcaseQuotes({
  heading,
  items,
}: {
  heading: string;
  items: Quote[];
}) {
  const headingId = useId();
  if (!items.length) return null;
  const [lead, ...rest] = items;
  return (
    <section className="cf-quotes" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      <div className="cf-quotes-grid">
        <QuoteFigure item={lead} featured />
        {rest.length > 0 && (
          <div className="cf-quotes-rest">
            {rest.map((item) => (
              <QuoteFigure
                key={`${item.attribution}-${item.quote}`}
                item={item}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
