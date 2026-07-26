// Public endpoint: current event settings for the kiosk.
// Returns only {eventName, eventDate} (nulls when not configured).
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }
  let eventName: string | null = null;
  let eventDate: string | null = null;
  try {
    const store = getStore({ name: "config", consistency: "strong" });
    const cfg = (await store.get("current-event", { type: "json" })) as any | null;
    if (cfg && typeof cfg.eventName === "string" && cfg.eventName.trim()) {
      eventName = cfg.eventName.trim();
      eventDate = typeof cfg.eventDate === "string" && cfg.eventDate.trim() ? cfg.eventDate.trim() : null;
    }
  } catch {
    // treat as unset
  }
  return new Response(JSON.stringify({ ok: true, eventName, eventDate }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: "/api/event",
};
