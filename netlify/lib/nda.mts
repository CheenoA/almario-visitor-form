// Shared NDA content + PDF generation for the Almario Residence Visitor Form.
// NDA text reproduced verbatim from ARVMF NDA Template v2 — EVENT VERSION
// (Version 2.0, Effective July 25, 2026). The two owner-approved [GRAFT]
// paragraphs are rendered as normal paragraphs per owner instruction.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export const NDA_VERSION = "Version 2.0 Effective July 25, 2026";

export interface NdaFields {
  fullName: string;
  address: string;
  mobile: string;
  email: string;
  purpose: string;
  idType: string;
  eventName: string;
  eventDate: string;
  dateSigned: string; // e.g. "25th day of July, 2026"
}

export interface SubmissionMeta {
  id: string;
  timestampManila: string;
  timestampISO: string;
  ip: string;
  userAgent: string;
  integrityHash?: string;
}

type Block =
  | { t: "title"; text: string }
  | { t: "center"; text: string }
  | { t: "heading"; text: string }
  | { t: "para"; text: string }
  | { t: "letter"; label: string; text: string };

export function ndaBlocks(f: NdaFields): Block[] {
  return [
    { t: "title", text: "CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT" },
    { t: "para", text: "KNOW ALL MEN BY THESE PRESENTS:" },
    { t: "para", text: "This Confidentiality and Non-Disclosure Agreement is made and entered into by and between:" },
    { t: "para", text: "MARGARITA IGNACIA B. NOGRALES-ALMARIO, Filipino, married to CHEENO MIGUEL D. ALMARIO, of legal age, with address at 16 Solar, Bel Air Village, Makati City, hereinafter referred to as the \"DISCLOSING PARTY\";" },
    { t: "center", text: "- and -" },
    { t: "para", text: `${f.fullName} of legal age, Filipino, and with address ${f.address}, hereinafter referred to as the "RECIPIENT".` },
    { t: "para", text: "Both the DISCLOSING PARTY and RECIPIENT shall be collectively referred herein as \"PARTIES\"." },
    { t: "center", text: "WITNESSETH:" },
    { t: "para", text: `WHEREAS, the Disclosing Party is hosting a private ${f.eventName} event on ${f.eventDate};` },
    { t: "para", text: "WHEREAS, the Recipient has been engaged to provide catering and/or service assistance for the said event;" },
    { t: "para", text: "WHEREAS, in the course of such engagement, the Recipient may see, hear, or otherwise become aware of private and sensitive information relating to the Disclosing Party and her guests;" },
    { t: "para", text: "WHEREAS, the Disclosing Party requires that all such information be kept strictly confidential;" },
    { t: "para", text: "NOW, THEREFORE, for and in consideration of the foregoing, the PARTIES hereby agree as follows:" },
    { t: "heading", text: "1. CONFIDENTIAL INFORMATION." },
    { t: "para", text: "\"Confidential Information\" includes any non-public information observed, heard, or accessed during the event, including:" },
    { t: "letter", label: "a.", text: "Identities of guests and attendees" },
    { t: "letter", label: "b.", text: "Conversations, interactions, and activities" },
    { t: "letter", label: "c.", text: "Photos, videos, or recordings of the event" },
    { t: "letter", label: "d.", text: "Event details, setup, and program" },
    { t: "letter", label: "e.", text: "Any personal or private matters involving the Host or guests" },
    { t: "para", text: "All such information is confidential, whether or not labeled as such." },
    { t: "heading", text: "2. OBLIGATIONS OF THE RECIPIENT." },
    { t: "para", text: "The Recipient agrees to:" },
    { t: "letter", label: "a.", text: "Strict Non-Disclosure - Not disclose, release, share, confirm, deny, discuss, or otherwise communicate, directly or indirectly, any Confidential Information to any person or entity, at any time, without the prior written consent of the Disclosing Party." },
    { t: "letter", label: "b.", text: "Absolute Prohibition on Recording and Documentation - Not take, capture, record, store, reproduce, or retain any photographs, videos, audio recordings, screenshots, or any form of documentation of the event or any Confidential Information, whether using personal or third-party devices." },
    { t: "letter", label: "c.", text: "No Public or Online Disclosure - Not post, upload, transmit, or otherwise reference, directly or indirectly, any aspect of the event or Confidential Information on social media, messaging platforms, or any public or private online channels." },
    { t: "letter", label: "d.", text: "Duty of Care and Safeguards - Exercise the highest degree of care in handling Confidential Information and take all reasonable measures to prevent unauthorized access, disclosure, or misuse." },
    { t: "heading", text: "3. TERM." },
    { t: "para", text: `This Agreement shall take effect on ${f.dateSigned} and shall continue indefinitely, even after the event.` },
    { t: "heading", text: "4. RETURN OR DELETION." },
    { t: "para", text: "The Recipient shall immediately delete or surrender any materials containing Confidential Information, if any were created or obtained." },
    { t: "heading", text: "5. BREACH AND LIABILITY." },
    { t: "para", text: "Any breach of this Agreement shall:" },
    { t: "letter", label: "a.", text: "Result in immediate removal from the event; and" },
    { t: "letter", label: "b.", text: "Make the Recipient liable for liquidated damages of ₱50,000.00, without prejudice to other legal remedies." },
    { t: "heading", text: "6. VOLUNTARY AGREEMENT." },
    { t: "para", text: "The Recipient hereby acknowledges that he/she has carefully read and fully understood the terms and conditions of this Agreement, and that he/she voluntarily and knowingly agrees to be bound by the same." },
    { t: "para", text: "The Recipient further affirms that this Agreement is entered into freely, without force, intimidation, undue influence, or misrepresentation, and with full awareness of the rights and obligations arising herefrom." },
    { t: "para", text: "The Recipient agrees that this Agreement may be executed electronically. The Recipient's electronic signature, together with the identifying information, government-issued identification, date and time of submission, and electronic record associated with the execution, shall evidence the Recipient's intent to sign and be bound by this Agreement. An electronically generated or reproduced copy shall be treated as an original for evidentiary purposes, subject to applicable law." },
    { t: "para", text: "The Recipient authorizes the collection and processing of the personal information and identification submitted through this form solely for identity verification, security, administration, enforcement of this Agreement, and related lawful purposes. The information shall be accessible only to authorized persons and retained only for as long as reasonably necessary for such purposes, subject to applicable law." },
    { t: "para", text: `IN WITNESS WHEREOF, the parties have hereunto set their hands this ${f.dateSigned} at Makati City, Philippines.` },
  ];
}

