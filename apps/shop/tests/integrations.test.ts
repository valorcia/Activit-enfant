import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { deleteSecret, getSecret, getSecretStatus, getSecrets, invalidateSecretCache, setSecret, SECRET_KEYS } from "@/lib/integrations/secrets";
import { SERVICES } from "@/lib/integrations/services";
import { db, resetDb } from "./helpers/db";

process.env.MARKETING_ENCRYPTION_KEY ??= "test-marketing-key";

const ENV_KEYS = ["STRIPE_SECRET_KEY", "RESEND_API_KEY", "META_APP_ID", "ANTHROPIC_API_KEY"];
const saved: Record<string, string | undefined> = {};

describe("coffre des clés d'intégration", () => {
  beforeEach(async () => {
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    await resetDb();
    invalidateSecretCache();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    invalidateSecretCache();
  });
  afterAll(async () => { await db.$disconnect(); });

  it("chiffre et déchiffre une valeur (aller-retour) sans la stocker en clair", async () => {
    const enc = encryptSecret("sk_test_abcdef123456");
    expect(enc).not.toContain("sk_test_abcdef123456");
    expect(decryptSecret(enc)).toBe("sk_test_abcdef123456");

    await setSecret("stripe.secretKey", "sk_test_abcdef123456", {}, db);
    const row = await db.integrationSecret.findUniqueOrThrow({ where: { key: "stripe.secretKey" } });
    expect(row.valueEnc).not.toContain("abcdef123456");
    expect(row.hint).toBe("3456");
  });

  it("donne la priorité à la base sur la variable d'environnement", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_depuis_env_0000";
    expect(await getSecret("stripe.secretKey", db)).toBe("sk_test_depuis_env_0000");
    await setSecret("stripe.secretKey", "sk_test_depuis_base_9999", {}, db);
    expect(await getSecret("stripe.secretKey", db)).toBe("sk_test_depuis_base_9999");
  });

  it("se replie sur l'environnement après suppression, puis renvoie une chaîne vide si rien n'est défini", async () => {
    process.env.RESEND_API_KEY = "re_env_key_12345678";
    await setSecret("resend.apiKey", "re_base_key_87654321", {}, db);
    expect(await getSecret("resend.apiKey", db)).toBe("re_base_key_87654321");
    await deleteSecret("resend.apiKey", {}, db);
    expect(await getSecret("resend.apiKey", db)).toBe("re_env_key_12345678");
    delete process.env.RESEND_API_KEY;
    expect(await getSecret("resend.apiKey", db)).toBe("");
  });

  it("expose un statut sans jamais divulguer la valeur", async () => {
    process.env.META_APP_ID = "123456789012345";
    await setSecret("anthropic.apiKey", "sk-ant-api03-supersecretvalue-WXYZ", {}, db);
    const statuses = await getSecretStatus(db);
    expect(statuses).toHaveLength(SECRET_KEYS.length);
    const claude = statuses.find((s) => s.key === "anthropic.apiKey")!;
    expect(claude).toMatchObject({ source: "database", hint: "WXYZ" });
    expect(statuses.find((s) => s.key === "meta.appId")).toMatchObject({ source: "environment", hint: "2345" });
    expect(statuses.find((s) => s.key === "openai.apiKey")).toMatchObject({ source: "missing", hint: null });
    const serialized = JSON.stringify(statuses);
    expect(serialized).not.toContain("supersecretvalue");
    expect(serialized).not.toContain("123456789012345");
  });

  it("invalide le cache à l'écriture (pas de valeur périmée pendant 60 s)", async () => {
    await setSecret("stripe.webhookSecret", "whsec_premiere_valeur_1111", {}, db);
    expect(await getSecret("stripe.webhookSecret", db)).toBe("whsec_premiere_valeur_1111");
    // Écriture directe en base : le cache garde l'ancienne valeur tant qu'il n'est pas invalidé
    await db.integrationSecret.update({ where: { key: "stripe.webhookSecret" }, data: { valueEnc: encryptSecret("whsec_modifiee_hors_cache_2222") } });
    expect(await getSecret("stripe.webhookSecret", db)).toBe("whsec_premiere_valeur_1111");
    // setSecret invalide le cache
    await setSecret("stripe.webhookSecret", "whsec_seconde_valeur_3333", {}, db);
    const both = await getSecrets(["stripe.webhookSecret", "stripe.secretKey"], db);
    expect(both).toEqual({ "stripe.webhookSecret": "whsec_seconde_valeur_3333", "stripe.secretKey": "" });
  });

  it("refuse une valeur vide et ignore une valeur illisible (clé de chiffrement changée)", async () => {
    await expect(setSecret("openai.apiKey", "   ", {}, db)).rejects.toThrow();
    await db.integrationSecret.create({ data: { key: "openai.apiKey", valueEnc: "v1.invalide.invalide.invalide", hint: "zzzz" } });
    invalidateSecretCache();
    expect(await getSecret("openai.apiKey", db)).toBe("");
  });

  it("chaque champ de service correspond à une clé connue", () => {
    for (const service of SERVICES) for (const field of service.fields) expect(SECRET_KEYS).toContain(field.key);
  });
});
