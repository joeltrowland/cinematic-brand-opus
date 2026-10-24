/** Calendly inline embed helpers: prefill, booking tag and frame messages. */
import type { CallContact } from "../../../supabase/functions/_shared/callFunnels";

const CALENDLY_ORIGIN = "https://calendly.com";

export function isCalendlyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "calendly.com" &&
      parsed.pathname.length > 1
    );
  } catch {
    return false;
  }
}

/** Prefills the applicant and tags the booking with its application ID. */
export function calendlyEmbedUrl(
  url: string,
  options: {
    applicationId: string;
    contact: CallContact | null;
    embedDomain: string;
    accent?: string;
  },
): string {
  const embed = new URL(url);
  embed.searchParams.set("embed_domain", options.embedDomain);
  embed.searchParams.set("embed_type", "Inline");
  embed.searchParams.set("hide_gdpr_banner", "1");
  embed.searchParams.set("hide_event_type_details", "1");
  embed.searchParams.set("utm_source", "brianhanson.com");
  embed.searchParams.set("utm_medium", "call-application");
  embed.searchParams.set("utm_content", options.applicationId);
  if (options.contact?.name)
    embed.searchParams.set("name", options.contact.name);
  if (options.contact?.email)
    embed.searchParams.set("email", options.contact.email);
  if (options.accent && /^#[a-f0-9]{6}$/i.test(options.accent))
    embed.searchParams.set("primary_color", options.accent.slice(1));
  return embed.toString();
}

/** Calendly reports its content height so the frame never scrolls inside the page. */
export function calendlyPageHeight(message: MessageEvent): number | null {
  if (message.origin !== CALENDLY_ORIGIN) return null;
  const data = message.data as {
    event?: unknown;
    payload?: { height?: unknown };
  } | null;
  if (!data || data.event !== "calendly.page_height") return null;
  const height = Number.parseInt(String(data.payload?.height ?? ""), 10);
  return Number.isFinite(height) && height >= 400 && height <= 2400
    ? height
    : null;
}

/** Calendly posts this after the invitee confirms a time. */
export function scheduledInviteeUri(message: MessageEvent): string | null {
  if (message.origin !== CALENDLY_ORIGIN) return null;
  const data = message.data as {
    event?: unknown;
    payload?: { invitee?: { uri?: unknown } };
  } | null;
  if (!data || data.event !== "calendly.event_scheduled") return null;
  const uri = data.payload?.invitee?.uri;
  return typeof uri === "string" ? uri : null;
}
