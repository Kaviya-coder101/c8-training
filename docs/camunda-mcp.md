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

The same config file works everywhere Claude Code runs against this repo — the
only thing that changes is who fills in the secrets:

| Environment | MCP client | Where the `CAMUNDA_*` values come from |
| ----------- | ---------- | -------------------------------------- |
| Claude Code web session (Claude GitHub App) | Claude Code in a remote container | env vars configured on the web execution environment |
| Local machine | local Claude Code / CLI | `export` in your shell, or a git-ignored `.env` you source |

**These environments are isolated — they do not share secrets.** A web session
and a local shell each need their own copy of the values; setting them in one
place does nothing for the other.

Two practical notes:

- `.mcp.json` is read at Claude Code **startup**. Add or change it, then start a
  **fresh** session for the Camunda MCP server to be picked up.
- If the expected `CAMUNDA_*` vars aren't set in the current environment, the
  `${VAR}` placeholders expand to empty and `mcp-proxy` will fail to
  authenticate — check the environment first (e.g. `echo "$CAMUNDA_CLIENT_ID"`).

## Authentication is handled by the Claude GitHub App

This repo uses the managed **Claude GitHub App / Claude Code on the web**
integration. Authentication and billing to Anthropic are handled by that
integration (your Claude subscription) — you do **not** need to supply an
`ANTHROPIC_API_KEY`. The only credentials you provide are the `CAMUNDA_*` values
above, and those authenticate `mcp-proxy` to your cluster, not Claude to
Anthropic.

## Values to use

| Variable                 | Example value                                          |
| ------------------------ | ------------------------------------------------------ |
| `CAMUNDA_BASE_URL`       | `https://sin-1.zeebe.camunda.io/<cluster-id>`          |
| `CAMUNDA_CLIENT_ID`      | (from Camunda Console → Cluster → API client)          |
| `CAMUNDA_CLIENT_SECRET`  | (shown once when the API client is created)            |
| `CAMUNDA_OAUTH_URL`      | `https://login.cloud.camunda.io/oauth/token`           |
| `CAMUNDA_TOKEN_AUDIENCE` | `zeebe.camunda.io`                                     |

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
