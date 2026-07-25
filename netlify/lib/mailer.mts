// Email delivery via SMTP relay (Brevo by default; any SMTP via env).
// Sending failures must never fail a submission.
import nodemailer from "nodemailer";

export interface EmailInputs {
  id: string;
  fullName: string;
  email: string;
  purpose: string;
  timestampManila: string;
  pdfBytes: Uint8Array;
  idPhoto: { bytes: Uint8Array; mime: string } | null;
}

// Returns an emailStatus string: "sent" | "pending: no credentials" | "failed: ..."
export async function sendSubmissionEmails(inp: EmailInputs): Promise<string> {
  // Preferred: Brevo (or any SMTP relay) via SMTP_HOST/SMTP_PORT/SMTP_LOGIN/SMTP_KEY.
  // Legacy fallback: Gmail via GMAIL_USER/GMAIL_APP_PASSWORD.
  const smtpHost = Netlify.env.get("SMTP_HOST");
  const smtpLogin = Netlify.env.get("SMTP_LOGIN");
  const smtpKey = Netlify.env.get("SMTP_KEY");
  const gmailUser = Netlify.env.get("GMAIL_USER");
  const gmailPass = Netlify.env.get("GMAIL_APP_PASSWORD");
  const household = Netlify.env.get("HOUSEHOLD_EMAIL") || "almanograhousehold@gmail.com";
  const from = Netlify.env.get("MAIL_FROM") || gmailUser || household;

  let transportOpts: any = null;
  if (smtpHost && smtpLogin && smtpKey) {
    const port = parseInt(Netlify.env.get("SMTP_PORT") || "587", 10);
    transportOpts = { host: smtpHost, port, secure: port === 465, auth: { user: smtpLogin, pass: smtpKey } };
  } else if (gmailUser && gmailPass) {
    transportOpts = { host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmailUser, pass: gmailPass } };
  }
  if (!transportOpts) {
    return "pending: no credentials";
  }

  const transporter = nodemailer.createTransport({
    ...transportOpts,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  const user = from;

  const pdfName = `Almario-Residence-NDA-${inp.id}.pdf`;
  const pdfAttachment = { filename: pdfName, content: Buffer.from(inp.pdfBytes), contentType: "application/pdf" };

  const results: string[] = [];

  // 1) Email to the signer (only when the visitor provided an email address)
  if (!inp.email) {
    results.push("visitor: skipped (no email provided)");
  } else try {
    await transporter.sendMail({
      from: `"Almario Residence" <${user}>`,
      to: inp.email,
      subject: `Almario Residence – Your signed Visitor Confidentiality Agreement (${inp.id})`,
      text:
        `Dear ${inp.fullName},\n\n` +
        `Thank you for completing the Almario Residence Visitor Form.\n\n` +
        `Attached is your signed copy of the Visitor, Contractor, and Service Provider ` +
        `Confidentiality and Non-Disclosure Agreement, executed on ${inp.timestampManila}.\n\n` +
        `Submission reference: ${inp.id}\n\n` +
        `Please retain this copy for your records.\n\n` +
        `Almario Residence`,
      attachments: [pdfAttachment],
    });
    results.push("visitor: sent");
  } catch (e: any) {
    results.push(`visitor: failed (${String(e?.message || e).slice(0, 140)})`);
  }

  // 2) Email to the household
  try {
    const attachments: any[] = [pdfAttachment];
    if (inp.idPhoto) {
      const ext = inp.idPhoto.mime.includes("png") ? "png" : "jpg";
      attachments.push({
        filename: `ID-${inp.id}.${ext}`,
        content: Buffer.from(inp.idPhoto.bytes),
        contentType: inp.idPhoto.mime,
      });
    }
    await transporter.sendMail({
      from: `"Almario Residence Visitor Form" <${user}>`,
      to: household,
      subject: `Visitor signed: ${inp.fullName} – ${inp.purpose}`,
      text:
        `A visitor has signed the Confidentiality and Non-Disclosure Agreement.\n\n` +
        `Name: ${inp.fullName}\n` +
        `Purpose: ${inp.purpose}\n` +
        `Signed: ${inp.timestampManila}\n` +
        `Submission ID: ${inp.id}\n\n` +
        `The signed PDF and the visitor's government ID photo are attached.`,
      attachments,
    });
    results.push("household: sent");
  } catch (e: any) {
    results.push(`household: failed (${String(e?.message || e).slice(0, 140)})`);
  }

  const anyFailed = results.some((r) => r.includes("failed"));
  return anyFailed ? `failed: ${results.join("; ")}` : "sent";
}
