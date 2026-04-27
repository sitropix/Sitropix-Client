import { startServer } from "./app.mjs";
import { log } from "./observability/logger.mjs";

startServer().catch((error) => {
  log.fatal("api.start_failed", { error: error?.message });
  process.exit(1);
});
