// TEMPORARY maintenance endpoint: releases the unused Twilio number, then this file is removed.
import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Netlify.env.get("ADMIN_PASSCODE") || "";
  const given = req.headers.get("x-admin-passcode") || "";
  if (!expected || given !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const sid = Netlify.env.get("TWILIO_ACCOUNT_SID");
  const tok = Netlify.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !tok) return Response.json({ error: "no twilio credentials" }, { status: 400 });
  const auth = "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64");
  const list = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { authorization: auth } }
  ).then((r) => r.json());
  const numbers = (list.incoming_phone_numbers || []).map((n: any) => n.phone_number);
  const target = (list.incoming_phone_numbers || []).find((n: any) => n.phone_number === "+19389991071");
  if (!target) return Response.json({ error: "number not found", numbers }, { status: 404 });
  const del = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${target.sid}.json`,
    { method: "DELETE", headers: { authorization: auth } }
  );
  return Response.json({ released: del.status === 204, httpStatus: del.status, number: target.phone_number });
};

export const config: Config = {
  path: "/api/twilio-release",
};
