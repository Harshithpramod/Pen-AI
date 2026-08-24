import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Sev = "critical" | "high" | "medium" | "low" | "info";

function scoreFromCounts(counts: Record<Sev, number>) {
  const penalty = counts.critical * 25 + counts.high * 12 + counts.medium * 5 + counts.low * 2;
  return Math.max(0, Math.min(100, 100 - penalty));
}

async function buildPayload(supabaseAdmin: any, scanId: string, userId: string) {
  const { data: scan } = await supabaseAdmin
    .from("scans")
    .select("*, repositories(id, full_name, owner, name, default_branch, language)")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!scan) throw new Error("Scan not found");

  const { data: vulns } = await supabaseAdmin
    .from("vulnerabilities")
    .select("*")
    .eq("scan_id", scanId)
    .order("cvss_score", { ascending: false });

  const list = (vulns ?? []) as any[];
  const counts: Record<Sev, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const v of list) counts[(v.severity as Sev) ?? "info"] += 1;

  const score = scan.security_score ?? scoreFromCounts(counts);
  const repo = scan.repositories;

  const summary =
    `Scan of ${repo?.full_name ?? "repository"} completed on ${new Date(
      scan.completed_at ?? scan.created_at,
    ).toUTCString()}. ` +
    `${list.length} finding(s): ${counts.critical} critical, ${counts.high} high, ` +
    `${counts.medium} medium, ${counts.low} low. Security score ${score}/100.`;

  return {
    generated_at: new Date().toISOString(),
    tool: "PentestAI",
    repository_id: (repo?.id ?? scan.repository_id) as string | null,
    repository: repo
      ? {
          full_name: repo.full_name,
          owner: repo.owner,
          name: repo.name,
          default_branch: repo.default_branch,
          language: repo.language,
        }
      : null,
    scan: {
      id: scan.id,
      profile: scan.profile,
      trigger: scan.trigger,
      status: scan.status,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      duration_seconds: scan.duration_seconds,
    },
    security_score: score,
    summary,
    counts,
    findings: list.map((v) => ({
      title: v.title,
      severity: v.severity,
      status: v.status,
      category: v.category,
      cwe_id: v.cwe_id,
      owasp_category: v.owasp_category,
      cvss_score: v.cvss_score,
      file_path: v.file_path,
      line_start: v.line_start,
      line_end: v.line_end,
      description: v.description,
      remediation_steps: v.remediation_steps,
      verification_status: v.verification_status,
      ai_analysis: v.ai_analysis,
    })),
  };
}

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ scanId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const payload = await buildPayload(supabaseAdmin, data.scanId, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("reports")
      .select("id")
      .eq("scan_id", data.scanId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("reports")
        .update({ summary: payload.summary, security_score: payload.security_score })
        .eq("id", existing.id);
      return { reportId: existing.id as string, payload };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("reports")
      .insert({
        scan_id: data.scanId,
        repository_id: payload.repository_id,
        user_id: context.userId,
        summary: payload.summary,
        security_score: payload.security_score,
        format: "json",
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return { reportId: inserted?.id as string, payload };
  });

export const getReportPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ scanId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    return buildPayload(supabaseAdmin, data.scanId, context.userId);
  });

export const listCompletedScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { data } = await supabaseAdmin
      .from("scans")
      .select(
        "id, completed_at, security_score, critical_count, high_count, repositories(full_name)",
      )
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50);
    return (data ?? []) as any[];
  });
