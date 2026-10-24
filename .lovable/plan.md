# Calendly connector status (no code changes)

## Current state
- Workspace connection "Brian's Calendly" exists (OAuth, connector gateway). Linkable.
- It is NOT linked to this project, so the functions have no Calendly environment variables right now.

## Granted scopes
- Granted: users:read, organizations:read, event_types:read, scheduled_events:read, scheduled_events:write, availability:read, scheduling_links:write, shares:write
- Not granted: webhooks:write, webhooks:read (both can be granted). Getting them means reconnecting "Brian's Calendly" in workspace connector settings with those scopes.

## If approved: link only
1. Link "Brian's Calendly" to this project. No code, secret, or function changes.
2. Report the exact environment variable names that come back from linking.

## After linking (reference)
- Env vars: `LOVABLE_API_KEY` plus `CALENDLY_API_KEY`. If a variable with that name already exists, the new one gets a numbered suffix (`_1`). The link result confirms the actual name.
- Base URL: `https://connector-gateway.lovable.dev/calendly/{calendly-path}`. Never call api.calendly.com directly.
- Headers: `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${CALENDLY_API_KEY}`.

```ts
const GATEWAY = "https://connector-gateway.lovable.dev/calendly";
const lovableKey = Deno.env.get("LOVABLE_API_KEY");
const calendlyKey = Deno.env.get("CALENDLY_API_KEY");
if (!lovableKey || !calendlyKey) return new Response("Calendly not configured", { status: 503 });

const res = await fetch(`${GATEWAY}/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`, {
  headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": calendlyKey },
});
if (!res.ok) throw new Error(`Calendly [${res.status}]: ${await res.text()}`);
const invitee = await res.json();
```

Note: linked connector secrets reach the app's server runtime. That they also reach Supabase edge functions is unverified until linking is done and the variables are checked.
