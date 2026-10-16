import nodemailer from "nodemailer";
import { getServerEnv, isEmailConfigured } from "@/lib/env";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const env = getServerEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

/**
 * Sends transactional email via SMTP when configured. Falls back to a server-side console log
 * in development/unconfigured environments so the auth flow stays testable without real
 * credentials — this must never happen in production because it silently "succeeds" without
 * delivering anything.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const env = getServerEnv();

  if (!isEmailConfigured(env)) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email provider is not configured; refusing to silently drop a production email.");
    }
    console.log(`[dev email] To: ${input.to} | Subject: ${input.subject}\n${input.text}`);
    return;
  }

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
