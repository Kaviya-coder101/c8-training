import type { Job, WorkerConfig } from "../types.js";

/**
 * Worker for the "Charge payment method" service task.
 *
 * BPMN wiring:
 *   - taskDefinition type : charge-payment
 *   - element             : Activity_1ppsbgi
 *   - boundary error event: Event_0arm3xk ("Charge failed")
 *       catches a BPMN error and routes the token to the "Order not shipped" end event.
 *
 * A declined payment is a modelled business outcome -> BPMN error.
 * A payment-gateway timeout / 5xx is transient -> fail with retries.
 */

interface ChargePaymentVariables {
  orderId: string;
  amount: number;
  paymentMethod: string;
}

export const chargePaymentConfig: WorkerConfig = {
  jobType: "charge-payment",
  maxParallelJobs: 10,
  jobTimeoutMs: 60_000,
  pollIntervalMs: 100,
  fetchVariables: ["orderId", "amount", "paymentMethod"],
};

export async function chargePaymentHandler(job: Job) {
  const { orderId, amount } = job.variables as unknown as ChargePaymentVariables;

  try {
    // TODO: replace with the real payment-gateway call.
    // Use job.jobKey (or orderId) as an idempotency key so a redelivered job
    // does not double-charge the customer.
    // const result = await paymentGateway.charge({ orderId, amount, paymentMethod, idempotencyKey: job.jobKey });
    const result: { declined: boolean; paymentRef: string } = {
      declined: false,
      paymentRef: `ref-${orderId}`,
    };

    if (result.declined) {
      // Modelled business outcome -> BPMN error (no retry).
      return job.error({
        errorCode: "CHARGE_FAILED",
        errorMessage: `Payment declined for order ${orderId}`,
      });
    }

    return job.complete({
      paymentRef: result.paymentRef,
      chargedAmount: amount,
    });
  } catch (err) {
    // Transient/infrastructure failure -> retry with back-off.
    const message = err instanceof Error ? err.message : String(err);
    return job.fail({
      errorMessage: `charge-payment failed: ${message}`,
      retries: job.retries - 1,
      retryBackOff: 10_000,
    });
  }
}
