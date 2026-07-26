// Tokenized receipt links: token = hex HMAC-SHA256(LINK_SECRET, submission id).
import { createHmac, timingSafeEqual, createHash } from "node:crypto";

export function receiptToken(id: string): string | null {
  const secret = Netlify.env.get("LINK_SECRET");
  if (!secret) return null;
  return createHmac("sha256", secret).update(String(id)).digest("hex");
}

export function verifyReceiptToken(id: string, token: string): boolean {
  const expected = receiptToken(id);
  if (!expected || !token) return false;
  // Hash both sides to equal length so the comparison is timing-safe
  // regardless of the supplied token's length.
  const ha = createHash("sha256").update(String(token)).digest();
  const hb = createHash("sha256").update(expected).digest();
  return timingSafeEqual(ha, hb);
}

export function siteOrigin(): string {
  return (
    Netlify.env.get("URL") ||
    "https://almario-visitor-form.netlify.app"
  ).replace(/\/+$/, "");
}

// Full receipt URL, or null when LINK_SECRET is not configured.
export function receiptLink(id: string): string | null {
  const token = receiptToken(id);
  if (!token) return null;
  return `${siteOrigin()}/api/receipt/${encodeURIComponent(id)}?t=${token}`;
}
