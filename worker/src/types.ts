import type {
  EnrichedActivatedJob,
  JobWorkerConfig,
} from "@camunda8/orchestration-cluster-api";

/**
 * The activated job passed to a handler, with the convenience methods
 * `complete` / `fail` / `error` and fields like `variables`, `retries`,
 * `jobKey`. Aliased here so worker modules don't each import the SDK type.
 */
export type Job = EnrichedActivatedJob;

/** Worker config minus the handler (the handler is wired in index.ts). */
export type WorkerConfig = Omit<JobWorkerConfig, "jobHandler">;
