import { HttpError } from "@/lib/errors";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

export type MailTransport = "resend" | "smtp" | "dev";

export function mailTransport(): MailTransport {
  if (process.env.RESEND_API_KEY) {
    return "resend";
  }
  if (process.env.SMTP_HOST) {
    return "smtp";
  }
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(500, "Email is not configured. Set RESEND_API_KEY or SMTP_HOST.");
  }
  return "dev";
}

let devInbox: OutboundEmail | null = null;

/** Last message logged by the dev transport. Production never writes this. */
export function readDevInbox(): OutboundEmail | null {
  return devInbox;
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  const transport = mailTransport();
  const from = process.env.EMAIL_FROM?.trim();
  if (transport !== "dev" && !from) {
    throw new HttpError(500, "EMAIL_FROM is required to send sign-in codes.");
  }

  if (transport === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected the sign-in email", response.status);
      throw new HttpError(502, "The email provider rejected the sign-in code.");
    }
    return;
  }

  if (transport === "smtp") {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  devInbox = message;
  console.info(`[josias-dashboard] Dev email to ${message.to}\n${message.subject}\n${message.text}`);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "your email";
  }
  return `${local.slice(0, 1)}***@${domain}`;
}
