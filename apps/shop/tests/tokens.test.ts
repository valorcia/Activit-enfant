import { describe, expect, it } from "vitest";
import { randomToken, sha256, signPayload, verifySignedPayload } from "@/lib/tokens";

describe("jetons signés", () => {
  const secret = "secret-de-test";
  it("signe puis vérifie une charge utile", () => {
    const token = signPayload("order:abc", 2_000_000_000, secret);
    expect(verifySignedPayload(token, secret, 1_900_000_000)).toBe("order:abc");
  });
  it("refuse un jeton expiré", () => {
    const token = signPayload("order:abc", 1_000, secret);
    expect(verifySignedPayload(token, secret, 2_000)).toBeNull();
  });
  it("refuse un jeton altéré ou signé avec un autre secret", () => {
    const token = signPayload("order:abc", 2_000_000_000, secret);
    const [payload, exp, sig] = token.split(".");
    const tampered = `${Buffer.from("order:xyz").toString("base64url")}.${exp}.${sig}`;
    expect(verifySignedPayload(tampered, secret, 1_900_000_000)).toBeNull();
    expect(verifySignedPayload(`${payload}.${Number(exp) + 10}.${sig}`, secret, 1_900_000_000)).toBeNull();
    expect(verifySignedPayload(token, "autre-secret", 1_900_000_000)).toBeNull();
    expect(verifySignedPayload("n-importe-quoi", secret)).toBeNull();
  });
  it("génère des jetons aléatoires distincts et des empreintes stables", () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});
