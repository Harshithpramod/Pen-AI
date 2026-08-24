# PentestAI

Automated penetration testing for GitHub repositories. Connect a repo, and
PentestAI reads the code with an LLM, then **re-runs every high and critical
finding inside an isolated container** to check whether the vulnerability is
actually reachable — so the report tells you what's exploitable, not just what
looks suspicious.

> **Only scan repositories you own or are explicitly authorised to test.**

---

## How it works

```
GitHub repo
    │  read-only clone
    ▼
LLM static analysis  ──►  regex secret scan (runs first, catches committed .env files)
    │
    │  high + critical findings only
    ▼
Sandbox (self-hosted, isolated)
    │  CodeQL security-extended · dataflow/taint tracking
    ▼
HMAC-signed callback  ──►  verdict + evidence written to the finding
```

The verification step is the point of the project. Pattern matching can tell
you a line _looks_ like a SQL query; it can't tell you whether user input
actually reaches it. CodeQL builds a real database of the code and runs
taint-tracking queries, so a finding comes back `confirmed` with the dataflow
that proved it, or `not_exploitable`, or `failed` when the tooling itself
errored — a distinction that matters, because "the scanner crashed" and "the
code is safe" are not the same answer.

| Verdict           | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `confirmed`       | Reachable. Evidence attached.                                     |
| `not_exploitable` | Analysed and not reachable.                                       |
| `failed`          | The probe errored — inconclusive, **not** a clean bill of health. |
| `pending`         | Submitted to the sandbox, awaiting a result.                      |

## Stack

| Layer     | Choice                                                           |
| --------- | ---------------------------------------------------------------- |
| Framework | TanStack Start (React 19, TypeScript)                            |
| Styling   | Tailwind CSS v4, shadcn/ui, Lucide icons                         |
| Backend   | Supabase — Postgres with row-level security, Auth (GitHub OAuth) |
| AI        |  Gemini                          |
| Deploy    | Nitro → Cloudflare Workers                                       |
| Sandbox   | Docker Compose — Caddy, Fastify, Redis, worker, one-shot runner  |
| Analysis  | CodeQL (JS/TS, Python) · semgrep · trufflehog3                   |

## Getting started

Requires Node 20+ and a Supabase project.

```bash
npm install
```

Create `.env` in the repo root:

```bash
# Supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key>
PENTEST_SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Client-side equivalents
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
     # preferred
GEMINI_API_KEY=<key>           # fallback for local dev

# Sandbox (optional — scans still run, findings stay unverified without it)
SANDBOX_URL=https://sandbox.example.com
SANDBOX_API_TOKEN=<openssl rand -hex 32>
CALLBACK_HMAC_SECRET=<openssl rand -hex 32>

```bash
supabase link --project-ref <project-ref>
supabase db push
```

```bash
supabase db query --linked -f supabase/migrations/<file>.sql
```

Then run it:

```bash
npm run dev
```

| Script            | Does                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server                            |
| `npm run build`   | Production build (Nitro → Cloudflare) |
| `npm run preview` | Preview the build                     |
| `npm run lint`    | ESLint                                |
| `npm run format`  | Prettier                              |

## The sandbox

Verification runs on hardware you control, never on the app host. Runners get
`--read-only`, `cap-drop=ALL`, `no-new-privileges`, a non-root uid, CPU/memory/
PID limits, and an `internal: true` network with no outbound access. The
repository is mounted read-only and the container is destroyed after each job.

Deploy it separately — see [`sandbox/README.md`](sandbox/README.md). Building
the runner image pulls the CodeQL CLI bundle (~850 MB), so the first build
takes a few minutes.

```bash
cd sandbox
cp .env.example .env        # fill in, generate secrets with: openssl rand -hex 32
docker build -t pentestai/runner:latest runners
docker compose --env-file .env up -d --build
```

CodeQL covers JavaScript/TypeScript and Python here — the two languages whose
extractors work without a build step, which is the constraint for a runner that
has to handle arbitrary repositories unattended. Everything else falls back to
semgrep with offline rules.

## Project layout

```
src/
  routes/                    landing (/), auth, and the authenticated app
  lib/                       server functions — scans, reports, GitHub, sandbox
  components/app/ui.tsx      shared app primitives (badges, states, skeletons)
  integrations/supabase/     client, admin client, auth middleware
sandbox/                     self-hosted verification stack
supabase/migrations/         schema, RLS policies, and later additions
docs/DESIGN-SYSTEM.md        design tokens and the measurements behind them
```

## Security notes

- Repository access is **read-only**; the scanner never writes to your code.
- `github_connections` has no client-facing RLS policy — tokens are reachable
  only via the service role, server-side.
- Sandbox callbacks are HMAC-signed and bound to the originating scan and job,
  so a replayed or stray callback can't overwrite another scan's verdict.
- Findings are scoped per-user by RLS on every table.

**Known gaps**, kept here rather than in a comment nobody reads:

- GitHub tokens are stored in a column named `access_token_encrypted` but are
  **not** encrypted at rest. Either wire up Supabase Vault/`pgsodium` or rename
  the column so it stops implying a guarantee it doesn't provide.
- `sandbox/docker-compose.yml` ships a `caddy` service for TLS, but you must
  point real DNS at the host before it can issue a certificate.
- API keys can be created in Settings but nothing consumes them yet — there is
  no endpoint that authenticates with a `pta_` key.


