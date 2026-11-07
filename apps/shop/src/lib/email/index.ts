import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Envoi d'emails transactionnels. En développement (EMAIL_DRIVER=console), le
 * message est affiché dans la console du serveur au lieu d'être envoyé.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (env.emailDriver === "resend" && env.resendApiKey) {
    const resend = new Resend(env.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      headers: msg.headers,
    });
    if (error) {
      console.error("[email] échec d'envoi", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  }
  console.info(`\n[email:console] → ${msg.to}\nSujet : ${msg.subject}\n${msg.text ?? msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n`);
  return { ok: true, id: "console" };
}
