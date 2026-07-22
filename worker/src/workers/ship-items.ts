import type { Job, WorkerConfig } from "../types.js";

/**
 * Worker for the "Ship items" service task.
 *
 * BPMN wiring:
 *   - taskDefinition type : ship-items
 *   - element             : Activity_08pg6im
 *   - on success the process reaches the "Order shipped" end event.
 */

interface ShipItemsVariables {
  orderId: string;
  items: Array<{ sku: string; quantity: number }>;
  shippingAddress: unknown;
}

export const shipItemsConfig: WorkerConfig = {
  jobType: "ship-items",
  maxParallelJobs: 10,
  jobTimeoutMs: 60_000,
  pollIntervalMs: 100,
  fetchVariables: ["orderId", "items", "shippingAddress"],
};

export async function shipItemsHandler(job: Job) {
  const { orderId } = job.variables as unknown as ShipItemsVariables;

  try {
    // TODO: replace with the real shipping/fulfilment call.
    // Use job.jobKey as an idempotency key to avoid creating duplicate shipments.
    // const shipment = await shippingService.createShipment({ orderId, idempotencyKey: job.jobKey });
    const shipment: { trackingId: string } = { trackingId: `track-${orderId}` };

    return job.complete({
      shipped: true,
      trackingId: shipment.trackingId,
    });
  } catch (err) {
    // Transient/infrastructure failure -> retry with back-off.
    const message = err instanceof Error ? err.message : String(err);
    return job.fail({
      errorMessage: `ship-items failed: ${message}`,
      retries: job.retries - 1,
      retryBackOff: 10_000,
    });
  }
}
