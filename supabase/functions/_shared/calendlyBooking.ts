/** Calendly bookings confirmed server-side through the Lovable connector gateway. */
import type { CallWebhookEvent } from "./callFunnelRequests.ts";

export const CALENDLY_GATEWAY =
  "https://connector-gateway.lovable.dev/calendly";
const uuid = "[a-zA-Z0-9-]{8,64}";
const inviteePattern = new RegExp(
  `^https://api\\.calendly\\.com/scheduled_events/(${uuid})/invitees/(${uuid})$`,
);
const eventPattern = new RegExp(
  `^https://api\\.calendly\\.com/scheduled_events/(${uuid})$`,
);
const MAX_RESCHEDULE_HOPS = 3;

export type CalendlyInvitee = {
  uri: string;
  status: "active" | "canceled";
  created_at: string;
  updated_at: string;
  event: string;
  rescheduled?: boolean;
  new_invitee?: string | null;
  old_invitee?: string | null;
  cancellation?: { created_at?: string } | null;
  tracking?: { utm_content?: string | null } | null;
};
export type CalendlyEvent = { uri: string; start_time: string };
export type CalendlyFetch = (path: string) => Promise<unknown>;

export function isCalendlyInviteeUri(value: unknown): value is string {
  return typeof value === "string" && inviteePattern.test(value);
}
function gatewayPath(apiUri: string): string {
  return apiUri.replace("https://api.calendly.com", "");
}
function resource<T>(body: unknown): T {
  if (!body || typeof body !== "object" || !("resource" in body))
    throw new Error("Unexpected Calendly response");
  return (body as { resource: T }).resource;
}
const uuidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/**
 * Follows a booking through reschedules and returns the outcome events it
 * implies. The application ID travels in utm_content, so a booking can only
 * attach to the application that opened the calendar.
 */
export async function calendlyBookingEvents(
  applicationId: string,
  inviteeUri: string,
  fetchCalendly: CalendlyFetch,
): Promise<CallWebhookEvent[]> {
  if (!isCalendlyInviteeUri(inviteeUri))
    throw new Error("Invalid Calendly booking reference");
  const events: CallWebhookEvent[] = [];
  let next: string | null = inviteeUri;
  for (let hop = 0; next && hop <= MAX_RESCHEDULE_HOPS; hop++) {
    const invitee: CalendlyInvitee = resource<CalendlyInvitee>(
      await fetchCalendly(gatewayPath(next)),
    );
    // Calendly may drop UTM tags on a reschedule, so only the booking the
    // applicant made here must carry the tag; later hops come from new_invitee.
    if (hop === 0 && invitee.tracking?.utm_content !== applicationId)
      throw new Error("Calendly booking belongs to another application");
    if (!eventPattern.test(invitee.event))
      throw new Error("Unexpected Calendly response");
    const scheduled = resource<CalendlyEvent>(
      await fetchCalendly(gatewayPath(invitee.event)),
    );
    const key = uuidOf(invitee.uri);
    events.push({
      eventId: `calendly-booked-${key}`,
      applicationId,
      // Derived from the invitee, not the walk, so replays always match.
      type: invitee.old_invitee ? "rescheduled" : "booked",
      occurredAt: invitee.created_at,
      startsAt: scheduled.start_time,
      reference: scheduled.uri,
    });
    if (invitee.status !== "canceled") break;
    if (invitee.rescheduled && isCalendlyInviteeUri(invitee.new_invitee)) {
      next = invitee.new_invitee;
      continue;
    }
    events.push({
      eventId: `calendly-cancelled-${key}`,
      applicationId,
      type: "cancelled",
      occurredAt: invitee.cancellation?.created_at || invitee.updated_at,
      reference: scheduled.uri,
    });
    break;
  }
  return events;
}

export function calendlyGatewayFetch(
  lovableKey: string,
  connectionKey: string,
  fetcher: typeof fetch = fetch,
): CalendlyFetch {
  return async (path) => {
    const response = await fetcher(`${CALENDLY_GATEWAY}${path}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(`Calendly request failed (${response.status})`);
    return response.json();
  };
}
