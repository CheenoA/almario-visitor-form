// Shared admin auth helpers: timing-safe passcode compare + IP-based login throttling.
import { timingSafeEqual, createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Constant-time string comparison. Hashing both sides first makes the buffers
// equal-length, so length differences leak nothing and timingSafeEqual is safe.
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;

function throttleStore() {
  return getStore({ name: "admin-throttle", consistency: "strong" });
}

function keyFor(ip: string): string {
  // Sanitize the IP into a safe blob key.
  return "ip/" + String(ip || "unknown").replace(/[^a-zA-Z0-9:.\-]/g, "_").slice(0, 100) + ".json";
}

export interface ThrottleState {
  blocked: boolean;
  retryAfterSeconds: number;
}

// Returns current throttle state for this IP.
export async function checkThrottle(ip: string): Promise<ThrottleState> {
  try {
    const rec = (await throttleStore().get(keyFor(ip), { type: "json" })) as { failures?: number[] } | null;
    const now = Date.now();
    const recent = (rec?.failures || []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_FAILURES) {
      const oldest = Math.min(...recent);
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
      return { blocked: true, retryAfterSeconds };
    }
    return { blocked: false, retryAfterSeconds: 0 };
  } catch {
    // Throttle infrastructure failing must not lock admins out entirely.
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

export async function recordFailure(ip: string): Promise<void> {
  try {
    const store = throttleStore();
    const key = keyFor(ip);
    const rec = (await store.get(key, { type: "json" })) as { failures?: number[] } | null;
    const now = Date.now();
    const recent = (rec?.failures || []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    await store.setJSON(key, { failures: recent.slice(-20) });
  } catch {
    // best effort
  }
}

export async function clearThrottle(ip: string): Promise<void> {
  try {
    await throttleStore().delete(keyFor(ip));
  } catch {
    // best effort
  }
}
