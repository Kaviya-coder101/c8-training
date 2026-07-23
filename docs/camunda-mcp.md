# Camunda MCP configuration

The Camunda MCP server is configured in the repo-root [`.mcp.json`](../.mcp.json).
It is committed **without secrets** — every credential is a `${VAR}` placeholder
that gets expanded from the environment when the config is loaded:

```json
"env": {
  "CAMUNDA_BASE_URL": "${CAMUNDA_BASE_URL}",
  "CAMUNDA_CLIENT_ID": "${CAMUNDA_CLIENT_ID}",
  "CAMUNDA_CLIENT_SECRET": "${CAMUNDA_CLIENT_SECRET}",
  "CAMUNDA_OAUTH_URL": "${CAMUNDA_OAUTH_URL}",
  "CAMUNDA_TOKEN_AUDIENCE": "${CAMUNDA_TOKEN_AUDIENCE}"
}
```

This keeps real secrets out of git, matching the repo's existing
`.gitignore` / `*.env.template` convention.

## In GitHub Actions

Store each value as a **GitHub Actions secret**, then map it to an environment
variable in the workflow so `.mcp.json` can expand it. This is done in
[`.github/workflows/camunda-mcp.yml`](../.github/workflows/camunda-mcp.yml):

```yaml
jobs:
  camunda-mcp:
    runs-on: ubuntu-latest
    env:
      CAMUNDA_BASE_URL: ${{ secrets.CAMUNDA_BASE_URL }}
      CAMUNDA_CLIENT_ID: ${{ secrets.CAMUNDA_CLIENT_ID }}
      CAMUNDA_CLIENT_SECRET: ${{ secrets.CAMUNDA_CLIENT_SECRET }}
      CAMUNDA_OAUTH_URL: ${{ secrets.CAMUNDA_OAUTH_URL }}
      CAMUNDA_TOKEN_AUDIENCE: ${{ secrets.CAMUNDA_TOKEN_AUDIENCE }}
```

The `${{ secrets.NAME }}` expression is GitHub's — it injects the secret into
the job. The `${VAR}` in `.mcp.json` is the MCP loader's — it reads that same
env var back out. The secret value never touches a committed file.

### Add the secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name              | Example value                                          |
| ------------------------ | ------------------------------------------------------ |
| `CAMUNDA_BASE_URL`       | `https://sin-1.zeebe.camunda.io/<cluster-id>`          |
| `CAMUNDA_CLIENT_ID`      | (from Camunda Console → Cluster → API client)          |
| `CAMUNDA_CLIENT_SECRET`  | (shown once when the API client is created)            |
| `CAMUNDA_OAUTH_URL`      | `https://login.cloud.camunda.io/oauth/token`           |
| `CAMUNDA_TOKEN_AUDIENCE` | `zeebe.camunda.io`                                     |
| `ANTHROPIC_API_KEY`      | (for the Claude Code action)                           |

Or with the `gh` CLI:

```bash
gh secret set CAMUNDA_CLIENT_SECRET   # prompts for the value, never echoes it
```

## Locally

Export the same variables in your shell (or source a git-ignored `.env`) before
starting Claude Code / the MCP client:

```bash
export CAMUNDA_BASE_URL="https://sin-1.zeebe.camunda.io/<cluster-id>"
export CAMUNDA_CLIENT_ID="..."
export CAMUNDA_CLIENT_SECRET="..."
export CAMUNDA_OAUTH_URL="https://login.cloud.camunda.io/oauth/token"
export CAMUNDA_TOKEN_AUDIENCE="zeebe.camunda.io"
```

> Rotate the client secret in the Camunda Console if it is ever pasted into a
> terminal, chat, or transcript.
