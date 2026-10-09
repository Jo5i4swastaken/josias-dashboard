import { afterEach, describe, expect, it } from "vitest";
import { mailTransport } from "@/lib/mailer";

describe("mail transport", () => {
  const original = {
    resend: process.env.RESEND_API_KEY,
    smtp: process.env.SMTP_HOST,
  };

  afterEach(() => {
    if (original.resend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original.resend;
    if (original.smtp === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = original.smtp;
  });

  it("prefers Resend, then SMTP, then a dev log", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    expect(mailTransport()).toBe("dev");

    process.env.SMTP_HOST = "smtp.example.com";
    expect(mailTransport()).toBe("smtp");

    process.env.RESEND_API_KEY = "re_test";
    expect(mailTransport()).toBe("resend");
  });
});
