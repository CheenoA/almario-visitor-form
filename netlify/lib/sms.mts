// SMS notification via Semaphore (preferred, PH-native) or Twilio (fallback),
// using plain fetch — no provider npm packages, to keep the bundle lean.
// Failures must never fail a submission — always resolve to a status string.
//
// Provider precedence:
//   1. SEMAPHORE_API_KEY set            -> Semaphore (semaphore.co)
//   2. TWILIO_ACCOUNT_SID/AUTH/FROM set -> Twilio REST API
//   3. neither                          -> "pending: no credentials"

// Normalize Philippine mobile formats to E.164 (+63...). Used for Twilio.
export function normalizePhMobile(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (/^\+63\d{10}$/.test(digits)) return digits;               // +639XXXXXXXXX
  const bare = digits.replace(/^\+/, "");
  if (/^639\d{9}$/.test(bare)) return `+${bare}`;               // 639XXXXXXXXX
  if (/^09\d{9}$/.test(bare)) return `+63${bare.slice(1)}`;     // 09XXXXXXXXX
  if (/^9\d{9}$/.test(bare)) return `+63${bare}`;               // 9XXXXXXXXX
  if (/^\+\d{8,15}$/.test(digits)) return digits;               // other intl in E.164
  return null;
}

// Normalize Philippine mobile formats to local 09XXXXXXXXX (Semaphore's canonical).
export function normalizePhLocal(raw: string): string | null {
  const e164 = normalizePhMobile(raw);
  if (!e164) return null;
  if (/^\+639\d{9}$/.test(e164)) return "0" + e164.slice(3);    // +639XXXXXXXXX -> 09XXXXXXXXX
  return null; // non-PH numbers are not sendable via Semaphore's PH gateway
}

export interface SmsInputs {
  id: string;
  fullName: string;
  mobile: string;
  link: string | null;
}

function smsBody(inp: SmsInputs): string {
  const firstName = (inp.fullName || "").trim().split(/\s+/)[0] || "visitor";
  return inp.link
    ? `Almario Residence: Thank you, ${firstName}. Your signed confidentiality agreement (${inp.id}) is ready: ${inp.link}`
    : `Almario Residence: Thank you, ${firstName}. Your signed confidentiality agreement (${inp.id}) has been recorded.`;
}

async function sendViaSemaphore(apiKey: string, inp: SmsInputs): Promise<string> {
  const number = normalizePhLocal(inp.mobile);
  if (!number) return `failed: unrecognized PH mobile number format (${String(inp.mobile).slice(0, 30)})`;
  try {
    const resp = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        apikey: apiKey,
        number,
        message: smsBody(inp),
        // Only pass sendername when explicitly configured; otherwise let the
        // Semaphore account default apply (custom names require approval).
        ...(Netlify.env.get("SEMAPHORE_SENDER") ? { sendername: Netlify.env.get("SEMAPHORE_SENDER")! } : {}),
      }).toString(),
    });
    let data: any = null;
    let text = "";
    try {
      text = await resp.text();
      data = JSON.parse(text);
    } catch { /* non-JSON body */ }
    if (resp.status === 200) {
      // Success responses contain the created message(s) with ids.
      const first = Array.isArray(data) ? data[0] : data;
      if (first && (first.message_id || first.id || first.status)) return "sent";
      return `failed: unexpected Semaphore response ${String(text).slice(0, 140)}`;
    }
    const detail = data?.message || data?.error || text;
    return `failed: HTTP ${resp.status}${detail ? " " + String(detail).slice(0, 140) : ""}`;
  } catch (e: any) {
    return `failed: ${String(e?.message || e).slice(0, 160)}`;
  }
}

async function sendViaTwilio(sid: string, token: string, from: string, inp: SmsInputs): Promise<string> {
  const to = normalizePhMobile(inp.mobile);
  if (!to) return `failed: unrecognized mobile number format (${String(inp.mobile).slice(0, 30)})`;
  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: smsBody(inp) }).toString(),
      }
    );
    if (resp.status === 200 || resp.status === 201) return "sent";
    let detail = "";
    try {
      const j: any = await resp.json();
      detail = j?.message || j?.error_message || "";
    } catch { /* ignore */ }
    return `failed: HTTP ${resp.status}${detail ? " " + String(detail).slice(0, 140) : ""}`;
  } catch (e: any) {
    return `failed: ${String(e?.message || e).slice(0, 160)}`;
  }
}

// Returns smsStatus: "sent" | "pending: no credentials" | "failed: ..."
export async function sendSubmissionSms(inp: SmsInputs): Promise<string> {
  const semaphoreKey = Netlify.env.get("SEMAPHORE_API_KEY");
  if (semaphoreKey) return sendViaSemaphore(semaphoreKey, inp);

  const sid = Netlify.env.get("TWILIO_ACCOUNT_SID");
  const token = Netlify.env.get("TWILIO_AUTH_TOKEN");
  const from = Netlify.env.get("TWILIO_FROM");
  if (sid && token && from) return sendViaTwilio(sid, token, from, inp);

  return "pending: no credentials";
}
