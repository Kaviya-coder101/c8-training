import { createCamundaClient, type CamundaClient } from "@camunda8/orchestration-cluster-api";

/**
 * A single shared Camunda 8 client for all workers in this process.
 *
 * `createCamundaClient()` is the correct bootstrap for the REST-only
 * `@camunda8/orchestration-cluster-api` SDK (the 8.9+ TypeScript path).
 * With no options it reads the standard `CAMUNDA_*` environment variables —
 * the same ones c8ctl and the Java client use — so nothing is hard-coded here.
 *
 * For Camunda 8.9 SaaS, set these (see `.env.example`):
 *   CAMUNDA_REST_ADDRESS=<baseUrl>/v2
 *   CAMUNDA_AUTH_STRATEGY=OAUTH
 *   CAMUNDA_CLIENT_ID / CAMUNDA_CLIENT_SECRET
 *   CAMUNDA_OAUTH_URL=https://login.cloud.camunda.io/oauth/token
 *   CAMUNDA_TOKEN_AUDIENCE=zeebe.camunda.io
 */
export const camunda: CamundaClient = createCamundaClient();
