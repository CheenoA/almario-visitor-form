// Tokenized receipt download: GET /api/receipt/{id}?t={hmac}
// Streams the signed PDF when the token is valid; otherwise 404 (never 401,
// to avoid leaking whether a submission id exists).
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { verifyReceiptToken } from "../lib/receipt.mts";

const SAFE_ID = /^ARV-[A-Z0-9-]{4,40}$/;

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") return notFound();
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","receipt", id]
  const id = decodeURIComponent(parts[2] || "");
  const token = url.searchParams.get("t") || "";

  if (!SAFE_ID.test(id)) return notFound();
  if (!verifyReceiptToken(id, token)) return notFound(); // also 404 when LINK_SECRET unset

  const store = getStore({ name: "submissions", consistency: "strong" });
  const pdf = await store.get(`pdfs/${id}.pdf`, { type: "arrayBuffer" });
  if (!pdf) return notFound();

  return new Response(pdf, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Almario-Residence-NDA-${id}.pdf"`,
      "cache-control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/receipt/*",
};
