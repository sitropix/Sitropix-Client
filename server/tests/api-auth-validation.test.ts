import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.mjs";

describe("API auth + validation", () => {
  it("rejects login with missing fields (validation error)", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "validation_error" });
    expect(String(res.body.message || "")).toBeTruthy();
  });

  it("rejects login with short password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "1234567" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "validation_error" });
  });
});
