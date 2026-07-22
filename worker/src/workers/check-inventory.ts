import type { CamundaClient, JobActionReceipt } from "@camunda8/orchestration-cluster-api";

/**
 * Worker for the "Check inventory" service task.
 *
 *   BPMN service task .... Activity_0tw2fu0 ("Check inventory")
 *   zeebe:taskDefinition . type="check-inventory"          <- must match JOB_TYPE
 *   error boundary event . "Item not in stock"             <- catches ITEM_OUT_OF_STOCK
 *
 * Process data contract:
 *   in  : item    (string)  — SKU/name of the item to check
 *         inStock (boolean) — whether the item is available
 *   out (success)     : inventoryStatus (string)
 *   out (out-of-stock): unavailableItem, errorCode, errorMessage
 *
 * Rules: only read `item` and `inStock`; on success return only
 * `inventoryStatus`; on out-of-stock throw the BPMN error and return only the
 * three error variables. Never invent variable values.
 *
 * The boundary event on this task maps the three error variables out of the
 * error's local scope, so the BPMN-error result supplies them in its `variables`
 * for the "Order not shipped" path to carry that context.
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
    // Per the contract, the handler reads only `item` and `inStock`.
    fetchVariables: ["item", "inStock"],
    jobHandler: async (job): Promise<JobActionReceipt> => {
      // Jobs can be delivered more than once (at-least-once delivery). Use a
      // stable key — `job.jobKey` here, or the `item` — as an idempotency token
      // for any downstream side effect this handler triggers.
      const item = job.variables.item;
      const inStock = job.variables.inStock;
      job.log.debug(
        `check-inventory: job ${job.jobKey}, item ${String(item)}, inStock ${String(inStock)}`,
      );

      // Don't invent values the process didn't provide. If the contract inputs
      // are missing or the wrong type, raise an incident for an operator rather
      // than guessing an availability outcome.
      if (typeof item !== "string" || typeof inStock !== "boolean") {
        return job.fail({
          errorMessage:
            `check-inventory: invalid input — expected item:string, inStock:boolean, ` +
            `got item:${typeof item}, inStock:${typeof inStock}`,
          retries: 0,
        });
      }

      try {
        // --- Business outcome: item not in stock -------------------------------
        // Route the token to the "Item not in stock" boundary event. This is NOT
        // retried by the engine. Return only the three contract error variables.
        if (!inStock) {
          const errorMessage = `Item "${item}" is out of stock`;
          return job.error({
            errorCode: ERROR_ITEM_OUT_OF_STOCK,
            errorMessage,
            variables: {
              unavailableItem: item,
              errorCode: ERROR_ITEM_OUT_OF_STOCK,
              errorMessage,
            },
          });
        }

        // --- Success -----------------------------------------------------------
        // TODO: perform the real allocation side-effect here (idempotent, keyed
        // on job.jobKey / item) before completing. Return only inventoryStatus.
        return job.complete({
          inventoryStatus: `${item} allocated`,
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
