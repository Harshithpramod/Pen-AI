import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { submitVerificationJob } from "@/lib/sandbox";

// ---------------- Utilities (server-only) ----------------

const SCANNABLE_EXTS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "scala",
  "php",
  "cs",
  "c",
  "cpp",
  "h",
  "hpp",
  "sol",
  "sql",
  "yaml",
  "yml",
  "toml",
  "env",
  "dockerfile",
  "sh",
  "bash",
];
const MAX_FILES = 18;
const MAX_FILE_BYTES = 30_000;
const MAX_TOTAL_BYTES = 250_000;

async function ghFetch(token: string, url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PentestAI",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function getUserAccessToken(userId: string): Promise<string> {
  const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from("github_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_token_encrypted) throw new Error("GitHub is not connected");
  return data.access_token_encrypted as string;
}

function isSecretBearing(path: string): boolean {
  const lower = path.toLowerCase();
  const base = lower.split("/").pop() ?? "";
  // .env, .env.local, .env.production, .envrc, secrets.json, credentials, *.pem, *.key
  if (/^\.env(\..+)?$/.test(base)) return true;
  if (base === ".envrc" || base === "credentials" || base === "secrets") return true;
  if (/^(secrets?|credentials?)\.(json|ya?ml|toml|txt|config)$/.test(base)) return true;
  if (/\.(pem|key|pfx|p12|keystore)$/.test(base)) return true;
  return false;
}

function pickScannable(paths: Array<{ path: string; size: number; sha: string }>) {
  const ranked = paths
    .filter((n) => {
      if (n.size > MAX_FILE_BYTES) return false;
      const lower = n.path.toLowerCase();
      if (lower.includes("node_modules/") || lower.includes(".min.")) return false;
      if (lower.includes("/dist/") || lower.includes("/build/") || lower.includes("/vendor/"))
        return false;
      if (lower.endsWith("package-lock.json") || lower.endsWith("yarn.lock")) return false;
      const ext = lower.split(".").pop() ?? "";
      const base = lower.split("/").pop() ?? "";
      if (isSecretBearing(n.path)) return true;
      return SCANNABLE_EXTS.includes(ext) || base === "dockerfile";
    })
    // Prefer files whose paths hint at security-sensitive surface area
    .sort((a, b) => {
      const score = (p: string) => {
        let s = 0;
        if (isSecretBearing(p)) s += 20; // secrets first
        if (/auth|login|password|token|secret|jwt|session/i.test(p)) s += 5;
        if (/api|route|handler|controller|middleware/i.test(p)) s += 3;
        if (/sql|query|db|database/i.test(p)) s += 3;
        if (/upload|file|exec|shell|proc/i.test(p)) s += 2;
        if (/config|env/i.test(p)) s += 2;
        return s;
      };
      return score(b.path) - score(a.path);
    });
  const selected: typeof ranked = [];
  let total = 0;
  for (const f of ranked) {
    if (selected.length >= MAX_FILES) break;
    if (total + f.size > MAX_TOTAL_BYTES) continue;
    selected.push(f);
    total += f.size;
  }
  return selected;
}

// Deterministic regex-based secret detection. Runs BEFORE the AI pass so a
// committed .env / API key is never missed even if the model overlooks it.
type SecretHit = {
  file_path: string;
  line: number;
  kind: string;
  match: string;
};

const SECRET_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "AWS Access Key ID", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  {
    kind: "AWS Secret Access Key",
    re: /aws[_-]?secret[_-]?access[_-]?key["'\s:=]+([A-Za-z0-9/+=]{40})/gi,
  },
  { kind: "GitHub Token", re: /\b(gh[pousr]_[A-Za-z0-9]{36,255})\b/g },
  { kind: "GitHub Fine-grained PAT", re: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g },
  { kind: "Google API Key", re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { kind: "OpenAI API Key", re: /\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b/g },
  { kind: "Anthropic API Key", re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g },
  { kind: "Stripe Secret Key", re: /\b(sk|rk)_(live|test)_[0-9A-Za-z]{20,}\b/g },
  { kind: "Slack Token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  {
    kind: "Supabase Service Role JWT",
    re: /\beyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g,
  },
  { kind: "Private Key Block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
  {
    kind: "Generic High-Entropy Assignment",
    re: /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']/gi,
  },
];

function scanForSecrets(files: Array<{ path: string; content: string }>): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const f of files) {
    const lines = f.content.split(/\r?\n/);
    // Also scan raw .env-style KEY=VALUE lines where the value has any length >= 8.
    const isEnv = /^\.env(\..+)?$|\/\.env(\..+)?$|\.envrc$/i.test(f.path);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("#") || !line.trim()) continue;

      for (const { kind, re } of SECRET_PATTERNS) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          hits.push({ file_path: f.path, line: i + 1, kind, match: m[0].slice(0, 12) + "…" });
        }
      }

      if (isEnv) {
        const envMatch = /^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(line.trim());
        if (envMatch) {
          const key = envMatch[1];
          const val = envMatch[2].replace(/^["']|["']$/g, "");
          const looksSensitive = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIAL|DSN|URL/i.test(
            key,
          );
          if (
            looksSensitive &&
            val.length >= 8 &&
            !/^(your[_-]|xxx|change[_-]?me|example|placeholder|<.+>)/i.test(val)
          ) {
            hits.push({
              file_path: f.path,
              line: i + 1,
              kind: `Exposed .env variable (${key})`,
              match: val.slice(0, 6) + "…",
            });
          }
        }
      }
    }
  }
  // Deduplicate on file+line+kind
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.file_path}:${h.line}:${h.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const findingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          // Must match the DB enum public.severity_level exactly — it has no
          // "info" value, and a single out-of-range row fails the whole insert
          // batch (and thus the whole scan, per the catch block below).
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          category: { type: "string" },
          cwe_id: { type: "string" },
          owasp_category: { type: "string" },
          cvss_score: { type: "number" },
          file_path: { type: "string" },
          line_start: { type: "integer" },
          line_end: { type: "integer" },
          description: { type: "string" },
          remediation_steps: { type: "array", items: { type: "string" } },
          ai_analysis: { type: "string" },
        },
        required: [
          "title",
          "severity",
          "category",
          "cwe_id",
          "owasp_category",
          "cvss_score",
          "file_path",
          "line_start",
          "line_end",
          "description",
          "remediation_steps",
          "ai_analysis",
        ],
      },
    },
    security_score: { type: "integer" },
    summary: { type: "string" },
  },
  required: ["findings", "security_score", "summary"],
} as const;

