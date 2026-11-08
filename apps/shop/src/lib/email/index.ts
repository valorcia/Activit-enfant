import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { getSecretStatus, getSecret } from "@/lib/integrations/secrets";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Envoi d'emails transactionnels via Resend. La clé saisie dans Administration →
 * Paramètres → Intégrations active Resend automatiquement ; une clé fournie
 * seulement par l'environnement (RESEND_API_KEY) exige EMAIL_DRIVER=resend.
 * Sans clé, le message est affiché dans la console du serveur (développement).
 */
async function resolveResendKey(): Promise<string | null> {
  const status = (await getSecretStatus()).find((s) => s.key === "resend.apiKey");
  if (status?.source === "database") return getSecret("resend.apiKey");
  if (env.emailDriver === "resend") return (await getSecret("resend.apiKey")) || null;
  return null;
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resendKey = await resolveResendKey();
  if (resendKey) {
    const resend = new Resend(resendKey);
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
