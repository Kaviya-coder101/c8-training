import { CamundaRestApi } from "@camunda8/orchestration-cluster-api";

/**
 * Build a single shared Camunda 8 REST client.
 *
 * When the constructor options are omitted, the client reads the same
 * CAMUNDA_* environment variables that c8ctl and the Java client use:
 *   - CAMUNDA_BASE_URL / baseUrl
 *   - CAMUNDA_OAUTH_URL
 *   - CAMUNDA_CLIENT_ID
 *   - CAMUNDA_CLIENT_SECRET
 *   - CAMUNDA_TOKEN_AUDIENCE
 *
 * For a local c8run cluster, baseUrl defaults to http://localhost:8080 and no
 * OAuth credentials are required.
 */
export function createClient() {
  const baseUrl = process.env.CAMUNDA_BASE_URL ?? "http://localhost:8080";

  return new CamundaRestApi({
    baseUrl,
    // OAuth / basic-auth options are picked up from CAMUNDA_* env vars when omitted.
  });
}
