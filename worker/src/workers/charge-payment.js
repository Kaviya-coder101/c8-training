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
export const chargePaymentConfig = {
  jobType: "charge-payment",
  maxParallelJobs: 10,
  jobTimeoutMs: 60_000,
  pollIntervalMs: 100,
  fetchVariables: ["orderId", "amount", "paymentMethod"],
};

export async function chargePaymentHandler(job) {
  const { orderId, amount, paymentMethod } = job.variables;

  try {
    // TODO: replace with the real payment-gateway call.
    // Use job.key (or orderId) as an idempotency key so a redelivered job
    // does not double-charge the customer.
    // const result = await paymentGateway.charge({ orderId, amount, paymentMethod, idempotencyKey: job.key });
    const result = { declined: false, paymentRef: `ref-${orderId}` };

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
    return job.fail({
      errorMessage: `charge-payment failed: ${err.message}`,
      retries: job.retries - 1,
      retryBackOff: 10_000,
    });
  }
}
