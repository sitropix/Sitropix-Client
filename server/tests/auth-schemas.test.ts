import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "../src/schemas/authSchemas.mjs";

describe("auth Zod schemas", () => {
  it("loginSchema requires email and 8+ char password", () => {
    expect(loginSchema.parse({ email: "a@b.com", password: "12345678" })).toEqual({
      email: "a@b.com",
      password: "12345678",
    });
    expect(() => loginSchema.parse({ email: "bad", password: "12345678" })).toThrow();
    expect(() => loginSchema.parse({ email: "a@b.com", password: "short" })).toThrow();
  });

  it("signupSchema accepts optional inviteToken", () => {
    const base = { name: "Test", email: "n@e.com", password: "12345678" };
    expect(signupSchema.parse(base)).toEqual(base);
    expect(
      signupSchema.parse({
        ...base,
        inviteToken: "12345678901234567",
      }),
    ).toMatchObject({ inviteToken: "12345678901234567" });
  });
});