type AIResult = {
  findings: Array<{
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    cwe_id: string;
    owasp_category: string;
    cvss_score: number;
    file_path: string;
    line_start: number;
    line_end: number;
    description: string;
    remediation_steps: string[];
    ai_analysis: string;
  }>;
  security_score: number;
  summary: string;
};

async function insertLog(
  supabaseAdmin: any,
  scanId: string,
  userId: string,
  stage: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  await supabaseAdmin.from("scan_logs").insert({
    scan_id: scanId,
    user_id: userId,
    stage,
    level,
    message,
  });
}

// ---------------- Server functions ----------------

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ repositoryId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { callAI } = await import("@/lib/ai-gateway.server");

    // 1. Fetch repo & auth
    const { data: repo, error: repoErr } = await supabaseAdmin
      .from("repositories")
      .select("*")
      .eq("id", data.repositoryId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (repoErr) throw repoErr;
    if (!repo) throw new Error("Repository not found");

    const token = await getUserAccessToken(context.userId);

    // 2. Create scan row
    const { data: scanRow, error: scanErr } = await supabaseAdmin
      .from("scans")
      .insert({
        repository_id: repo.id,
        user_id: context.userId,
        trigger: "manual",
        profile: repo.scan_depth ?? "standard",
        branch: repo.default_branch,
        status: "running",
        current_stage: "initializing",
        progress: 5,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (scanErr) throw scanErr;
    const scanId = scanRow.id as string;

    // Run the pipeline; capture any error to mark the scan failed.
    try {
      await supabaseAdmin.from("repositories").update({ status: "testing" }).eq("id", repo.id);
      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "init",
        `Starting scan of ${repo.full_name}`,
      );

      // 3. Get default branch tip SHA
      await insertLog(supabaseAdmin, scanId, context.userId, "fetch", "Resolving default branch…");
      const branchRes = await ghFetch(
        token,
        `https://api.github.com/repos/${repo.full_name}/branches/${encodeURIComponent(repo.default_branch)}`,
      );
      const branchJson = (await branchRes.json()) as { commit: { sha: string } };
      const commitSha = branchJson.commit.sha;
      await supabaseAdmin
        .from("scans")
        .update({ commit_sha: commitSha, current_stage: "listing_files", progress: 15 })
        .eq("id", scanId);

      // 4. Enumerate tree
      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "fetch",
        "Enumerating repository tree…",
      );
      const treeRes = await ghFetch(
        token,
        `https://api.github.com/repos/${repo.full_name}/git/trees/${commitSha}?recursive=1`,
      );
      const tree = (await treeRes.json()) as {
        tree: Array<{ path: string; type: string; size?: number; sha: string }>;
        truncated: boolean;
      };
      const files = tree.tree
        .filter((n) => n.type === "blob" && typeof n.size === "number")
        .map((n) => ({ path: n.path, size: n.size as number, sha: n.sha }));

      const selected = pickScannable(files);
      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "select",
        `Selected ${selected.length} of ${files.length} files for AI analysis`,
      );
      await supabaseAdmin
        .from("scans")
        .update({ current_stage: "downloading", progress: 30 })
        .eq("id", scanId);

      // 5. Download file contents
      const contents: Array<{ path: string; content: string }> = [];
      for (const f of selected) {
        const blobRes = await ghFetch(
          token,
          `https://api.github.com/repos/${repo.full_name}/git/blobs/${f.sha}`,
        );
        const blob = (await blobRes.json()) as { content: string; encoding: string };
        if (blob.encoding !== "base64") continue;
        const text = atob(blob.content.replace(/\n/g, ""));
        contents.push({ path: f.path, content: text.slice(0, MAX_FILE_BYTES) });
      }

      await supabaseAdmin
        .from("scans")
        .update({ current_stage: "analyzing", progress: 55 })
        .eq("id", scanId);

      // 6a. Deterministic secret scan (regex-based, runs before AI).
      const secretHits = scanForSecrets(contents);
      if (secretHits.length > 0) {
        await insertLog(
          supabaseAdmin,
          scanId,
          context.userId,
          "secrets",
          `Detected ${secretHits.length} hardcoded secret(s) / exposed credential(s).`,
          "warn",
        );
      }

      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "analyze",
        "Running AI security analysis…",
      );

      // 6b. Compose AI prompt (single call, findings for all files)
      const codeBundle = contents.map((c) => `--- FILE: ${c.path} ---\n${c.content}`).join("\n\n");

      const secretHint = secretHits.length
        ? `\n\nPRE-DETECTED SECRETS (already flagged by regex, do NOT duplicate — treat as confirmed context):\n` +
          secretHits.map((h) => `- ${h.file_path}:${h.line} ${h.kind}`).join("\n")
        : "";

      const system = `You are a senior application security engineer performing a static code review.
Identify real, exploitable vulnerabilities. Explicitly INCLUDE:
- Hardcoded secrets, API keys, tokens, passwords, private keys, or credentials committed to source (including .env / .env.* / config files). Any real-looking credential value in a committed file is a HIGH or CRITICAL finding (CWE-798 "Use of Hard-coded Credentials" or CWE-540 "Inclusion of Sensitive Information in Source Code"), even if it "looks like" a placeholder unless it is obviously a template value like "your_api_key_here", "xxx", "changeme", or "<...>".
- Injection (SQLi, command, SSRF, XSS), broken auth/session, IDOR, insecure deserialization, path traversal, unsafe file uploads, missing authz, weak crypto, insecure defaults.
Do NOT report style issues or purely speculative concerns.
For each finding: cite the exact file_path and line range, assign an accurate CWE, an OWASP category (e.g. "A02:2021 Cryptographic Failures", "A07:2021 Identification and Authentication Failures"), and a realistic CVSS 3.1 base score (0.0-10.0).
If nothing significant is present, return an empty findings array.
Compute an overall security_score (0-100, higher = safer) reflecting the sampled code.`;

      const user = `Repository: ${repo.full_name}
Language: ${repo.language ?? "unknown"}
Files reviewed (${contents.length}):${secretHint}

${codeBundle}`;

      const ai = (await callAI<AIResult>({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        jsonSchema: { name: "pentest_findings", schema: findingSchema as any },
        temperature: 0.1,
      })) as AIResult;

      // Merge regex-detected secrets as findings (deduped against AI output by file+line).
      const aiKeys = new Set(ai.findings.map((f) => `${f.file_path}:${f.line_start}`));
      const secretFindings: AIResult["findings"] = secretHits
        .filter((h) => !aiKeys.has(`${h.file_path}:${h.line}`))
        .map((h) => {
          const isEnv = /\.env(\..+)?$|\.envrc$/i.test(h.file_path);
          const severity: AIResult["findings"][number]["severity"] = isEnv ? "critical" : "high";
          return {
            title: `Hardcoded credential: ${h.kind}`,
            severity,
            category: "Secrets Exposure",
            cwe_id: "CWE-798",
            owasp_category: "A07:2021 Identification and Authentication Failures",
            cvss_score: isEnv ? 9.1 : 8.2,
            file_path: h.file_path,
            line_start: h.line,
            line_end: h.line,
            description: `A ${h.kind} appears to be committed to source at ${h.file_path}:${h.line} (value starts with "${h.match}"). Any secret committed to a repository must be considered compromised — it is exposed to anyone with repo access and to every downstream fork, clone, and CI cache, and cannot be revoked by deleting the file.`,
            remediation_steps: [
              "Immediately rotate/revoke the exposed credential at the issuing provider.",
              "Remove the value from the file and load it from a secret manager or environment variable that is NOT committed.",
              "Add the file (e.g. `.env`) to `.gitignore` and commit a `.env.example` with placeholder values only.",
              "Purge the secret from git history (e.g. `git filter-repo` or BFG) and force-push, then invalidate any caches/mirrors.",
              "Audit access logs for the credential to check for unauthorized use before rotation.",
            ],
            ai_analysis: `Detected via deterministic regex pattern for ${h.kind}. Committing secrets to source is CWE-798 (Use of Hard-coded Credentials).`,
          };
        });

      const allFindings = [...secretFindings, ...ai.findings];

      // Penalize the security score when secrets were found.
      let securityScore = ai.security_score;
      if (secretFindings.length > 0) {
        securityScore = Math.min(securityScore, 35 - Math.min(20, secretFindings.length * 5));
      }

      await supabaseAdmin
        .from("scans")
        .update({ current_stage: "persisting", progress: 85 })
        .eq("id", scanId);
      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "analyze",
        `Analysis returned ${allFindings.length} finding(s) (${secretFindings.length} from secret scan, ${ai.findings.length} from AI). Persisting…`,
      );

      // 7. Insert vulnerabilities
      const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      if (allFindings.length > 0) {
        const rows = allFindings.map((f) => {
          counts[f.severity] = (counts[f.severity] ?? 0) + 1;
          return {
            scan_id: scanId,
            repository_id: repo.id,
            user_id: context.userId,
            title: f.title,
            severity: f.severity,
            status: "open",
            category: f.category,
            cwe_id: f.cwe_id,
            owasp_category: f.owasp_category,
            cvss_score: f.cvss_score,
            file_path: f.file_path,
            line_start: f.line_start,
            line_end: f.line_end,
            description: f.description,
            remediation_steps: f.remediation_steps,
            ai_analysis: f.ai_analysis,
            detected_by_agents:
              f.category === "Secrets Exposure" ? ["secret-scanner"] : ["ai-static-analyzer"],
          };
        });
        const { data: insertedVulnerabilities, error: vulnErr } = await supabaseAdmin
          .from("vulnerabilities")
          .insert(rows)
          .select();

        if (vulnErr) throw vulnErr;
        if (insertedVulnerabilities) {
          for (const vulnerability of insertedVulnerabilities) {
            // Only verify High and Critical findings
            if (vulnerability.severity !== "high" && vulnerability.severity !== "critical") {
              continue;
            }

            try {
              const sandboxResult = await submitVerificationJob({
                scan_id: scanRow.id,
                vulnerability_id: vulnerability.id,
                repository_id: repo.id,
                owner: repo.full_name.split("/")[0],
                repo: repo.full_name.split("/")[1],
                repo_clone_url: `https://x-access-token:${token}@github.com/${repo.full_name}.git`,
                commit_sha: commitSha,
                severity: vulnerability.severity,
                category: vulnerability.category,
                file_path: vulnerability.file_path ?? undefined,
              });

              await supabaseAdmin
                .from("vulnerabilities")
                .update({
                  sandbox_job_id: sandboxResult.job_id,
                  verification_status: "pending",
                })
                .eq("id", vulnerability.id);

              console.log(
                `Submitted ${vulnerability.title} to sandbox (job ${sandboxResult.job_id})`,
              );
            } catch (err) {
              console.error(`Failed to submit ${vulnerability.title} to sandbox`, err);
            }
          }
        }
      }

      // 8. Finalize scan + repo
      const startedAt = new Date(scanRow.started_at as string).getTime();
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const repoStatus =
        counts.critical > 0 || counts.high > 0
          ? "vulnerable"
          : allFindings.length === 0
            ? "secure"
            : "vulnerable";

      await supabaseAdmin
        .from("scans")
        .update({
          status: "completed",
          current_stage: "done",
          progress: 100,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSec,
          critical_count: counts.critical,
          high_count: counts.high,
          medium_count: counts.medium,
          low_count: counts.low,
          security_score: securityScore,
        })
        .eq("id", scanId);

      await supabaseAdmin
        .from("repositories")
        .update({
          status: repoStatus,
          security_score: securityScore,
          last_scan_at: new Date().toISOString(),
        })
        .eq("id", repo.id);

      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "done",
        `Scan complete — score ${securityScore}, ${allFindings.length} finding(s)`,
      );

      return { scanId, findings: allFindings.length, score: securityScore, summary: ai.summary };
    } catch (err: any) {
      await supabaseAdmin
        .from("scans")
        .update({
          status: "failed",
          error_message: String(err?.message ?? err).slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanId);
      await insertLog(
        supabaseAdmin,
        scanId,
        context.userId,
        "error",
        `Scan failed: ${String(err?.message ?? err)}`,
        "error",
      );
      throw err;
    }
  });

export const getScanDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ scanId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { data: scan } = await supabaseAdmin
      .from("scans")
      .select("*, repositories(full_name)")
      .eq("id", data.scanId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!scan) return { scan: null, logs: [] };

    const { data: logs } = await supabaseAdmin
      .from("scan_logs")
      .select("*")
      .eq("scan_id", data.scanId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    return { scan, logs: logs ?? [] };
  });
