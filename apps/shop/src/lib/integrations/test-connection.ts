import "server-only";
import { getSecrets } from "./secrets";
import type { ServiceId } from "./services";

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 12_000;

async function http(url: string, init: RequestInit = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

function errorMessage(json: Record<string, unknown>): string {
  const err = json.error as { message?: string } | string | undefined;
  if (typeof err === "string") return err;
  return err?.message ?? (json.message as string | undefined) ?? "réponse inattendue";
}

const missing = (what: string): ConnectionTestResult => ({ ok: false, message: `${what} manquant(e) : enregistrez-la d'abord.` });

/**
 * Teste les clés effectives d'un service (base ou environnement) par un appel
 * en lecture seule. Les messages ne contiennent jamais la valeur des clés.
 */
export async function testServiceConnection(service: ServiceId): Promise<ConnectionTestResult> {
  try {
    switch (service) {
      case "stripe": {
        const s = await getSecrets(["stripe.secretKey", "stripe.webhookSecret"]);
        if (!s["stripe.secretKey"]) return missing("La clé secrète Stripe");
        const { default: Stripe } = await import("stripe");
        const balance = await new Stripe(s["stripe.secretKey"]).balance.retrieve();
        const mode = s["stripe.secretKey"].startsWith("sk_live_") ? "PRODUCTION" : "test";
        const webhook = s["stripe.webhookSecret"] ? "secret de webhook présent" : "secret de webhook ABSENT : les commandes ne seront pas livrées";
        return { ok: Boolean(s["stripe.webhookSecret"]), message: `Connexion Stripe réussie (mode ${mode}, ${balance.available.length} solde(s)) ; ${webhook}.` };
      }
      case "resend": {
        const s = await getSecrets(["resend.apiKey"]);
        if (!s["resend.apiKey"]) return missing("La clé Resend");
        const r = await http("https://api.resend.com/domains", { headers: { authorization: `Bearer ${s["resend.apiKey"]}` } });
        if (r.status === 200) {
          const domains = (r.json.data as Array<{ name: string; status: string }> | undefined) ?? [];
          const verified = domains.filter((d) => d.status === "verified").map((d) => d.name);
          return { ok: true, message: verified.length ? `Clé valide. Domaine(s) vérifié(s) : ${verified.join(", ")}.` : "Clé valide, mais aucun domaine vérifié : vérifiez votre domaine d'envoi dans Resend." };
        }
        // Une clé « envoi uniquement » est valide mais ne peut pas lister les domaines
        if (r.status === 401 && JSON.stringify(r.json).includes("restricted_api_key")) return { ok: true, message: "Clé valide (accès « envoi uniquement »)." };
        return { ok: false, message: `Resend refuse la clé (${r.status}) : ${errorMessage(r.json)}` };
      }
      case "anthropic": {
        const s = await getSecrets(["anthropic.apiKey"]);
        if (!s["anthropic.apiKey"]) return missing("La clé Claude");
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: s["anthropic.apiKey"], maxRetries: 0, timeout: TIMEOUT_MS });
        await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 8, messages: [{ role: "user", content: "Réponds OK." }] });
        return { ok: true, message: "Connexion à Claude réussie." };
      }
      case "openai": {
        const s = await getSecrets(["openai.apiKey"]);
        if (!s["openai.apiKey"]) return missing("La clé OpenAI");
        const r = await http("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${s["openai.apiKey"]}` } });
        if (r.status === 200) return { ok: true, message: `Connexion OpenAI réussie (${(r.json.data as unknown[] | undefined)?.length ?? 0} modèles accessibles).` };
        return { ok: false, message: `OpenAI refuse la clé (${r.status}) : ${errorMessage(r.json)}` };
      }
      case "meta": {
        const s = await getSecrets(["meta.appId", "meta.appSecret", "meta.capiToken"]);
        if (!s["meta.appId"] || !s["meta.appSecret"]) return missing("L'identifiant ou la clé secrète Meta");
        const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(s["meta.appId"])}`);
        url.searchParams.set("fields", "id,name");
        url.searchParams.set("access_token", `${s["meta.appId"]}|${s["meta.appSecret"]}`);
        const r = await http(url.toString());
        if (r.status === 200 && r.json.id) return { ok: true, message: `Application Meta reconnue : « ${String(r.json.name ?? r.json.id)} ».${s["meta.capiToken"] ? "" : " Jeton Conversions API non renseigné."}` };
        return { ok: false, message: `Meta refuse l'identifiant ou la clé (${r.status}) : ${errorMessage(r.json)}` };
      }
      case "tiktok": {
        const s = await getSecrets(["tiktok.clientKey", "tiktok.clientSecret", "tiktok.adsAccessToken", "tiktok.advertiserIds"]);
        if (!s["tiktok.clientKey"] || !s["tiktok.clientSecret"]) return missing("Le client key ou le client secret TikTok");
        const problems: string[] = [];
        if (!/^[A-Za-z0-9]{10,}$/.test(s["tiktok.clientKey"])) problems.push("le client key ne ressemble pas à un identifiant TikTok (lettres et chiffres)");
        if (s["tiktok.clientSecret"].length < 20) problems.push("le client secret semble trop court");
        if (s["tiktok.advertiserIds"] && !s["tiktok.advertiserIds"].split(",").every((id) => /^\d{6,}$/.test(id.trim()))) problems.push("les identifiants de comptes publicitaires doivent être des nombres séparés par des virgules");
        if (problems.length) return { ok: false, message: `Format à vérifier : ${problems.join(" ; ")}.` };
        return { ok: true, message: "Format des identifiants correct. La validation définitive a lieu lors de la connexion du compte TikTok (Marketing social → Connecteurs)." };
      }
      case "runway": {
        const s = await getSecrets(["runway.apiKey"]);
        if (!s["runway.apiKey"]) return missing("La clé Runway");
        const r = await http("https://api.dev.runwayml.com/v1/organization", { headers: { authorization: `Bearer ${s["runway.apiKey"]}`, "X-Runway-Version": "2024-11-06" } });
        if (r.status === 200) {
          const credits = r.json.creditBalance;
          return { ok: true, message: `Connexion Runway réussie${typeof credits === "number" ? ` (${credits} crédits disponibles)` : ""}.` };
        }
        return { ok: false, message: `Runway refuse la clé (${r.status}) : ${errorMessage(r.json)}` };
      }
      case "gemini": {
        const s = await getSecrets(["google.geminiApiKey"]);
        if (!s["google.geminiApiKey"]) return missing("La clé Gemini");
        const r = await http("https://generativelanguage.googleapis.com/v1beta/models?pageSize=50", { headers: { "x-goog-api-key": s["google.geminiApiKey"] } });
        if (r.status === 200) {
          const models = (r.json.models as Array<{ name: string }> | undefined) ?? [];
          const veo = models.some((m) => m.name.includes("veo"));
          return { ok: true, message: `Connexion Gemini réussie${veo ? " (modèles Veo accessibles)" : " (aucun modèle Veo listé pour cette clé : vérifiez la facturation du projet Google)"}.` };
        }
        return { ok: false, message: `Google refuse la clé (${r.status}) : ${errorMessage(r.json)}` };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Échec du test : ${msg.split("\n")[0].slice(0, 300)}` };
  }
}
