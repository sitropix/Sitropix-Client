import { startServer } from "./app.mjs";

startServer().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", msg: "api.start_failed", error: error?.message }));
  process.exit(1);
});
