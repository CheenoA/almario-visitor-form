import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { timingSafeEqualStr, checkThrottle, recordFailure, clearThrottle } from "../lib/auth.mts";
import { deliverEmailsForSubmission } from "../lib/deliver.mts";

function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

async function authorized(req: Request, context: Context): Promise<{ ok: boolean; resp?: Response }> {
  const expected = Netlify.env.get("ADMIN_PASSCODE");
  if (!expected) return { ok: false, resp: json(503, { ok: false, error: "ADMIN_PASSCODE is not configured on the server." }) };

  const ip = String(
    (context as any)?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown"
  );

  // Brute-force throttle: after 5 failures in 15 minutes, block until cooldown.
  const throttle = await checkThrottle(ip);
  if (throttle.blocked) {
    return {
      ok: false,
      resp: json(
        429,
        { ok: false, error: `Too many failed attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minute(s).` },
        { "retry-after": String(throttle.retryAfterSeconds) }
      ),
    };
  }

  const given = req.headers.get("x-admin-passcode") || "";
  if (!timingSafeEqualStr(given, expected)) {
    await recordFailure(ip);
    return { ok: false, resp: json(401, { ok: false, error: "Invalid passcode." }) };
  }
  await clearThrottle(ip);
  return { ok: true };
}

const SAFE_ID = /^ARV-[A-Z0-9-]{4,40}$/;

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","admin", action, id?]
  const action = parts[2] || "";
  const id = decodeURIComponent(parts[3] || "");

  const auth = await authorized(req, context);
  if (!auth.ok) return auth.resp!;

  const store = getStore({ name: "submissions", consistency: "strong" });

  // POST /api/admin/login — passcode validity check (auth already passed)
  if (action === "login" && req.method === "POST") {
    return json(200, { ok: true });
  }


  // GET /api/admin/submissions
  if (action === "submissions" && req.method === "GET") {
    const { blobs } = (await store.list({ prefix: "records/" })) as { blobs: { key: string }[] };
    const records: any[] = [];
    await Promise.all(
      blobs.map(async (b) => {
        try {
          const rec = await store.get(b.key, { type: "json" });
          if (rec) {
            delete rec.idPhotoMime;
            records.push(rec);
          }
        } catch (e) {
          console.error("Failed to read record", b.key, e);
        }
      })
    );
    records.sort((a, b) => String(b.submittedAtISO).localeCompare(String(a.submittedAtISO)));
    return json(200, { ok: true, count: records.length, submissions: records });
  }

  // Remaining routes operate on a single submission id
  if (!SAFE_ID.test(id)) return json(400, { ok: false, error: "Invalid or missing submission id." });

  const getRecord = async () => (await store.get(`records/${id}.json`, { type: "json" })) as any | null;

  // GET /api/admin/pdf/:id
  if (action === "pdf" && req.method === "GET") {
    const pdf = await store.get(`pdfs/${id}.pdf`, { type: "arrayBuffer" });
    if (!pdf) return json(404, { ok: false, error: "PDF not found." });
    return new Response(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="Almario-Residence-NDA-${id}.pdf"`,
      },
    });
  }

  // GET /api/admin/id/:id — the government ID photo
  if (action === "id" && req.method === "GET") {
    const rec = await getRecord();
    if (!rec) return json(404, { ok: false, error: "Record not found." });
    const img = await store.get(rec.idPhotoKey, { type: "arrayBuffer" });
    if (!img) return json(404, { ok: false, error: "ID photo not found." });
    return new Response(img, {
      status: 200,
      headers: { "content-type": rec.idPhotoMime || "image/jpeg" },
    });
  }

  // POST /api/admin/resend/:id — reuses the same delivery path as the
  // background sender (load from Blobs, send, update record).
  if (action === "resend" && req.method === "POST") {
    const rec = await getRecord();
    if (!rec) return json(404, { ok: false, error: "Record not found." });
    try {
      const { emailStatus, smsStatus } = await deliverEmailsForSubmission(id);
      return json(200, { ok: true, id, emailStatus, smsStatus });
    } catch (e: any) {
      return json(500, { ok: false, error: String(e?.message || e).slice(0, 200) });
    }
  }

  // DELETE /api/admin/submission/:id
  if (action === "submission" && req.method === "DELETE") {
    const rec = await getRecord();
    if (!rec) return json(404, { ok: false, error: "Record not found." });
    await store.delete(`pdfs/${id}.pdf`);
    if (rec.idPhotoKey) await store.delete(rec.idPhotoKey);
    await store.delete(`records/${id}.json`);
    return json(200, { ok: true, deleted: id });
  }

  return json(404, { ok: false, error: "Unknown admin endpoint." });
};

export const config: Config = {
  path: "/api/admin/*",
};
