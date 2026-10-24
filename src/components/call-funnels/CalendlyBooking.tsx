import { useEffect, useRef, useState } from "react";
import type { CallContact } from "../../../supabase/functions/_shared/callFunnels";
import {
  calendlyEmbedUrl,
  calendlyPageHeight,
  scheduledInviteeUri,
} from "./calendlyEmbed";

export default function CalendlyBooking({
  url,
  applicationId,
  contact,
  accent,
  onScheduled,
}: {
  url: string;
  applicationId: string;
  contact: CallContact | null;
  accent?: string;
  onScheduled: (inviteeUri: string) => void;
}) {
  const handler = useRef(onScheduled);
  handler.current = onScheduled;
  const [height, setHeight] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    function listen(message: MessageEvent) {
      if (message.source !== frame.current?.contentWindow) return;
      const measured = calendlyPageHeight(message);
      if (measured) setHeight(measured);
      const uri = scheduledInviteeUri(message);
      if (uri) handler.current(uri);
    }
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  const src = calendlyEmbedUrl(url, {
    applicationId,
    contact,
    accent,
    embedDomain:
      typeof window === "undefined"
        ? "brianhanson.com"
        : window.location.hostname,
  });
  return (
    <iframe
      ref={frame}
      className="cf-calendly"
      src={src}
      title="Choose a call time"
      loading="lazy"
      style={height ? { height } : undefined}
    />
  );
}
