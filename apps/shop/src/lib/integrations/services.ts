/**
 * Description des services intégrables (données pures, utilisables côté client).
 * Aucune valeur secrète ici : seulement les libellés, l'aide et la liste des clés.
 */
import type { SecretKey } from "./secrets";

export type ServiceId = "stripe" | "resend" | "anthropic" | "openai" | "meta" | "tiktok" | "etsy" | "runway" | "gemini";

export interface ServiceField {
  key: SecretKey;
  label: string;
  placeholder?: string;
  help?: string;
  optional?: boolean;
  /** Valeur non sensible (identifiant) : peut être affichée en clair une fois saisie. */
  plain?: boolean;
}

export interface ServiceDef {
  id: ServiceId;
  title: string;
  description: string;
  helpUrl: string;
  helpLabel: string;
  fields: ServiceField[];
  /** URL(s) de rappel OAuth à déclarer chez le fournisseur (chemin relatif à l'URL du site). */
  oauthCallbackPaths?: string[];
  testable: boolean;
}

export const SERVICES: ServiceDef[] = [
  {
    id: "stripe",
    title: "Stripe (paiement)",
    description: "Encaissement par carte, Apple Pay et Google Pay. Utilisez les clés de test (sk_test_…) avant la mise en production.",
    helpUrl: "https://dashboard.stripe.com/apikeys",
    helpLabel: "Tableau de bord Stripe → Développeurs → Clés API",
    fields: [
      { key: "stripe.secretKey", label: "Clé secrète", placeholder: "sk_test_… ou sk_live_…" },
      { key: "stripe.webhookSecret", label: "Secret du webhook", placeholder: "whsec_…", help: "Développeurs → Webhooks → endpoint /api/stripe/webhook → Secret de signature" },
      { key: "stripe.publishableKey", label: "Clé publiable", placeholder: "pk_test_…", optional: true, plain: true },
    ],
    testable: true,
  },
  {
    id: "resend",
    title: "Resend (emails)",
    description: "Emails de confirmation de commande, liens d'accès aux achats, newsletter. Une clé saisie ici active l'envoi réel.",
    helpUrl: "https://resend.com/api-keys",
    helpLabel: "Resend → API Keys (vérifiez d'abord votre domaine d'envoi)",
    fields: [{ key: "resend.apiKey", label: "Clé API", placeholder: "re_…" }],
    testable: true,
  },
  {
    id: "anthropic",
    title: "Claude (Anthropic)",
    description: "Génération des posts et publicités en un clic. Sans clé, le mode copier-coller reste disponible.",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpLabel: "Console Anthropic → API Keys",
    fields: [{ key: "anthropic.apiKey", label: "Clé API", placeholder: "sk-ant-…" }],
    testable: true,
  },
  {
    id: "openai",
    title: "OpenAI",
    description: "Génération d'images (et, en option, de textes).",
    helpUrl: "https://platform.openai.com/api-keys",
    helpLabel: "Plateforme OpenAI → API keys",
    fields: [{ key: "openai.apiKey", label: "Clé API", placeholder: "sk-…" }],
    testable: true,
  },
  {
    id: "meta",
    title: "Meta (Facebook, Instagram)",
    description: "Connexion des Pages, comptes Instagram et comptes publicitaires, publication et lecture des dépenses. Le jeton Conversions API envoie les achats côté serveur.",
    helpUrl: "https://developers.facebook.com/apps/",
    helpLabel: "Meta for Developers → Mes apps → Paramètres → Général",
    fields: [
      { key: "meta.appId", label: "Identifiant de l'application (App ID)", placeholder: "1234567890", plain: true },
      { key: "meta.appSecret", label: "Clé secrète de l'application (App Secret)" },
      { key: "meta.capiToken", label: "Jeton Conversions API", optional: true, help: "Gestionnaire d'événements → Pixel → Paramètres → Générer un jeton d'accès" },
    ],
    oauthCallbackPaths: ["/api/admin/social/meta/callback"],
    testable: true,
  },
  {
    id: "tiktok",
    title: "TikTok",
    description: "Connexion du compte TikTok (publication) et du compte publicitaire (dépenses), et envoi des achats via l'Events API.",
    helpUrl: "https://developers.tiktok.com/apps/",
    helpLabel: "TikTok for Developers → Manage apps",
    fields: [
      { key: "tiktok.clientKey", label: "Client key", plain: true },
      { key: "tiktok.clientSecret", label: "Client secret" },
      { key: "tiktok.adsAccessToken", label: "Jeton Marketing API (TikTok for Business)", optional: true, help: "Nécessaire pour importer les dépenses publicitaires" },
      { key: "tiktok.advertiserIds", label: "Identifiants des comptes publicitaires", optional: true, plain: true, placeholder: "7012345678901234567, …", help: "Séparés par des virgules" },
      { key: "tiktok.eventsToken", label: "Jeton Events API", optional: true, help: "Ads Manager → Outils → Événements → Paramètres → Générer un jeton" },
    ],
    oauthCallbackPaths: ["/api/admin/social/tiktok/callback"],
    testable: true,
  },
  {
    id: "etsy",
    title: "Etsy (boutique)",
    description: "Publication automatique des e-books sur votre boutique Etsy (produits numériques) et import des ventes Etsy dans la rentabilité.",
    helpUrl: "https://www.etsy.com/developers/your-apps",
    helpLabel: "Etsy Developers → Your apps → Keystring et Shared secret",
    fields: [
      { key: "etsy.apiKey", label: "Keystring (clé de l'application)", plain: true },
      { key: "etsy.sharedSecret", label: "Shared secret", help: "Etsy exige désormais keystring et shared secret dans l'en-tête x-api-key : renseignez les deux." },
    ],
    oauthCallbackPaths: ["/api/admin/social/etsy/callback"],
    testable: true,
  },
  {
    id: "runway",
    title: "Runway (vidéo)",
    description: "Animation des illustrations en courtes vidéos publicitaires (image vers vidéo).",
    helpUrl: "https://dev.runwayml.com/",
    helpLabel: "Runway Developer Portal → API Keys",
    fields: [{ key: "runway.apiKey", label: "Clé API", placeholder: "key_…" }],
    testable: true,
  },
  {
    id: "gemini",
    title: "Google Gemini / Veo (vidéo)",
    description: "Génération de vidéos courtes avec Veo via l'API Gemini.",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpLabel: "Google AI Studio → Get API key",
    fields: [{ key: "google.geminiApiKey", label: "Clé API", placeholder: "AIza…" }],
    testable: true,
  },
];

export function serviceById(id: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id);
}
