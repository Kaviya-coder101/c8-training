# Worker + Claude Code Lab

Build, review, and test a Camunda 8 **TypeScript job worker** for your own
order process — using Claude Code end-to-end.

> Replace **`yourname`** everywhere with your own name (e.g. `kaviya_order_process`).
> Each participant works on their own process id and their own branch/PR.

**Goal:** go from a BPMN diagram to a working, tested job worker running against
Camunda 8.9 SaaS, driven entirely by prompts to Claude Code — and learn what a
good prompt and a good code review look like along the way.

---

## Prerequisites

- A Camunda 8.9 **SaaS** cluster + API client credentials (`baseUrl`, `clientId`, `clientSecret`).
- The process application repo connected to **Web Modeler Git sync**.
- Claude Code (web or CLI) with access to this repo.
- Node.js ≥ 22 in the session (needed for c8ctl).

---

## Step 1 — Model the process & Git-sync it

In **Web Modeler**, create (or open) a process with id **`yourname_order_process`** containing:

- Three service tasks with task-definition types: `check-inventory`, `charge-payment`, `ship-items`.
- Two **error boundary events**: one on *Check inventory* ("Item not in stock"),
  one on *Charge payment method* ("Charge failed").

Then **upload the BPMN and run a Git sync** so the `.bpmn` lands in the repo.
Confirm the file is on your branch before continuing.

---

## Step 2 — Generate the worker (prompt)

Paste this to Claude Code:

```text
Create a TypeScript based job-worker skeleton for the process id
yourname_order_process process. One worker per service task
(check-inventory, charge-payment, ship-items), wired so the two boundary
error events fire correctly. Target Camunda 8.9 SaaS, put it in worker/,
and leave the business logic as TODO stubs. Make sure it type-checks and builds.
```

**Why this prompt works** — it pins down the five things that otherwise cost a round-trip:

| Dimension | In the prompt |
| --- | --- |
| Language / stack | "TypeScript", "Camunda 8.9 SaaS" |
| Exact target | process id `yourname_order_process`, the three job types |
| Scope / depth | "skeleton … TODO stubs" (don't implement business logic) |
| Location | "put it in `worker/`" |
| Done = ? | "type-checks and builds" (a verifiable finish line) |

---

## Step 3 — Create a PR and merge

```text
create pr and merge
```

If you iterate after a PR is already merged, remember: **a merged PR is finished.**
Follow-up work is a *new* PR — Claude won't (and shouldn't) reopen the merged one.

---

## Step 4 — Review the generated code (what to look for)

```text
review the generated code — we know what to look for
```

Use this checklist. These are the exact things that were wrong or worth
confirming in a real run of this lab:

- [ ] **Right SDK for the version.** Camunda 8.9+ → `@camunda8/orchestration-cluster-api`
      (REST). `@camunda8/sdk` is only for gRPC streaming / ≤8.7 / legacy Operate queries.
- [ ] **Real package version.** The SDK versions *independently* of Camunda
      (e.g. `^9.1.x` targets 8.9). A version like `^8.9.0` does not exist — an
      invented version is a red flag that the code wasn't built against the real package.
- [ ] **Correct client bootstrap.** `createCamundaClient()` reading `CAMUNDA_*`
      env vars — not a guessed class name.
- [ ] **Job field names.** `job.jobKey` (not `job.key`); handler returns a
      `JobActionReceipt`.
- [ ] **Exactly one terminal call on every code path** — `job.complete()` /
      `job.error()` / `job.fail()`. A path that returns nothing leaks the job lease.
- [ ] **The three failure modes are distinguished:**
  - Business outcome (out of stock, payment declined) → `job.error({ errorCode })`
    → routed to the matching **boundary event**, no retry.
  - Transient failure (network, 5xx) → `job.fail({ retries, retryBackOff })`.
  - Bug (unexpected throw) → left to the SDK's fail-with-zero-backoff net.
- [ ] **`errorCode` matches the boundary event** so the token actually takes the
      error path.
- [ ] **`fetchVariables` covers what each handler reads** (and no more).
- [ ] **Idempotency guidance** — jobs can be delivered more than once; use
      `job.jobKey` / `orderId` as an idempotency key downstream.
- [ ] **Graceful shutdown** via `worker.stopGracefully(...)` on SIGTERM/SIGINT
      (there is no `close()` on the worker).
- [ ] **It actually builds.** `npm run typecheck && npm run build` are clean.

> Tip: don't take the model's word that the API is right — the surest check is
> that it installed the SDK and the code type-checks against the *real* types.

---

## Step 5 — Test it end-to-end against SaaS

Once you trust the flow, one prompt runs the whole test:

```text
Install c8ctl, connect to my SaaS cluster using the injected env vars,
deploy the BPMN, run the worker, start an instance, and verify it
completes end-to-end.
```

What Claude does under the hood:

1. `npm install -g @camunda8/cli` and verify the version.
2. Create a c8ctl `saas` profile from the credentials
   (OAuth URL `https://login.cloud.camunda.io/oauth/token`, audience `zeebe.camunda.io`);
   `c8ctl get topology --profile=saas` to confirm connectivity.
3. Deploy the `.bpmn` to the `saas` profile.
4. Write a **git-ignored** `worker/.env` with the matching `CAMUNDA_*` vars
   (`CAMUNDA_REST_ADDRESS=<baseUrl>/v2`, `CAMUNDA_AUTH_STRATEGY=OAUTH`, client
   id/secret, OAuth URL, audience).
5. Build and run the worker as a background process; confirm it boots with no
   connection errors.
6. `c8ctl await pi --id=yourname_order_process --variables='…' --profile=saas`
   and confirm the output variables show all three workers ran and the instance
   reached the "Order shipped" end event.
7. Gracefully stop the worker (SIGTERM) and confirm clean shutdown.

**How the worker connects:** a job worker is a *client*, not a server. It makes
**outbound HTTPS** calls to the cluster (OAuth token → long-poll `activateJobs`
→ `complete`/`error`/`fail`). No inbound port, public URL, or firewall change is
needed — it can run anywhere with outbound internet (your laptop, a container, a
k8s pod).

---

## Wrap-up notes

- **Prompting takeaway:** give a verifiable finish line ("type-checks and
  builds", "completes end-to-end"). It makes Claude check its own work instead
  of handing you something that only looks right.
- **You don't need to over-specify** — just the dimensions where your intent
  isn't the obvious default (here: TypeScript, the process id, "stubs only").
- **Security:** if a client secret ever appears in a session/transcript,
  **rotate it** in the Camunda Console afterward. Keep `.env` git-ignored.
- **Running it "for real"** = the same `node dist/index.js` under a supervisor
  (Docker image, k8s Deployment, systemd/PM2) — long-lived, outbound-only.
