import {
  createCamundaClient,
  type CamundaClient,
} from "@camunda8/orchestration-cluster-api";

/**
 * Build a single shared Camunda 8 client.
 *
 * The client reads its configuration from CAMUNDA_* environment variables
 * (loaded from `.env` by dotenv in index.ts):
 *   - CAMUNDA_REST_ADDRESS   base REST endpoint (default http://localhost:8080/v2)
 *   - CAMUNDA_AUTH_STRATEGY  NONE | OAUTH | BASIC
 *   - CAMUNDA_OAUTH_URL      OAuth token endpoint (OAUTH)
 *   - CAMUNDA_CLIENT_ID      OAuth client id (OAUTH)
 *   - CAMUNDA_CLIENT_SECRET  OAuth client secret (OAUTH)
 *   - CAMUNDA_TOKEN_AUDIENCE OAuth token audience (OAUTH)
 *
 * For a local c8run cluster the defaults work with no auth
 * (CAMUNDA_AUTH_STRATEGY=NONE).
 */
export function createClient(): CamundaClient {
  return createCamundaClient();
}
