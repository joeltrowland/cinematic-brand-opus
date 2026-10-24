import { describe, expect, it, vi } from "vitest";
import {
  calendlyBookingEvents,
  calendlyGatewayFetch,
  CALENDLY_GATEWAY,
} from "../../../supabase/functions/_shared/calendlyBooking";
import { parseCallFunnelRequest } from "../../../supabase/functions/_shared/callFunnelRequests";
import { runCallFunnelRequest } from "../../../supabase/functions/_shared/callFunnelRuntime";
import {
  calendlyEmbedUrl,
  calendlyPageHeight,
  isCalendlyUrl,
  scheduledInviteeUri,
} from "@/components/call-funnels/calendlyEmbed";

const applicationId = "00000000-0000-4000-8000-000000000001";
const api = "https://api.calendly.com";
const inviteeUri = (event: string, invitee: string) =>
  `${api}/scheduled_events/${event}/invitees/${invitee}`;
const first = inviteeUri("EVENT-AAAA-1111", "INVITEE-AAAA-1111");
const second = inviteeUri("EVENT-BBBB-2222", "INVITEE-BBBB-2222");

function calendlyStub(
  invitees: Record<string, Record<string, unknown>>,
  starts: Record<string, string> = {},
) {
  return vi.fn(async (path: string) => {
    const uri = `${api}${path}`;
    if (invitees[uri]) return { resource: { uri, ...invitees[uri] } };
    if (starts[uri]) return { resource: { uri, start_time: starts[uri] } };
    throw new Error(`unexpected ${path}`);
  });
}
const active = (event: string, extra: Record<string, unknown> = {}) => ({
  status: "active",
  created_at: "2026-10-24T15:00:00.000000Z",
  updated_at: "2026-10-24T15:00:00.000000Z",
  event: `${api}/scheduled_events/${event}`,
  tracking: { utm_content: applicationId },
  ...extra,
});
const startTimes = {
  [`${api}/scheduled_events/EVENT-AAAA-1111`]: "2026-10-28T18:00:00.000000Z",
  [`${api}/scheduled_events/EVENT-BBBB-2222`]: "2026-10-29T18:00:00.000000Z",
};

describe("Calendly booking confirmation", () => {
  it("records a confirmed booking with Calendly's start time", async () => {
    const events = await calendlyBookingEvents(
      applicationId,
      first,
      calendlyStub({ [first]: active("EVENT-AAAA-1111") }, startTimes),
    );
    expect(events).toEqual([
      {
        eventId: "calendly-booked-INVITEE-AAAA-1111",
        applicationId,
        type: "booked",
        occurredAt: "2026-10-24T15:00:00.000000Z",
        startsAt: "2026-10-28T18:00:00.000000Z",
        reference: `${api}/scheduled_events/EVENT-AAAA-1111`,
      },
    ]);
  });

  it("adds a cancellation when the invitee cancelled", async () => {
    const events = await calendlyBookingEvents(
      applicationId,
      first,
      calendlyStub(
        {
          [first]: active("EVENT-AAAA-1111", {
            status: "canceled",
            cancellation: { created_at: "2026-10-25T10:00:00.000000Z" },
          }),
        },
        startTimes,
      ),
    );
    expect(events.map((e) => [e.type, e.occurredAt])).toEqual([
      ["booked", "2026-10-24T15:00:00.000000Z"],
      ["cancelled", "2026-10-25T10:00:00.000000Z"],
    ]);
  });

  it("follows a reschedule to the new time instead of cancelling", async () => {
    const events = await calendlyBookingEvents(
      applicationId,
      first,
      calendlyStub(
        {
          [first]: active("EVENT-AAAA-1111", {
            status: "canceled",
            rescheduled: true,
            new_invitee: second,
          }),
          [second]: active("EVENT-BBBB-2222", {
            created_at: "2026-10-25T09:00:00.000000Z",
            old_invitee: first,
            tracking: { utm_content: null },
          }),
        },
        startTimes,
      ),
    );
    expect(events.map((e) => [e.type, e.startsAt])).toEqual([
      ["booked", "2026-10-28T18:00:00.000000Z"],
      ["rescheduled", "2026-10-29T18:00:00.000000Z"],
    ]);
  });

  it("refuses a booking made for a different application", async () => {
    await expect(
      calendlyBookingEvents(
        applicationId,
        first,
        calendlyStub(
          {
            [first]: active("EVENT-AAAA-1111", {
              tracking: { utm_content: "someone-else" },
            }),
          },
          startTimes,
        ),
      ),
    ).rejects.toThrow(/another application/);
    await expect(
      calendlyBookingEvents(applicationId, "https://evil.example/x", vi.fn()),
    ).rejects.toThrow(/Invalid/);
  });

  it("calls the Lovable connector gateway with both keys", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ resource: {} })),
    );
    await calendlyGatewayFetch("lovable", "connection", fetcher)("/users/me");
    expect(fetcher).toHaveBeenCalledWith(
      `${CALENDLY_GATEWAY}/users/me`,
      expect.objectContaining({
        headers: {
          Authorization: "Bearer lovable",
          "X-Connection-Api-Key": "connection",
        },
      }),
    );
  });
});

