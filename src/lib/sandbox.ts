export interface SandboxJob {
  scan_id: string;
  vulnerability_id: string;
  repository_id: string;

  owner: string;
  repo: string;

  repo_clone_url: string;
  commit_sha: string;

  severity: string;
  category: string;

  file_path?: string;
  line?: number;

  probe: string;
}

function mapProbe(category: string): string {
  const c = category.toLowerCase();

  if (c.includes("secret")) return "secret";
  if (c.includes("sql")) return "sqli";
  if (c.includes("ssrf")) return "ssrf";
  if (c.includes("command")) return "rce";

  return "semgrep";
}

export async function submitVerificationJob(
  job: Omit<SandboxJob, "probe">,
): Promise<{ job_id: string; status: string }> {
  const sandboxUrl = process.env.SANDBOX_URL;
  const sandboxToken = process.env.SANDBOX_API_TOKEN;

  if (!sandboxUrl) {
    throw new Error("SANDBOX_URL is not configured");
  }

  if (!sandboxToken) {
    throw new Error("SANDBOX_API_TOKEN is not configured");
  }

  const payload: SandboxJob = {
    ...job,
    probe: mapProbe(job.category),
  };

  const response = await fetch(`${sandboxUrl}/api/jobs`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${sandboxToken}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Sandbox request failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<{ job_id: string; status: string }>;
}