// pdf-lib standard fonts use WinAnsi encoding; U+20B1 (peso sign) is not encodable.
function sanitize(s: string): string {
  return s
    .replace(/₱/g, "Php")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "–")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2022]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 66;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildNdaPdf(
  fields: NdaFields,
  meta: SubmissionMeta,
  signaturePng: Uint8Array,
  idPhoto: { bytes: Uint8Array; mime: string } | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Almario Residence Visitor Form - Confidentiality and Non-Disclosure Agreement");
  doc.setSubject(`Submission ${meta.id}`);
  doc.setCreator("Almario Residence Visitor Form");

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.11, 0.1, 0.09);
  const faint = rgb(0.45, 0.42, 0.38);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const footer = (p: PDFPage) => {
    const txt = sanitize(`Almario Residence Visitor Form  –  Submission ${meta.id}  –  ${NDA_VERSION}`);
    const w = sans.widthOfTextAtSize(txt, 7.5);
    p.drawText(txt, { x: (PAGE_W - w) / 2, y: 36, size: 7.5, font: sans, color: faint });
  };
  footer(page);

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    footer(page);
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN + 24) newPage();
  };

  const drawLines = (
    lines: string[],
    font: PDFFont,
    size: number,
    leading: number,
    x: number,
    opts: { center?: boolean; color?: ReturnType<typeof rgb> } = {}
  ) => {
    for (const ln of lines) {
      need(leading);
      const xx = opts.center ? (PAGE_W - font.widthOfTextAtSize(ln, size)) / 2 : x;
      page.drawText(ln, { x: xx, y: y - size, size, font, color: opts.color ?? ink });
      y -= leading;
    }
  };

  // Letterhead
  const head = "ALMARIO RESIDENCE";
  const headSize = 13;
  page.drawText(head, {
    x: (PAGE_W - serifBold.widthOfTextAtSize(head, headSize)) / 2,
    y: y - headSize,
    size: headSize,
    font: serifBold,
    color: ink,
  });
  y -= 20;
  const sub = "Visitor Management Form";
  page.drawText(sub, { x: (PAGE_W - sans.widthOfTextAtSize(sub, 8.5)) / 2, y: y - 8.5, size: 8.5, font: sans, color: faint });
  y -= 16;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: faint });
  y -= 24;

  const BODY = 10.5;
  const LEAD = 15.5;

  for (const b of ndaBlocks(fields)) {
    if (b.t === "title") {
      const lines = wrapText(sanitize(b.text), serifBold, 12.5, CONTENT_W);
      need(lines.length * 17 + 10);
      drawLines(lines, serifBold, 12.5, 17, MARGIN, { center: true });
      y -= 12;
    } else if (b.t === "center") {
      const lines = wrapText(sanitize(b.text), serifBold, BODY, CONTENT_W);
      drawLines(lines, serifBold, BODY, LEAD, MARGIN, { center: true });
      y -= 6;
    } else if (b.t === "heading") {
      need(LEAD + 8);
      y -= 4;
      drawLines([sanitize(b.text)], serifBold, 11, LEAD, MARGIN);
      y -= 3;
    } else if (b.t === "letter") {
      const bx = MARGIN + 24;
      const lines = wrapText(sanitize(b.text), serif, BODY, CONTENT_W - 36);
      need(Math.min(lines.length, 2) * LEAD);
      page.drawText(sanitize(b.label), { x: MARGIN + 6, y: y - BODY, size: BODY, font: serif, color: ink });
      drawLines(lines, serif, BODY, LEAD, bx);
      y -= 3;
    } else {
      const lines = wrapText(sanitize(b.text), serif, BODY, CONTENT_W);
      drawLines(lines, serif, BODY, LEAD, MARGIN);
      y -= 7;
    }
  }

  // ---- Signature block ----
  need(160);
  y -= 14;
  const colW = (CONTENT_W - 40) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 40;
  const blockTop = y;

  try {
    const sigImg = await doc.embedPng(signaturePng);
    const maxSigW = colW;
    const maxSigH = 62;
    const scale = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height, 1);
    const sw = sigImg.width * scale;
    const sh = sigImg.height * scale;
    page.drawImage(sigImg, { x: rightX + (colW - sw) / 2, y: blockTop - sh, width: sw, height: sh });
  } catch {
    // signature failed to embed; line will remain blank
  }
  y = blockTop - 68;

  page.drawLine({ start: { x: leftX, y }, end: { x: leftX + colW, y }, thickness: 0.8, color: ink });
  page.drawLine({ start: { x: rightX, y }, end: { x: rightX + colW, y }, thickness: 0.8, color: ink });
  y -= 13;

  const cap = (txt: string, x: number, w: number, font: PDFFont, size: number, dy: number) => {
    const lines = wrapText(sanitize(txt), font, size, w);
    let yy = y;
    for (const ln of lines) {
      page.drawText(ln, { x: x + (w - font.widthOfTextAtSize(ln, size)) / 2, y: yy - size, size, font, color: ink });
      yy -= dy;
    }
    return yy;
  };
  const yl = cap("MARGARITA IGNACIA B. NOGRALES-ALMARIO", leftX, colW, serifBold, 9.5, 12);
  const yr = cap(fields.fullName.toUpperCase(), rightX, colW, serifBold, 9.5, 12);
  const yy = Math.min(yl, yr);
  page.drawText("Disclosing Party", {
    x: leftX + (colW - serif.widthOfTextAtSize("Disclosing Party", 9)) / 2,
    y: yy - 9, size: 9, font: serif, color: faint,
  });
  page.drawText("Recipient", {
    x: rightX + (colW - serif.widthOfTextAtSize("Recipient", 9)) / 2,
    y: yy - 9, size: 9, font: serif, color: faint,
  });
  y = yy - 34;

  // ---- Witness lines ----
  need(96);
  drawLines(["Signed in the presence of witnesses"], serif, BODY, LEAD, MARGIN);
  drawLines(["(Signature over printed name):"], serif, BODY, LEAD, MARGIN);
  y -= 26; // space above the witness signature lines
  need(30);
  const wColW = (CONTENT_W - 60) / 2;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + wColW, y }, thickness: 0.8, color: ink });
  page.drawLine({ start: { x: MARGIN + wColW + 60, y }, end: { x: MARGIN + wColW + 60 + wColW, y }, thickness: 0.8, color: ink });
  y -= 20;
  drawLines([NDA_VERSION], serif, 9, 13, MARGIN, { color: faint });

  // ---- ID photo page ----
  if (idPhoto) {
    newPage();
    page.drawText("GOVERNMENT-ISSUED IDENTIFICATION", {
      x: MARGIN, y: y - 13, size: 13, font: sansBold, color: ink,
    });
    y -= 22;
    const lbl = sanitize(`${fields.idType} – presented by ${fields.fullName} (Submission ${meta.id})`);
    page.drawText(lbl, { x: MARGIN, y: y - 9.5, size: 9.5, font: sans, color: faint });
    y -= 24;
    try {
      const img = idPhoto.mime.includes("png")
        ? await doc.embedPng(idPhoto.bytes)
        : await doc.embedJpg(idPhoto.bytes);
      const maxW = CONTENT_W;
      const maxH = y - MARGIN - 20;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
    } catch {
      page.drawText("ID photo could not be embedded.", { x: MARGIN, y: y - 10, size: 10, font: sans, color: ink });
    }
  }

  // ---- Metadata page ----
  newPage();
  page.drawText("SUBMISSION RECORD", { x: MARGIN, y: y - 13, size: 13, font: sansBold, color: ink });
  y -= 22;
  page.drawText("Electronic execution details recorded by the Almario Residence Visitor Form.", {
    x: MARGIN, y: y - 9.5, size: 9.5, font: sans, color: faint,
  });
  y -= 30;

  const rows: [string, string][] = [
    ["Submission ID", meta.id],
    ["Signed at (Asia/Manila)", meta.timestampManila],
    ["Timestamp (UTC / ISO 8601)", meta.timestampISO],
    ["Recipient name", fields.fullName],
    ["Recipient address", fields.address],
    ["Mobile number", fields.mobile],
    ["Email address", fields.email || "not provided"],
    ["Purpose of visit", fields.purpose],
    ["Event name", fields.eventName],
    ["Event date", fields.eventDate],
    ["Government ID type", fields.idType],
    ["IP address", meta.ip],
    ["Device / user agent", meta.userAgent],
  ];
  if (meta.integrityHash) {
    rows.push(["Record integrity hash (SHA-256)", meta.integrityHash]);
  }
  for (const [k, v] of rows) {
    const keyLines = wrapText(sanitize(k), sansBold, 9.5, 160);
    const valLines = wrapText(sanitize(v || "–"), sans, 9.5, CONTENT_W - 180);
    const rh = Math.max(keyLines.length, valLines.length) * 14 + 8;
    need(rh);
    let ky = y;
    for (const ln of keyLines) { page.drawText(ln, { x: MARGIN, y: ky - 9.5, size: 9.5, font: sansBold, color: ink }); ky -= 14; }
    let vy = y;
    for (const ln of valLines) { page.drawText(ln, { x: MARGIN + 180, y: vy - 9.5, size: 9.5, font: sans, color: ink }); vy -= 14; }
    y -= rh;
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, thickness: 0.4, color: rgb(0.85, 0.83, 0.8) });
  }
  y -= 18;
  const note =
    "This document was executed electronically through the Almario Residence Visitor Form. The electronic signature, identifying information, government-issued identification, and the details above evidence the Recipient's intent to sign and be bound by this Agreement.";
  drawLines(wrapText(sanitize(note), sans, 8.5, CONTENT_W), sans, 8.5, 12, MARGIN, { color: faint });

  // ---- Acknowledgment page ----
  newPage();
  const ackTitle = "ACKNOWLEDGMENT";
  page.drawText(ackTitle, {
    x: (PAGE_W - serifBold.widthOfTextAtSize(ackTitle, 13)) / 2,
    y: y - 13, size: 13, font: serifBold, color: ink,
  });
  y -= 34;
  drawLines(["Republic of the Philippines )"], serif, BODY, LEAD, MARGIN);
  drawLines(["City of Makati              ) S.S."], serif, BODY, LEAD, MARGIN);
  drawLines(["x--------------------------------------------x"], serif, BODY, LEAD, MARGIN);
  y -= 10;
  drawLines(
    wrapText(
      sanitize("BEFORE ME, a Notary Public for and in Makati City, Philippines, on ____________________, personally came and appeared the following parties, with their competent evidence of identity:"),
      serif, BODY, CONTENT_W
    ),
    serif, BODY, LEAD, MARGIN
  );
  y -= 10;

  // Identity table: header + two rows
  const col1W = 200;
  const col2W = CONTENT_W - col1W;
  const tableRows: [string, string][] = [
    ["NAME", "Competent Evidence of Identity"],
    ["MARGARITA IGNACIA B. NOGRALES-ALMARIO", "Driver's License with License No.B04-07-005555 valid until 29 September 2034"],
    [fields.fullName, `${fields.idType} (photo on file)`],
  ];
  const lineCol = rgb(0.6, 0.57, 0.53);
  tableRows.forEach((tr, idx) => {
    const font1 = idx === 0 ? sansBold : serif;
    const font2 = idx === 0 ? sansBold : serif;
    const size = idx === 0 ? 9.5 : 10;
    const l1 = wrapText(sanitize(tr[0]), font1, size, col1W - 16);
    const l2 = wrapText(sanitize(tr[1]), font2, size, col2W - 16);
    const rh = Math.max(l1.length, l2.length) * 13 + 12;
    need(rh + 4);
    page.drawRectangle({ x: MARGIN, y: y - rh, width: col1W, height: rh, borderColor: lineCol, borderWidth: 0.6 });
    page.drawRectangle({ x: MARGIN + col1W, y: y - rh, width: col2W, height: rh, borderColor: lineCol, borderWidth: 0.6 });
    let ty = y - 6;
    for (const ln of l1) { page.drawText(ln, { x: MARGIN + 8, y: ty - size, size, font: font1, color: ink }); ty -= 13; }
    ty = y - 6;
    for (const ln of l2) { page.drawText(ln, { x: MARGIN + col1W + 8, y: ty - size, size, font: font2, color: ink }); ty -= 13; }
    y -= rh;
  });
  y -= 16;

  drawLines(
    wrapText(
      sanitize("All known to me, and to me known to be the same persons who executed the foregoing Confidentiality and Non-Disclosure Agreement, consisting of three (3) pages, including this Acknowledgment, and acknowledged to me that the same is their free and voluntary act and deed."),
      serif, BODY, CONTENT_W
    ),
    serif, BODY, LEAD, MARGIN
  );
  y -= 14;
  drawLines(["Doc No. ___;"], serif, BODY, LEAD, MARGIN);
  drawLines(["Page No. ___;"], serif, BODY, LEAD, MARGIN);
  drawLines(["Book No. ___;"], serif, BODY, LEAD, MARGIN);
  drawLines(["Series of 2026."], serif, BODY, LEAD, MARGIN);

  return await doc.save();
}

export function manilaDateSigned(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === "day")?.value || "1");
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${ord(day)} day of ${month}, ${year}`;
}

export function manilaTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(d) + " (Asia/Manila)";
}
