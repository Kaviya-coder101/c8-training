import "dotenv/config";

import type { JobWorkerConfig } from "@camunda8/orchestration-cluster-api";

import { createClient } from "./client.js";
import { checkInventoryConfig, checkInventoryHandler } from "./workers/check-inventory.js";
import { chargePaymentConfig, chargePaymentHandler } from "./workers/charge-payment.js";
import { shipItemsConfig, shipItemsHandler } from "./workers/ship-items.js";

const client = createClient();

// Each entry wires a BPMN taskDefinition type to its handler.
const workerDefinitions: JobWorkerConfig[] = [
  { ...checkInventoryConfig, jobHandler: checkInventoryHandler },
  { ...chargePaymentConfig, jobHandler: chargePaymentHandler },
  { ...shipItemsConfig, jobHandler: shipItemsHandler },
];

const workers = workerDefinitions.map((definition) => {
  const worker = client.createJobWorker(definition);
  console.log(`[worker] started for job type "${definition.jobType}"`);
  return worker;
});

console.log(`[worker] ${workers.length} worker(s) running for kaviya_order_process. Press Ctrl+C to stop.`);

// Graceful shutdown: stop polling and let in-flight jobs finish.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[worker] received ${signal}, shutting down...`);
  // Stop polling and let in-flight jobs drain before exiting.
  await Promise.allSettled(workers.map((worker) => worker.stopGracefully({ waitUpToMs: 10_000 })));
  console.log("[worker] all workers stopped. Bye.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
