// SMS notification via the Twilio REST API (plain fetch; no twilio package).
// Failures must never fail a submission — always resolve to a status string.

// Normalize Philippine mobile formats to E.164 (+63...).
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

export interface SmsInputs {
  id: string;
  fullName: string;
  mobile: string;
  link: string | null;
}

// Returns smsStatus: "sent" | "pending: no credentials" | "failed: ..."
export async function sendSubmissionSms(inp: SmsInputs): Promise<string> {
  const sid = Netlify.env.get("TWILIO_ACCOUNT_SID");
  const token = Netlify.env.get("TWILIO_AUTH_TOKEN");
  const from = Netlify.env.get("TWILIO_FROM");
  if (!sid || !token || !from) return "pending: no credentials";

  const to = normalizePhMobile(inp.mobile);
  if (!to) return `failed: unrecognized mobile number format (${String(inp.mobile).slice(0, 30)})`;

  const firstName = (inp.fullName || "").trim().split(/\s+/)[0] || "visitor";
  const body = inp.link
    ? `Almario Residence: Thank you, ${firstName}. Your signed confidentiality agreement (${inp.id}) is ready: ${inp.link}`
    : `Almario Residence: Thank you, ${firstName}. Your signed confidentiality agreement (${inp.id}) has been recorded.`;

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
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
