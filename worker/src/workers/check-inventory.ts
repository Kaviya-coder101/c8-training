import type { Job, WorkerConfig } from "../types.js";

/**
 * Worker for the "Check inventory" service task.
 *
 * BPMN wiring:
 *   - taskDefinition type : check-inventory
 *   - element             : Activity_0tw2fu0
 *   - boundary error event: Event_1g3k0ac ("Item not in stock")
 *       catches a BPMN error and maps these job variables onto the process:
 *         unavailableItem, errorCode, errorMessage
 *
 * If an ordered item is not in stock, throw a BPMN error so the engine routes
 * the token down the "Item not in stock" boundary event instead of retrying.
 */

interface CheckInventoryVariables {
  orderId: string;
  items: Array<{ sku: string; quantity: number }>;
}

export const checkInventoryConfig: WorkerConfig = {
  jobType: "check-inventory",
  maxParallelJobs: 10,
  jobTimeoutMs: 60_000,
  pollIntervalMs: 100,
  // Only the variables the handler actually reads are fetched with the job.
  fetchVariables: ["orderId", "items"],
};

export async function checkInventoryHandler(job: Job) {
  const { orderId } = job.variables as unknown as CheckInventoryVariables;

  try {
    // TODO: replace with the real inventory lookup.
    // const unavailable = await inventoryService.findUnavailable(items);
    const unavailable: Array<{ sku: string; quantity: number }> = [];

    if (unavailable.length > 0) {
      // Modelled business outcome -> BPMN error (no retry).
      const errorMessage = `Item(s) not in stock for order ${orderId}`;
      return job.error({
        errorCode: "ITEM_NOT_IN_STOCK",
        errorMessage,
        variables: {
          unavailableItem: unavailable[0],
          errorCode: "ITEM_NOT_IN_STOCK",
          errorMessage,
        },
      });
    }

    // Happy path -> complete and merge output variables into the process scope.
    return job.complete({
      inventoryChecked: true,
    });
  } catch (err) {
    // Transient/infrastructure failure -> retry with back-off.
    const message = err instanceof Error ? err.message : String(err);
    return job.fail({
      errorMessage: `check-inventory failed: ${message}`,
      retries: job.retries - 1,
      retryBackOff: 10_000,
    });
  }
}
