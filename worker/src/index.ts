import { camunda } from "./client.js";
import { registerCheckInventoryWorker } from "./workers/check-inventory.js";

/**
 * Entry point for the kaviya_order_process workers.
 *
 * One worker per service task. The process currently has a single service task
 * ("Check inventory" / `check-inventory`); add further `register*Worker(camunda)`
 * calls here as the process grows.
 */
function main() {
  const workers = [registerCheckInventoryWorker(camunda)];

  console.log(`Started ${workers.length} worker(s) for kaviya_order_process.`);

  // Graceful shutdown: stop polling for new jobs and let in-flight jobs drain
  // before exiting. The worker has no `close()` — `stopGracefully()` is the
  // correct call. Guard against a double signal so we only shut down once.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down workers gracefully...`);
    try {
      await Promise.all(
        workers.map((w) => w.stopGracefully({ waitUpToMs: 30_000 })),
      );
      console.log("All workers stopped cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main();
