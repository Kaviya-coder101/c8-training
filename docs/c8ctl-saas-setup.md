# Connecting c8ctl to Camunda 8 SaaS

A step-by-step guide for setting up the [c8ctl](https://docs.camunda.io/docs/apis-tools/c8ctl/getting-started/)
CLI against a Camunda 8 **SaaS** cluster.

There are two paths below:

- **Part 1 – Standard setup** (your laptop or any normal machine). Follow this first.
- **Part 2 – Claude Code on the web** extra steps. Only needed if you run c8ctl
  inside a Claude Code web sandbox, which routes all traffic through a proxy.

---

## Prerequisites

- **Node.js ≥ 22.18.0** (c8ctl needs native TypeScript support). Check with `node --version`.
- Access to a **Camunda 8 SaaS cluster** and permission to create API client credentials.

## Step 1 — Get your cluster credentials from the Console

1. Log in to the [Camunda Console](https://console.camunda.io/).
2. Open your **Cluster → API** tab.
3. **Create a client** with the **Zeebe** scope (see
   [Manage API clients](https://docs.camunda.io/docs/components/console/manage-clusters/manage-api-clients/#create-a-client)).
4. On the credentials page, copy these values (the secret is shown **only once**):

   | Console value | Used as |
   |---|---|
   | Cluster REST/API base URL, e.g. `https://<region>.api.camunda.io/<clusterId>` | `--baseUrl` |
   | Client ID | `--clientId` |
   | Client secret | `--clientSecret` |
   | OAuth token URL — always `https://login.cloud.camunda.io/oauth/token` for SaaS | `--oAuthUrl` |
   | Audience — always `zeebe.camunda.io` for SaaS | `--audience` |

   > The credentials page has a "copy c8ctl snippet" button that pre-fills these for you.

## Step 2 — Install c8ctl

```bash
npm install -g @camunda8/cli
c8ctl --version        # expect v3.x or newer
```

`c8ctl` and the short alias `c8` are now both available.

## Step 3 — Create the SaaS profile

Pick **one** of the two approaches.

### Approach A — a named profile (recommended)

Store the connection once under a profile name (`saas`):

```bash
c8ctl add profile saas \
  --baseUrl="https://<region>.api.camunda.io/<clusterId>" \
  --clientId="<your-client-id>" \
  --clientSecret="<your-client-secret>" \
  --oAuthUrl="https://login.cloud.camunda.io/oauth/token" \
  --audience="zeebe.camunda.io"
```

> `c8ctl` has **no** `--from-env` / `--from-file` flag — the flags above are the
> complete set. To avoid pasting the secret literally, keep it in a file and expand
> it (Approach B) or use shell variables: `--clientSecret="$CAMUNDA_CLIENT_SECRET"`.

### Approach B — from environment variables (good for CI / no stored secret)

This repo ships a template: **`saas.env.template`**.

```bash
cp saas.env.template saas.env      # saas.env is git-ignored — never commit it
# edit saas.env and fill in CAMUNDA_CLIENT_ID and CAMUNDA_CLIENT_SECRET

set -a; . ./saas.env; set +a       # export all CAMUNDA_* vars into your shell
```

Now either create a persistent profile from those vars…

```bash
c8ctl add profile saas \
  --baseUrl="$CAMUNDA_BASE_URL" \
  --clientId="$CAMUNDA_CLIENT_ID" \
  --clientSecret="$CAMUNDA_CLIENT_SECRET" \
  --oAuthUrl="$CAMUNDA_OAUTH_URL" \
  --audience="$CAMUNDA_TOKEN_AUDIENCE"
```

…or skip the profile entirely — c8ctl resolves `CAMUNDA_*` from the environment
automatically (resolution order: `--profile` flag → active profile → env vars → localhost):

```bash
c8ctl get topology            # uses the exported env vars, no profile needed
```

## Step 4 — Verify the connection

```bash
c8ctl get topology --profile=saas
```

A healthy result lists your brokers, partitions, replication factor, and Zeebe version.
List what's deployed:

```bash
c8ctl list pd --profile=saas        # process definitions
c8ctl list pi --profile=saas        # running process instances
```

Deploy and run a resource from this repo:

```bash
c8ctl deploy ./po-update-review.bpmn --profile=saas
c8ctl run ./po-update-review.bpmn --profile=saas
```

> **Safety habit:** always pass `--profile=saas` explicitly on cluster-touching
> commands rather than relying on `c8ctl use profile saas`. The active profile can
> silently point at the wrong cluster from an earlier session.

---

## Part 2 — Extra steps for Claude Code on the web

Claude Code web sessions run in a sandbox where **all outbound traffic goes through a
proxy**. Two things must be configured or c8ctl fails with `HTTP 403`.

### 2a. Allow the Camunda hosts in the network policy

The default **Trusted** network access level only allows package registries and GitHub —
not Camunda. Edit the environment, set **Network access → Custom**, tick
**"Also include default list of common package managers"**, and add:

```
*.api.camunda.io
*.cloud.camunda.io
```

Symptom if this is missing: `CONNECT tunnel failed, response 403` /
`connect_rejected` in the proxy status.

### 2b. Make Node route through the proxy

c8ctl's Node HTTP client ignores `HTTPS_PROXY` by default, so its requests bypass the
proxy and get blocked. Enable env-proxy support:

```bash
export NODE_USE_ENV_PROXY=1
```

Symptom if this is missing: the OAuth call to `login.cloud.camunda.io/oauth/token`
returns `HTTP 403` even though a plain `curl` to the same URL succeeds.

### Recommended one-time session setup

```bash
export C8CTL_DATA_DIR="$HOME/.config/c8ctl"   # writable profile storage in the sandbox
export NODE_USE_ENV_PROXY=1
c8ctl get topology --profile=saas
```

To make these permanent, add `NODE_USE_ENV_PROXY=1` (and the network-policy change) to
the **environment variables** in your environment settings so they survive restarts.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `CONNECT tunnel failed, response 403` | Web sandbox network policy blocks Camunda hosts | Part 2a — allow `*.api.camunda.io`, `*.cloud.camunda.io` |
| OAuth `403` but `curl` to the token URL works | Node not using the proxy | Part 2b — `export NODE_USE_ENV_PROXY=1` |
| `401 Unauthorized` | Wrong base URL (used the dashboard URL, not the REST/API URL), or bad credentials | Re-copy the REST/API base URL and client credentials from Console |
| `audience not allowed` | Missing/incorrect audience | Add `--audience=zeebe.camunda.io` |
| `unable to discover token endpoint` | OAuth auto-discovery blocked | Add `--oAuthUrl=https://login.cloud.camunda.io/oauth/token` |
| `command not found: c8ctl` | npm global bin not on PATH | Add `$(npm config get prefix)/bin` to `PATH` |
| `Node.js version too old` | Node < 22.18.0 | Upgrade Node (nvm/asdf) |

## Security notes

- **Never commit `saas.env`** or real secrets. `.gitignore` already ignores `*.env`;
  only `*.env.template` files are tracked.
- If a client secret was ever pasted into a terminal, chat, or transcript, **rotate it**
  in the Camunda Console.
- A stored profile keeps the secret on disk (`$C8CTL_DATA_DIR`). In ephemeral sandboxes
  it disappears when the container is reclaimed — that's expected; re-run the setup.
