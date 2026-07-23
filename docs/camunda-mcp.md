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

## How the secrets get supplied in each environment

`.mcp.json` only says *how to launch the server* — spawn `mcp-proxy` and hand it
five env vars. It never says where the values come from. Whatever is running
Claude Code (the **MCP client**) reads `.mcp.json`, expands the `${VAR}`
placeholders from **its own environment**, then spawns `mcp-proxy` (the **MCP
server**) as a local subprocess over stdio. Only `mcp-proxy` ever talks to the
Camunda cluster over the network.

The same config file therefore works in three places — the only thing that
changes is who fills in the secrets:

| Environment | MCP client | Where the `CAMUNDA_*` values come from |
| ----------- | ---------- | -------------------------------------- |
| Local machine | local Claude Code / CLI | `export` in your shell, or a git-ignored `.env` you source |
| GitHub Actions | Claude Code inside the runner | repo Actions secrets → job `env:` via `${{ secrets.* }}` |
| Claude Code web session | Claude Code in a remote container | env vars configured on the web execution environment |

**These environments are isolated — they do not share secrets.** GitHub Actions
secrets are visible only to Actions runs; a local shell and a web session each
need their own copy of the values. Setting a secret in one place does nothing
for the others.

Two practical notes:

- `.mcp.json` is read at Claude Code **startup**. Add or change it, then start a
  **fresh** session/run for the Camunda MCP server to be picked up.
- If the expected `CAMUNDA_*` vars aren't set in the current environment, the
  `${VAR}` placeholders expand to empty and `mcp-proxy` will fail to
  authenticate — check the environment first (e.g. `echo "$CAMUNDA_CLIENT_ID"`).

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
