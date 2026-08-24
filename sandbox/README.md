# PentestAI Self-Hosted Sandbox

Docker Compose stack that verifies vulnerabilities in ephemeral, isolated
containers. PentestAI submits jobs over HTTPS; the sandbox runs each job in a
short-lived runner container and posts a signed result back.

## Architecture

```text
 PentestAI (Lovable app)
        │  POST /api/jobs (Bearer token)
        ▼
   ┌─────────┐        ┌─────────┐        ┌────────────────┐
   │  caddy  │──────▶│   api   │──lpush▶│     redis      │
   └─────────┘        └─────────┘        └────────────────┘
                                                 │ brpop
                                                 ▼
                                            ┌─────────┐
                                            │ worker  │──spawn──▶ runner (ephemeral)
                                            └─────────┘             │
                                                 ▲                  │ clone + probe
                                                 └──── stdout ──────┘
                          POST callback (HMAC signed)
        ◀────────────────────── worker ──────────────────────
```

- **caddy** — the only internet-facing service. Terminates TLS (automatic
  Let's Encrypt certs for `SANDBOX_HOSTNAME`), routes `/api/*` to `api`, and
  returns a bare 404 for everything else — `api` itself publishes no host
  port, so it's unreachable except through caddy.
- **api** — Fastify, validates the bearer token, enqueues jobs.
- **worker** — pulls jobs, launches hardened `docker run --rm` runner containers.
- **runner** — one-shot image. Verifies javascript/typescript and python findings
  with CodeQL's `security-extended` query suite (real dataflow/taint analysis,
  not pattern matching); falls back to semgrep (bundled offline rules) for
  every other language, for the `secret` probe's non-file-specific case, and
  whenever CodeQL itself errors. trufflehog3 verifies the `secret` probe
  against the exact flagged file. Prints a JSON verdict.
- **redis** — internal-only queue + job status store.

### Why CodeQL over pattern matching

Semgrep-only verification was producing false "not_exploitable" verdicts on
real, critical findings because pattern matching can't confirm most classes
of injection/traversal bugs — it doesn't trace whether tainted input actually
reaches a dangerous sink. CodeQL builds a real code database and runs
dataflow/taint-tracking queries, so it can confirm e.g. "this request param
flows unsanitized into this SQL string" rather than just "this line looks
like a query". It's the primary engine for javascript/typescript and python
(both extract straight from source, no build step needed); other languages
still use semgrep here since a generic runner can't reliably build an
arbitrary Java/Go/etc. project.

`sarif_verdict.py` classifies CodeQL's SARIF output per probe: a result in the
AI-flagged file wins outright, otherwise a result tagged with the CWE that
probe cares about (SQLi → CWE-089, SSRF → CWE-918, etc.) counts as evidence;
unrelated security-extended findings elsewhere in the repo do not.

## Deploy on your VPS

1. Install Docker Engine + Compose plugin. Create a non-root user in the
   `docker` group.
2. Copy this `sandbox/` folder to the VPS.
3. `cp .env.example .env` and fill in real values. Generate secrets with
   `openssl rand -hex 32`.
4. Point DNS `A` record for `SANDBOX_HOSTNAME` at the VPS. Open only
   ports 80/443 in the firewall.
5. Build the runner image once:
   ```bash
   docker build -t pentestai/runner:latest runners
   ```
   This downloads the ~850 MB CodeQL CLI bundle at build time (needs
   internet on the build host only — the built image and `runner_net` stay
   fully offline). Expect several minutes depending on bandwidth.
6. Start the stack:
   ```bash
   docker compose --env-file .env up -d --build
   ```
7. Health check:
   ```bash
   curl https://$SANDBOX_HOSTNAME/api/health
   ```

## Hardening notes

- Runners get `--read-only`, `cap-drop=ALL`, `no-new-privileges`, non-root uid,
  cpu/memory/pids limits, and are attached to an `internal: true` bridge
  network (no outbound internet). Adjust `RUNNER_*` env vars in `docker-compose.yml`.
- Redis is not exposed outside `internal` network.
- Never mount host paths into runners.
- Rotate `SANDBOX_API_TOKEN` and `CALLBACK_HMAC_SECRET` periodically.
- Consider running the whole stack under a dedicated VM/VPS with automatic
  security updates and no other workloads.
- CodeQL needs materially more CPU/RAM/time than semgrep alone did — the
  `RUNNER_CPU`/`RUNNER_MEMORY`/`RUNNER_TMPFS_SIZE`/`RUNNER_TIMEOUT_SECONDS`
  defaults in `docker-compose.yml` reflect that. `RUNNER_TMPFS_SIZE` backs
  `$HOME` (CodeQL database + caches) on the read-only runner filesystem — it's
  RAM-backed, so keep it comfortably under `RUNNER_MEMORY` or the container
  gets OOM-killed mid-analysis.

## Known gaps

- CodeQL only covers javascript/typescript and python here (languages whose
  CodeQL extractor works without a build step). Java/Go/PHP/etc. repos still
  get semgrep-only verification.

## Local testing without a real domain

Caddy's automatic HTTPS only activates for an address that looks like a
public domain. For local testing, set `SANDBOX_HOSTNAME=:80` (or any other
`.env` value that isn't a real hostname) — Caddy then serves plain HTTP on
port 80 with no ACME/Let's Encrypt attempt, so you can verify routing without
DNS or a public IP:

```bash
docker compose up -d caddy api redis
curl http://localhost/api/health
```

Editing `caddy/Caddyfile` while the stack is running does not take effect
automatically — bind-mounting doesn't make Caddy re-read it. Run
`docker restart <caddy-container>` (or `docker compose restart caddy`) after
a config change.
