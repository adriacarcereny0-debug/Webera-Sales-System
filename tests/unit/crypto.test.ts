import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("cifrado de secretos de correo", () => {
  it("cifra y descifra sin dejar el texto a la vista", () => {
    const enc = encryptSecret("abcdefghijklmnop");
    expect(enc).not.toContain("abcdefghijklmnop");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc)).toBe("abcdefghijklmnop");
  });
  it("cada cifrado es distinto aunque el secreto sea el mismo", () => {
    expect(encryptSecret("re_123")).not.toBe(encryptSecret("re_123"));
  });
  it("rechaza un secreto manipulado", () => {
    const [v, iv, tag, data] = encryptSecret("buzon-secreto").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
});
