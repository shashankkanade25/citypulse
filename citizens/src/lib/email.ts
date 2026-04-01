import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const EMAIL_USER = process.env.EMAIL_USER!;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD!;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "CityPulse";

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Send an email via Gmail SMTP (App Password).
 * Works with single or multiple recipients.
 */
export async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
  try {
    console.log(`[Email] Preparing to send "${subject}" to ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`[Email] EMAIL_USER=${EMAIL_USER ? '\u2713 set' : '\u2717 MISSING'}`);
    console.log(`[Email] EMAIL_PASSWORD=${EMAIL_PASSWORD ? '\u2713 set' : '\u2717 MISSING'}`);

    const transporter = createTransporter();
    const recipients = Array.isArray(to) ? to.join(", ") : to;

    const info = await transporter.sendMail({
      from: `${EMAIL_FROM_NAME} <${EMAIL_USER}>`,
      to: recipients,
      subject,
      html,
    });

    console.log(`[Email] \u2705 SUCCESS \u2014 Sent "${subject}" to ${recipients}`);
    console.log(`[Email] Message ID: ${(info as SMTPTransport.SentMessageInfo).messageId}`);
  } catch (error) {
    console.error("[Email] \u274c FAILED to send email:", error);
    // Don't throw \u2014 email failures should not break the main flow
  }
}
