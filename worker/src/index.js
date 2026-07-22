import "dotenv/config";

import { createClient } from "./client.js";
import { checkInventoryConfig, checkInventoryHandler } from "./workers/check-inventory.js";
import { chargePaymentConfig, chargePaymentHandler } from "./workers/charge-payment.js";
import { shipItemsConfig, shipItemsHandler } from "./workers/ship-items.js";

const client = createClient();

// Each entry wires a BPMN taskDefinition type to its handler.
const workerDefinitions = [
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
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[worker] received ${signal}, shutting down...`);
  await Promise.allSettled(workers.map((worker) => worker.close()));
  console.log("[worker] all workers closed. Bye.");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
