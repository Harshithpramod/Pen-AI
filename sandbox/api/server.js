import Fastify from "fastify";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const app = Fastify({ logger: true, bodyLimit: 1024 * 512 });
const redis = new Redis(process.env.REDIS_URL);

const API_TOKEN = process.env.SANDBOX_API_TOKEN;
if (!API_TOKEN) throw new Error("SANDBOX_API_TOKEN missing");

// Auth: PentestAI presents a bearer token
app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/api/health") return;
  const auth = req.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token.length !== API_TOKEN.length)
    return reply.code(401).send({ error: "unauthorized" });
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ API_TOKEN.charCodeAt(i);
  if (diff !== 0) return reply.code(401).send({ error: "unauthorized" });
});

app.get("/api/health", async () => ({ ok: true }));

// Job intake. PentestAI calls this once per vulnerability it wants verified.
const JobSchema = z.object({
  scan_id: z.string().uuid(),
  vulnerability_id: z.string().uuid(),

  repository_id: z.string().uuid(),

  owner: z.string().min(1),
  repo: z.string().min(1),

  // Carries the x-access-token clone URL for private repos. zod strips
  // unrecognized keys by default, so omitting this field here silently
  // dropped it — the worker then fell back to a public github.com URL and
  // every private-repo clone failed, masking real vulnerabilities as
  // "not_exploitable" via a clone-failure verdict.
  repo_clone_url: z.string().url().optional(),

  commit_sha: z.string().min(7).max(64),

  severity: z.enum(["critical", "high", "medium", "low", "info"]),

  category: z.string(),

  file_path: z.string().optional(),

  line: z.number().optional(),

  probe: z.string(),
});

app.post("/api/jobs", async (req, reply) => {
  const parsed = JobSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const job = { id: randomUUID(), created_at: Date.now(), ...parsed.data };
  await redis.lpush("jobs:pending", JSON.stringify(job));
  await redis.hset(`job:${job.id}`, { status: "queued", created_at: job.created_at });
  return reply.code(202).send({ job_id: job.id, status: "queued" });
});

app.get("/api/jobs/:id", async (req, reply) => {
  const data = await redis.hgetall(`job:${req.params.id}`);
  if (!data || Object.keys(data).length === 0) return reply.code(404).send({ error: "not_found" });
  return data;
});

const port = Number(process.env.PORT ?? 8080);
app.listen({ host: "0.0.0.0", port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
