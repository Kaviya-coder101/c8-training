# kaviya_order_process — Node.js worker skeleton

Job worker skeleton for the `kaviya_order_process` BPMN process
(`../order-process-boundary-events.bpmn`, Camunda 8.9).

It uses [`@camunda8/orchestration-cluster-api`](https://www.npmjs.com/package/@camunda8/orchestration-cluster-api),
the REST client recommended for Camunda 8.9+.

## Workers

Each worker is wired to a `zeebe:taskDefinition type` in the process:

| Job type          | Service task            | On business failure                                        |
| ----------------- | ----------------------- | ---------------------------------------------------------- |
| `check-inventory` | Check inventory         | BPMN error → "Item not in stock" boundary event            |
| `charge-payment`  | Charge payment method   | BPMN error → "Charge failed" boundary event                |
| `ship-items`      | Ship items              | —                                                          |

The business logic in each handler is a stub (`TODO`) — fill it in with your
real inventory / payment / shipping calls.

## Failure handling (already wired)

- **Business outcome** (item out of stock, payment declined) → `job.error({ errorCode })`.
  The engine routes to the matching boundary event and does **not** retry.
- **Transient failure** (network, downstream 5xx) → `job.fail({ retries, retryBackOff })`.
  The engine redelivers after the back-off; reaching `retries = 0` raises an incident.
- **Happy path** → `job.complete(variables)`.

> Jobs may be delivered more than once — make each handler idempotent
> (use `job.key` or `orderId` as an idempotency key in the downstream system).

## Run

```bash
cd worker
npm install
cp .env.example .env    # set CAMUNDA_BASE_URL (+ OAuth vars for SaaS/Self-Managed)
npm start               # or: npm run dev  (auto-restart on change)
```

With a worker running, start a process instance (e.g. via `c8ctl` or Operate)
and the tasks will be picked up automatically.
