import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

const shell = (title: string, content: string) => `<!doctype html><html><body style="margin:0;background:#080808;color:#f4f1eb;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:42px 24px"><div style="border-top:4px solid #fd7803;background:#121212;padding:32px"><p style="margin:0 0 12px;color:#fd7803;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">210 Robotics</p><h1 style="margin:0 0 20px;font-size:28px">${escapeHtml(title)}</h1>${content}<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #333;color:#999;font-size:12px">UT San Antonio · Student-led engineering</p></div></div></body></html>`;

export function adminInquiryEmail(input: { kind: string; name: string; email: string; organization?: string | null; interest?: string | null; message: string }) {
  return shell(`New ${input.kind} inquiry`, `<p style="line-height:1.7"><strong>${escapeHtml(input.name)}</strong><br>${escapeHtml(input.email)}${input.organization ? `<br>${escapeHtml(input.organization)}` : ""}${input.interest ? `<br>Interest: ${escapeHtml(input.interest)}` : ""}</p><p style="line-height:1.7;white-space:pre-wrap">${escapeHtml(input.message)}</p><p><a style="color:#fd7803" href="https://portal.210robotics.com/admin?tab=inquiries">Open the inquiry inbox</a></p>`);
}

export function confirmationEmail(name: string, kind: string) {
  const next = kind === "join" ? "A team officer will follow up with meeting and onboarding details." : kind === "sponsor" ? "Our partnerships team will review your note and follow up directly." : "A 210 Robotics officer will review your message and respond soon.";
  return shell("We received your message", `<p style="line-height:1.7">Hi ${escapeHtml(name)},</p><p style="line-height:1.7">Thanks for reaching out to 210 Robotics. ${escapeHtml(next)}</p><p style="line-height:1.7">You can reply to this email if you need to add anything.</p>`);
}

export function universityVerificationEmail(code: string) {
  return shell(
    "Verify your UTSA email",
    `<p style="line-height:1.7">Enter this one-time code in the 210 Robotics verification page:</p><p style="margin:28px 0;padding:20px;background:#080808;border:1px solid #333;color:#fff;font-size:32px;font-weight:800;letter-spacing:10px;text-align:center">${escapeHtml(code)}</p><p style="line-height:1.7;color:#bbb">This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p>`,
  );
}
