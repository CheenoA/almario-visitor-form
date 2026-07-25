// Loads a stored submission from Blobs, sends the emails, and updates the
// record's emailStatus. Shared by the background sender and the admin resend.
import { getStore } from "@netlify/blobs";
import { sendSubmissionEmails } from "./mailer.mts";

export async function deliverEmailsForSubmission(id: string): Promise<string> {
  const store = getStore({ name: "submissions", consistency: "strong" });
  const rec = (await store.get(`records/${id}.json`, { type: "json" })) as any | null;
  if (!rec) throw new Error(`Record not found for ${id}`);
  const pdf = await store.get(`pdfs/${id}.pdf`, { type: "arrayBuffer" });
  if (!pdf) throw new Error(`Stored PDF not found for ${id}`);

  let idPhoto: { bytes: Uint8Array; mime: string } | null = null;
  try {
    if (rec.idPhotoKey) {
      const img = await store.get(rec.idPhotoKey, { type: "arrayBuffer" });
      if (img) idPhoto = { bytes: new Uint8Array(img), mime: rec.idPhotoMime || "image/jpeg" };
    }
  } catch {
    // send without the photo rather than not at all
  }

  let emailStatus: string;
  try {
    emailStatus = await sendSubmissionEmails({
      id,
      fullName: rec.fullName,
      email: rec.email || "",
      purpose: rec.purpose,
      timestampManila: rec.submittedAtManila,
      pdfBytes: new Uint8Array(pdf),
      idPhoto,
    });
  } catch (e: any) {
    emailStatus = `failed: ${String(e?.message || e).slice(0, 200)}`;
  }

  rec.emailStatus = emailStatus;
  rec.emailLastAttemptAtISO = new Date().toISOString();
  await store.setJSON(`records/${id}.json`, rec);
  return emailStatus;
}
