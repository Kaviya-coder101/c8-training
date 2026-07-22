import type { CamundaClient, JobActionReceipt } from "@camunda8/orchestration-cluster-api";

/**
 * Worker for the "Check inventory" service task.
 *
 *   BPMN service task .... Activity_0tw2fu0 ("Check inventory")
 *   zeebe:taskDefinition . type="check-inventory"          <- must match JOB_TYPE
 *   error boundary event . "Item not in stock"             <- catches ITEM_OUT_OF_STOCK
 *
 * The boundary event on this task maps three variables out of the error's local
 * scope (`unavailableItem`, `errorCode`, `errorMessage`), so a BPMN-error result
 * must supply them in its `variables` for the "Order not shipped" path to carry
 * that context.
 */

/** Matches `<zeebe:taskDefinition type="check-inventory" />` in the BPMN. */
const JOB_TYPE = "check-inventory";

/**
 * Matches `<bpmn:error errorCode="ITEM_OUT_OF_STOCK" />` referenced by the
 * "Item not in stock" boundary event. This exact string is what routes the token
 * onto the error path — a mismatch would raise an incident instead.
 */
const ERROR_ITEM_OUT_OF_STOCK = "ITEM_OUT_OF_STOCK";

/** Redelivery back-off for transient failures (ms). */
const RETRY_BACK_OFF_MS = 10_000;

export function registerCheckInventoryWorker(camunda: CamundaClient) {
  return camunda.createJobWorker({
    jobType: JOB_TYPE,
    // Only fetch what the handler actually reads.
    fetchVariables: ["orderId", "items"],
    jobHandler: async (job): Promise<JobActionReceipt> => {
      // Jobs can be delivered more than once (at-least-once delivery). Use a
      // stable key — `job.jobKey` here, or a business key like `orderId` — as an
      // idempotency token for any downstream side effect this handler triggers.
      const orderId = job.variables.orderId;
      job.log.debug(`check-inventory: job ${job.jobKey}, order ${String(orderId)}`);

      try {
        // TODO: implement the real inventory check.
        //   1. Look up stock for each requested item (idempotent read).
        //   2. If everything is available -> job.complete(...).
        //   3. If an item is out of stock -> job.error(...) (business outcome).
        //   4. On a transient infrastructure failure -> job.fail(...) (see catch).

        // --- Business outcome: item not in stock -------------------------------
        // Route the token to the "Item not in stock" boundary event. This is NOT
        // retried by the engine. Populate the variables the boundary event maps.
        const itemOutOfStock = false; // TODO: derive from the real stock check.
        if (itemOutOfStock) {
          const unavailableItem = "TODO-item-sku"; // TODO: the actual SKU.
          return job.error({
            errorCode: ERROR_ITEM_OUT_OF_STOCK,
            errorMessage: `Item ${unavailableItem} is out of stock`,
            variables: {
              unavailableItem,
              errorCode: ERROR_ITEM_OUT_OF_STOCK,
              errorMessage: `Item ${unavailableItem} is out of stock`,
            },
          });
        }

        // --- Success -----------------------------------------------------------
        // TODO: return any variables downstream tasks need.
        return job.complete({
          inventoryChecked: true,
        });
      } catch (err) {
        // --- Transient failure: retry with back-off ----------------------------
        // Network blip, downstream 5xx, broker unreachable. Decrement retries and
        // let the engine redeliver after a back-off. Reaching 0 raises an incident.
        return job.fail({
          errorMessage: `check-inventory transient failure: ${String(err)}`,
          retries: (job.retries ?? 1) - 1,
          retryBackOff: RETRY_BACK_OFF_MS,
        });
      }
    },
  });
}
