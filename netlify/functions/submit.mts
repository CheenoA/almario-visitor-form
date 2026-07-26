import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { buildNdaPdf, manilaDateSigned, manilaTimestamp, NDA_VERSION, type NdaFields } from "../lib/nda.mts";

const MAX_BODY = 5_800_000; // stay under Netlify's ~6MB function payload limit

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseDataUrl(dataUrl: string, allowed: string[]): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!allowed.includes(mime)) return null;
  try {
    return { bytes: new Uint8Array(Buffer.from(m[2], "base64")), mime };
  } catch {
    return null;
  }
}

function makeId(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now).replace(/-/g, "");
  const rand = Array.from({ length: 5 }, () =>
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]
  ).join("");
  return `ARV-${parts}-${rand}`;
}

const clean = (v: unknown, max: number) =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json(400, { ok: false, error: "Unable to read request body" });
  }
  if (raw.length > MAX_BODY) {
    return json(413, {
      ok: false,
      error: "Submission too large. Please retake the ID photo (it must be under about 4 MB) and try again.",
    });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const fullName = clean(body.fullName, 120);
  const address = clean(body.address, 300);
  const mobile = clean(body.mobile, 40);
  const email = clean(body.email, 160);
  const purpose = clean(body.purpose, 300);
  const idType = clean(body.idType, 60);

  // Event: the admin-configured "current event" wins; otherwise the kiosk's
  // manually entered values are used.
  let eventName = "";
  let eventDate = "";
  let eventSource = "manual";
  try {
    const cfgStore = getStore({ name: "config", consistency: "strong" });
    const cfg = (await cfgStore.get("current-event", { type: "json" })) as any | null;
    if (cfg && typeof cfg.eventName === "string" && cfg.eventName.trim()) {
      eventName = clean(cfg.eventName, 120);
      eventDate = clean(cfg.eventDate, 80);
      eventSource = "config";
    }
  } catch {
    // fall through to manual values
  }
  if (eventSource === "manual") {
    eventName = clean(body.eventName, 120);
    eventDate = clean(body.eventDate, 80);
  }

  const errors: string[] = [];
  if (eventName.length < 2) errors.push("Event name is required.");
  if (eventDate.length < 2) errors.push("Event date is required.");
  if (fullName.length < 2) errors.push("Full name is required.");
  if (address.length < 5) errors.push("Address is required.");
  if (!/^[+\d][\d\s()-]{6,}$/.test(mobile)) errors.push("A valid mobile number is required.");
  // Email is optional; validate the format only when one was provided.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("The email address entered is not valid.");
  if (purpose.length < 2) errors.push("Purpose of visit is required.");
  if (idType.length < 2) errors.push("Government ID type is required.");
  if (body.agreed !== true) errors.push("You must agree to the NDA.");

  const signature = parseDataUrl(body.signature, ["image/png"]);
  if (!signature || signature.bytes.length < 200) errors.push("A drawn signature is required.");
  if (signature && signature.bytes.length > 1_500_000) errors.push("Signature image is too large.");

  const idPhoto = parseDataUrl(body.idPhoto, ["image/jpeg", "image/jpg", "image/png"]);
  if (!idPhoto || idPhoto.bytes.length < 1000) errors.push("A photo of your government ID is required.");
  if (idPhoto && idPhoto.bytes.length > 4_500_000) errors.push("ID photo is too large. Please retake it.");

  if (errors.length) return json(422, { ok: false, error: errors.join(" "), errors });

  const now = new Date();
  const store = getStore({ name: "submissions", consistency: "strong" });

  // Generate an id, guarding against (unlikely) collisions.
  let id = makeId(now);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const existing = await store.getMetadata(`records/${id}.json`);
      if (!existing) break;
    } catch {
      break; // metadata check failing must not block a submission
    }
    id = makeId(now);
  }

  const ip =
    (context as any).ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const timestampManila = manilaTimestamp(now);

  const fields: NdaFields = {
    fullName, address, mobile, email, purpose, idType, eventName, eventDate,
    dateSigned: manilaDateSigned(now),
  };

  // Audit hash: SHA-256 over canonical JSON of the signed content.
  const signatureB64 = String(body.signature).replace(/^data:[^,]+,/, "");
  const canonical = JSON.stringify({
    id,
    fields: { fullName, address, mobile, email, purpose, idType, eventName, eventDate },
    timestampISO: now.toISOString(),
    signature: signatureB64,
  });
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const integritySha256 = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildNdaPdf(
      fields,
      { id, timestampManila, timestampISO: now.toISOString(), ip: String(ip), userAgent, integrityHash: integritySha256 },
      signature!.bytes,
      idPhoto!
    );
  } catch (e: any) {
    console.error("PDF generation failed", e);
    return json(500, { ok: false, error: "Could not generate the agreement PDF. Please try again." });
  }

  // Store first — a signed record must never be lost because email failed.
  const idExt = idPhoto!.mime.includes("png") ? "png" : "jpg";
  const record: Record<string, unknown> = {
    id,
    fullName, address, mobile, email, purpose, idType,
    eventName, eventDate, eventSource,
    ndaVersion: NDA_VERSION,
    submittedAtISO: now.toISOString(),
    submittedAtManila: timestampManila,
    ip: String(ip),
    userAgent,
    pdfKey: `pdfs/${id}.pdf`,
    idPhotoKey: `ids/${id}.${idExt}`,
    idPhotoMime: idPhoto!.mime,
    integritySha256,
    emailStatus: "queued",
    smsStatus: "queued",
  };

  try {
    await store.set(`pdfs/${id}.pdf`, pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer);
    await store.set(`ids/${id}.${idExt}`, idPhoto!.bytes.buffer.slice(idPhoto!.bytes.byteOffset, idPhoto!.bytes.byteOffset + idPhoto!.bytes.byteLength) as ArrayBuffer);
    await store.setJSON(`records/${id}.json`, record);
  } catch (e: any) {
    console.error("Blob storage failed", e);
    return json(500, { ok: false, error: "Could not store the submission. Please try again." });
  }

  // Queue email delivery in the background so the kiosk never waits on SMTP.
  // The background function returns 202 immediately and then delivers.
  let emailStatus = "queued";
  try {
    const origin = new URL(req.url).origin;
    const invoke = await fetch(`${origin}/.netlify/functions/send-emails-background`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${Netlify.env.get("ADMIN_PASSCODE") || ""}`,
      },
      body: JSON.stringify({ id }),
    });
    if (invoke.status !== 202 && invoke.status !== 200) {
      emailStatus = `failed: could not queue email delivery (HTTP ${invoke.status})`;
    }
  } catch (e: any) {
    emailStatus = `failed: could not queue email delivery (${String(e?.message || e).slice(0, 140)})`;
  }
  if (emailStatus !== "queued") {
    record.emailStatus = emailStatus;
    record.smsStatus = emailStatus; // same queue failure applies to SMS
    try {
      await store.setJSON(`records/${id}.json`, record);
    } catch (e) {
      console.error("Failed to update emailStatus on record", e);
    }
  }

  return json(200, { ok: true, id, emailStatus, signedAt: timestampManila });
};

export const config: Config = {
  path: "/api/submit",
};