describe("Calendly request handling", () => {
  const request = {
    action: "calendly",
    token: "a".repeat(64),
    inviteeUri: first,
  };
  const hash = async () => "b".repeat(64);
  const database = (outcome: string) => {
    const recorded: unknown[] = [];
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "call_funnel_record_event") {
        recorded.push(args);
        return { data: {}, error: null };
      }
      return {
        data: {
          id: applicationId,
          outcome,
          booking: { status: recorded.length ? "booked" : "unconfirmed" },
        },
        error: null,
      };
    });
    return { rpc, recorded };
  };

  it("accepts only a Calendly invitee reference", () => {
    expect(parseCallFunnelRequest(request)).toEqual(request);
    expect(() =>
      parseCallFunnelRequest({ ...request, inviteeUri: "https://x.test/1" }),
    ).toThrow();
    expect(() => parseCallFunnelRequest({ ...request, extra: 1 })).toThrow();
  });

  it("records verified events as signed outcomes and returns the new state", async () => {
    const db = database("qualified");
    const result = await runCallFunnelRequest(
      parseCallFunnelRequest(request),
      db,
      hash,
      calendlyStub({ [first]: active("EVENT-AAAA-1111") }, startTimes),
    );
    expect(db.recorded).toEqual([
      expect.objectContaining({
        _application_id: applicationId,
        _type: "booked",
        _source: "signed_webhook",
        _starts_at: "2026-10-28T18:00:00.000000Z",
      }),
    ]);
    expect(result).toMatchObject({ booking: { status: "booked" } });
  });

  it("rejects alternative-path applications and missing configuration", async () => {
    const stub = calendlyStub(
      { [first]: active("EVENT-AAAA-1111") },
      startTimes,
    );
    await expect(
      runCallFunnelRequest(
        parseCallFunnelRequest(request),
        database("alternative"),
        hash,
        stub,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      runCallFunnelRequest(
        parseCallFunnelRequest(request),
        database("qualified"),
        hash,
        null,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("reports a Calendly outage as retryable, not as a bad booking", async () => {
    const failing = vi.fn(async () => {
      throw new Error("Calendly request failed (502)");
    });
    await expect(
      runCallFunnelRequest(
        parseCallFunnelRequest(request),
        database("qualified"),
        hash,
        failing,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("Calendly inline embed", () => {
  const url =
    "https://calendly.com/brian-1659/ai-strategy-call-with-brian-hanson";
  it("recognizes only Calendly booking pages", () => {
    expect(isCalendlyUrl(url)).toBe(true);
    expect(isCalendlyUrl("https://calendly.com/")).toBe(false);
    expect(isCalendlyUrl("https://calendly.com.evil.test/x")).toBe(false);
    expect(isCalendlyUrl("not a url")).toBe(false);
  });

  it("prefills the applicant and tags the booking with the application", () => {
    const embed = new URL(
      calendlyEmbedUrl(url, {
        applicationId,
        contact: { name: "Pat Lee", email: "pat@example.com" },
        embedDomain: "brianhanson.com",
        accent: "#d4af55",
      }),
    );
    expect(Object.fromEntries(embed.searchParams)).toMatchObject({
      name: "Pat Lee",
      email: "pat@example.com",
      utm_content: applicationId,
      embed_domain: "brianhanson.com",
      embed_type: "Inline",
      primary_color: "d4af55",
    });
  });

  it("trusts frame messages only from Calendly", () => {
    const scheduled = {
      event: "calendly.event_scheduled",
      payload: { invitee: { uri: first } },
    };
    const message = (origin: string, data: unknown) =>
      ({ origin, data }) as MessageEvent;
    expect(
      scheduledInviteeUri(message("https://calendly.com", scheduled)),
    ).toBe(first);
    expect(
      scheduledInviteeUri(message("https://evil.test", scheduled)),
    ).toBeNull();
    expect(
      calendlyPageHeight(
        message("https://calendly.com", {
          event: "calendly.page_height",
          payload: { height: "1046px" },
        }),
      ),
    ).toBe(1046);
  });
});
