# kaviya_order_process — job workers

TypeScript job-worker skeleton for the `kaviya_order_process` Camunda 8 process,
targeting **Camunda 8.9 SaaS**. Business logic is left as `TODO` stubs.

## Layout

```
worker/
├── src/
│   ├── client.ts                 # shared Camunda client (reads CAMUNDA_* env vars)
│   ├── index.ts                  # registers workers + graceful shutdown
│   └── workers/
│       └── check-inventory.ts    # worker for the "Check inventory" service task
├── .env.example                  # SaaS connection template (copy to .env)
├── package.json
└── tsconfig.json
```

## Process mapping

| BPMN element            | Task type / error code | Handled by                    |
| ----------------------- | ---------------------- | ----------------------------- |
| Service task `Check inventory` | `check-inventory` | `src/workers/check-inventory.ts` |
| Boundary error event `Item not in stock` | `ITEM_OUT_OF_STOCK` | `job.error(...)` from the same worker |

The worker's `job.error({ errorCode: "ITEM_OUT_OF_STOCK", ... })` is what fires
the boundary event. The error code string matches `<bpmn:error errorCode="ITEM_OUT_OF_STOCK" />`
in the BPMN, and the error `variables` supply the three values the boundary
event maps out (`unavailableItem`, `errorCode`, `errorMessage`).

## Data contract (`check-inventory`)

| Direction | Variables |
| --------- | --------- |
| Input (read only these) | `item` (string), `inStock` (boolean) |
| Output on success | `inventoryStatus` (string) — only this |
| Output on out-of-stock | `unavailableItem`, `errorCode` (`"ITEM_OUT_OF_STOCK"`), `errorMessage` — only these |

The handler reads only `item` and `inStock`, returns only `inventoryStatus` on
success, and on out-of-stock throws the BPMN error returning only the three error
variables. It never invents values the process didn't provide — malformed input
raises an incident instead of guessing an availability outcome.

## SDK

Uses [`@camunda8/orchestration-cluster-api`](https://www.npmjs.com/package/@camunda8/orchestration-cluster-api)
(`^9.1.x`), the REST-only TypeScript client for Camunda 8.9+. The SDK versions
independently of the Camunda platform — `9.1.x` targets 8.9.

## Handler contract

Every code path ends in exactly one terminal call:

- **Success** → `job.complete(variables?)`
- **Business outcome** (item out of stock) → `job.error({ errorCode, ... })` — routed to the boundary event, not retried
- **Transient failure** (network, 5xx) → `job.fail({ retries, retryBackOff })` — engine redelivers
- **Unexpected bug** → an unhandled throw falls back to the SDK's fail-with-zero-backoff net

Jobs are delivered at-least-once, so handlers must be **idempotent** — use
`job.jobKey` or `orderId` as an idempotency key for downstream side effects.

## Run

```bash
npm install
cp .env.example .env      # fill in your SaaS credentials
npm run typecheck         # tsc --noEmit
npm run build             # tsc -> dist/
npm start                 # node dist/index.js
```

The worker is an outbound-only client: it long-polls the cluster over HTTPS and
needs no inbound port. Stop it with SIGINT/SIGTERM for a graceful drain.
