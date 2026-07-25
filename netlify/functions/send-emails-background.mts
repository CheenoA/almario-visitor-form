// Background email sender. Invoked internally by submit.mts (and never by
// browsers). Netlify returns 202 to the caller immediately; this function then
// has up to 15 minutes to deliver the emails and update the record.
import type { Context } from "@netlify/functions";
import { timingSafeEqualStr } from "../lib/auth.mts";
import { deliverEmailsForSubmission } from "../lib/deliver.mts";

export default async (req: Request, _context: Context) => {
  const secret = Netlify.env.get("ADMIN_PASSCODE") || "";
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (!secret || !timingSafeEqualStr(bearer, secret)) {
    console.error("send-emails-background: unauthorized invocation rejected");
    return;
  }

  let id = "";
  try {
    const body = await req.json();
    id = String(body.id || "");
  } catch {
    console.error("send-emails-background: invalid JSON body");
    return;
  }
  if (!/^ARV-[A-Z0-9-]{4,40}$/.test(id)) {
    console.error("send-emails-background: invalid id", id);
    return;
  }

  try {
    const status = await deliverEmailsForSubmission(id);
    console.log(`send-emails-background: ${id} -> ${status}`);
  } catch (e: any) {
    console.error(`send-emails-background: ${id} delivery error`, e?.message || e);
  }
};
