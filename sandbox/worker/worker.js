import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
import Redis from "ioredis";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";

const redis = new Redis(process.env.REDIS_URL);

const RUNNER_IMAGE = process.env.RUNNER_IMAGE || "pentestai/runner:latest";
const RUNNER_NETWORK = process.env.RUNNER_NETWORK || "sandbox_runner_net";
// CodeQL database creation + security-extended analysis needs materially more
// CPU/RAM/time than a semgrep pattern scan, so these defaults are higher than
// what plain semgrep required. Tune down if the box is small and every repo
// is falling back to semgrep anyway (unsupported language).
const RUNNER_CPU = process.env.RUNNER_CPU || "2.0";
const RUNNER_MEMORY = process.env.RUNNER_MEMORY || "3g";
const RUNNER_PIDS = process.env.RUNNER_PIDS || "512";
const RUNNER_TIMEOUT = Number(process.env.RUNNER_TIMEOUT_SECONDS || 1200);
// tmpfs backs $HOME (CodeQL DB build products, semgrep cache) — it's RAM, so
// it must stay comfortably under RUNNER_MEMORY or the container gets OOM-killed.
const RUNNER_TMPFS_SIZE = process.env.RUNNER_TMPFS_SIZE || "2g";
const CALLBACK_URL = process.env.PENTESTAI_CALLBACK_URL;
const HMAC_SECRET = process.env.CALLBACK_HMAC_SECRET;
const ARTIFACTS_VOLUME = process.env.ARTIFACTS_VOLUME || "pentestai_artifacts";

async function runDocker(args, { timeoutMs } = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    const timer = timeoutMs ? setTimeout(() => child.kill("SIGKILL"), timeoutMs) : null;
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout: out, stderr: err });
    });
  });
}

async function verify(job) {
  try {
    const cloneUrl = job.repo_clone_url || `https://github.com/${job.owner}/${job.repo}.git`;

    console.log("worker: cloning repository", cloneUrl.replace(/\/\/[^@]+@/, "//***@"));

    await runDocker([
      "run",
      "--rm",
      "-v",
      `${ARTIFACTS_VOLUME}:/artifacts`,
      "alpine",
      "mkdir",
      "-p",
      `/artifacts/${job.id}`,
    ]);

    // Clone happens in the worker, which has network access.
    const clone = await runDocker(
      [
        "run",
        "--rm",
        "--network",
        "host",
        "-v",
        `${ARTIFACTS_VOLUME}:/artifacts`,
        "alpine/git",
        "clone",
        "--depth",
        "1",
        "--no-tags",
        cloneUrl,
        `/artifacts/${job.id}/repo`,
      ],
      { timeoutMs: 120000 },
    );

    if (clone.code !== 0) {
      return {
        verdict: {
          status: "not_exploitable",
          evidence: `clone failed: ${clone.stderr.slice(-2000)}`,
        },
        exit_code: clone.code,
        duration_ms: 0,
      };
    }

    // Fetch the requested commit if it isn't available in the shallow clone.
    const fetchResult = await runDocker(
      [
        "run",
        "--rm",
        "-v",
        `${ARTIFACTS_VOLUME}:/artifacts`,
        "alpine/git",
        "-C",
        `/artifacts/${job.id}/repo`,
        "fetch",
        "--depth",
        "1",
        "origin",
        job.commit_sha,
      ],
      { timeoutMs: 120000 },
    );

    // Checkout requested commit.
    const checkoutResult = await runDocker(
      [
        "run",
        "--rm",
        "-v",
        `${ARTIFACTS_VOLUME}:/artifacts`,
        "alpine/git",
        "-C",
        `/artifacts/${job.id}/repo`,
        "checkout",
        "--quiet",
        job.commit_sha,
      ],
      { timeoutMs: 30000 },
    );

    if (checkoutResult.code !== 0) {
      return {
        verdict: {
          status: "not_exploitable",
          evidence: `commit checkout failed: ${checkoutResult.stderr.slice(-2000)}`,
        },
        exit_code: checkoutResult.code,
        duration_ms: 0,
      };
    }

    const started = Date.now();

    // Runner has NO network access.
    // Repository is mounted read-only.
    const args = [
      "run",
      "--rm",
      "--name",
      `runner-${job.id}`,
      "--network",
      RUNNER_NETWORK,
      "--cpus",
      RUNNER_CPU,
      "--memory",
      RUNNER_MEMORY,
      "--pids-limit",
      RUNNER_PIDS,
      "--read-only",
      "--tmpfs",
      `/tmp:rw,size=${RUNNER_TMPFS_SIZE}`,
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "1000:1000",

      // Prepared repository is available to the runner.
      "-v",
      `${ARTIFACTS_VOLUME}:/work:ro`,

      "-e",
      `JOB_JSON=${JSON.stringify({ ...job, repo_clone_url: undefined })}`,
      "-e",
      `REPO_PATH=/work/${job.id}/repo`,

      RUNNER_IMAGE,
    ];

    const result = await runDocker(args, {
      timeoutMs: RUNNER_TIMEOUT * 1000,
    });

    const duration = Date.now() - started;

    let verdict = {
      status: "not_exploitable",
      evidence: result.stderr.slice(-4000),
    };

    try {
      const lastLine = result.stdout.trim().split("\n").pop();

      if (lastLine) {
        verdict = {
          ...verdict,
          ...JSON.parse(lastLine),
        };
      }
    } catch {
      // Keep default verdict.
    }

    return {
      verdict,
      exit_code: result.code,
      duration_ms: duration,
    };
  } finally {
    await runDocker([
      "run",
      "--rm",
      "-v",
      `${ARTIFACTS_VOLUME}:/artifacts`,
      "alpine",
      "rm",
      "-rf",
      `/artifacts/${job.id}`,
    ]);
  }
}

async function postCallback(payload) {
  if (!CALLBACK_URL || !HMAC_SECRET) return;
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", HMAC_SECRET).update(body).digest("hex");
  await fetch(CALLBACK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sandbox-signature": sig },
    body,
  }).catch((e) => console.error("callback failed", e));
}

async function loop() {
  console.log("worker: ready");
  while (true) {
    const item = await redis.brpop("jobs:pending", 5);
    if (!item) continue;
    const job = JSON.parse(item[1]);
    console.log("worker: picked job", job.id, job.probe);
    await redis.hset(`job:${job.id}`, { status: "running", started_at: Date.now() });
    try {
      const { verdict, exit_code, duration_ms } = await verify(job);
      await redis.hset(`job:${job.id}`, {
        status: "completed",
        completed_at: Date.now(),
        exit_code,
        duration_ms,
        verdict: JSON.stringify(verdict),
      });
      await postCallback({
        job_id: job.id,
        scan_id: job.scan_id,
        vulnerability_id: job.vulnerability_id,
        verdict,
        duration_ms,
      });
    } catch (err) {
      console.error("worker: job failed", err);
      await redis.hset(`job:${job.id}`, { status: "failed", error: String(err) });
    }
  }
}

loop().catch((err) => {
  console.error(err);
  process.exit(1);
});
