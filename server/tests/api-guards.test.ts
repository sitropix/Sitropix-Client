import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.mjs";

describe("API guardrails", () => {
  it("returns health status without auth", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it("blocks customer portal endpoint without bearer token", async () => {
    const res = await request(app).get("/api/subscriptions/portal");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "unauthorized" });
  });

  it("blocks admin endpoint without bearer token", async () => {
    const res = await request(app).get("/api/admin/plans");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "unauthorized" });
  });
});

