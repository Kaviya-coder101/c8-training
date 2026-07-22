# kaviya_order_process — TypeScript worker skeleton

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
> (use `job.jobKey` or `orderId` as an idempotency key in the downstream system).

## Layout

```
src/
├── index.ts          # bootstraps client, registers all 3 workers, graceful shutdown
├── client.ts         # CamundaRestApi client (env-driven)
├── types.ts          # Job/WorkerConfig types derived from the SDK
└── workers/
    ├── check-inventory.ts
    ├── charge-payment.ts
    └── ship-items.ts
```

## Run

```bash
cd worker
npm install
cp .env.example .env    # set CAMUNDA_BASE_URL (+ OAuth vars for SaaS/Self-Managed)

npm run dev             # run from TypeScript with auto-restart (tsx)
# or
npm run build && npm start   # compile to dist/ then run with node
```

`npm run typecheck` type-checks without emitting.

With a worker running, start a process instance (e.g. via `c8ctl` or Operate)
and the tasks will be picked up automatically.
