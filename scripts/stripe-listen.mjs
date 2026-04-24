/**
 * Forwards Stripe webhooks to the local API. Run in a second terminal after `npm run dev`.
 * Requires: Stripe CLI (https://stripe.com/docs/stripe-cli).
 * Auth: set STRIPE_SECRET_KEY in .env (same test key as the app), or run `stripe login` once.
 * Copy the printed `whsec_...` into .env as STRIPE_WEBHOOK_SECRET and restart the API.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });
dotenv.config({ path: join(root, ".env.local") });

const port = process.env.API_SERVER_PORT ?? "8787";
const forward = `http://127.0.0.1:${port}/api/webhooks/stripe`;
console.log(`[stripe:listen] Forwarding to ${forward} (set API_SERVER_PORT in .env to change)\n`);

const childEnv = { ...process.env };
const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (secret) {
  childEnv.STRIPE_API_KEY = secret;
  console.log("[stripe:listen] Authenticating CLI via STRIPE_SECRET_KEY from .env\n");
} else {
  console.log("[stripe:listen] No STRIPE_SECRET_KEY — run `stripe login` in this folder, or add your test secret key to .env\n");
}

// Windows needs shell: true so `stripe` on PATH resolves (avoids spawn EINVAL on some setups).
const child = spawn("stripe", ["listen", "--forward-to", forward], {
  stdio: "inherit",
  shell: true,
  env: childEnv,
});

child.on("exit", (code) => process.exit(code ?? 0));
