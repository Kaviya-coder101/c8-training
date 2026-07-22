/**
 * Worker for the "Ship items" service task.
 *
 * BPMN wiring:
 *   - taskDefinition type : ship-items
 *   - element             : Activity_08pg6im
 *   - on success the process reaches the "Order shipped" end event.
 */
export const shipItemsConfig = {
  jobType: "ship-items",
  maxParallelJobs: 10,
  jobTimeoutMs: 60_000,
  pollIntervalMs: 100,
  fetchVariables: ["orderId", "items", "shippingAddress"],
};

export async function shipItemsHandler(job) {
  const { orderId } = job.variables;

  try {
    // TODO: replace with the real shipping/fulfilment call.
    // Use job.key as an idempotency key to avoid creating duplicate shipments.
    // const shipment = await shippingService.createShipment({ orderId, idempotencyKey: job.key });
    const shipment = { trackingId: `track-${orderId}` };

    return job.complete({
      shipped: true,
      trackingId: shipment.trackingId,
    });
  } catch (err) {
    // Transient/infrastructure failure -> retry with back-off.
    return job.fail({
      errorMessage: `ship-items failed: ${err.message}`,
      retries: job.retries - 1,
      retryBackOff: 10_000,
    });
  }
}
