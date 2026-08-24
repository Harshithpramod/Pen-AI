import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  FileText,
  Bot,
  Wrench,
  Calendar,
  Target,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SeverityBadge, StatusBadge, SkeletonRows, EmptyState } from "@/components/app/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vulnerabilities")({
  head: () => ({
    meta: [
      { title: "Vulnerabilities — PentestAI" },
      {
        name: "description",
        content: "Review vulnerabilities found across your repositories.",
      },
    ],
  }),
  component: VulnPage,
});

const sevColor: Record<string, string> = {
  critical: "text-critical bg-critical/15 border-critical/30",
  high: "text-high bg-high/15 border-high/30",
  medium: "text-medium bg-medium/15 border-medium/30",
  low: "text-low bg-low/15 border-low/30",
  info: "text-muted-foreground bg-muted border-border",
};

const severities = ["all", "critical", "high", "medium", "low", "info"] as const;

const verificationConfig: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  unverified: { label: "Unverified", color: "text-muted-foreground", icon: Shield },
  pending: { label: "Verifying…", color: "text-accent-fg", icon: Loader2 },
  confirmed: { label: "Confirmed", color: "text-critical", icon: ShieldAlert },
  not_exploitable: { label: "Not Exploitable", color: "text-low", icon: ShieldCheck },
  failed: { label: "Verification Failed", color: "text-medium", icon: ShieldX },
};

function VerificationBadge({ status }: { status: string }) {
  const cfg = verificationConfig[status] ?? verificationConfig.unverified;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}>
      <Icon className={`h-3 w-3 ${status === "pending" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

function VulnPage() {
  const [filter, setFilter] = useState<(typeof severities)[number]>("all");
  const [selected, setSelected] = useState<any>(null);
  const qc = useQueryClient();

  const { data: vulns = [], isLoading } = useQuery({
    queryKey: ["vulnerabilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vulnerabilities")
        .select("*, repositories(full_name)")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => {
      const items = (q.state.data as any[]) ?? [];
      const hasPending = items.some((v: any) => v.verification_status === "pending");
      return hasPending ? 5000 : false;
    },
  });

  // Realtime: refresh when any vulnerability row is updated
  useEffect(() => {
    const channel = supabase
      .channel("vuln-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vulnerabilities" },
        () => {
          qc.invalidateQueries({ queryKey: ["vulnerabilities"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Keep dialog data fresh when the list refreshes
  useEffect(() => {
    if (!selected) return;
    const fresh = vulns.find((v: any) => v.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [vulns, selected]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("vulnerabilities")
        .update({
          status,
          fixed_at: status === "fixed" ? new Date().toISOString() : null,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["vulnerabilities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter === "all" ? vulns : vulns.filter((v: any) => v.severity === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {severities.map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            className="capitalize"
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={5} className="p-4" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No vulnerabilities"
            description="Nothing found for this filter."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((v: any) => (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(v)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(v)}
                className="p-4 cursor-pointer transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={v.severity} />
                      {v.cwe_id && (
                        <span className="text-xs text-muted-foreground">{v.cwe_id}</span>
                      )}
                      <StatusBadge status={v.status} />
                      {v.verification_status && v.verification_status !== "unverified" && (
                        <VerificationBadge status={v.verification_status} />
                      )}
                    </div>
                    <div className="font-medium">{v.title}</div>
                    {v.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {v.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                      {v.repositories?.full_name && <span>{v.repositories.full_name}</span>}
                      {v.file_path && (
                        <span className="font-mono">
                          {v.file_path}
                          {v.line_start ? `:${v.line_start}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="shrink-0 flex items-center gap-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {v.cvss_score !== null && v.cvss_score !== undefined && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">CVSS</div>
                        <div className="text-lg font-bold">{v.cvss_score}</div>
                      </div>
                    )}
                    <Select
                      value={v.status}
                      onValueChange={(status) => updateStatus.mutate({ id: v.id, status })}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">Triaged</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="false_positive">False positive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={selected.severity} />
                  {selected.cwe_id && (
                    <span className="text-xs text-muted-foreground">{selected.cwe_id}</span>
                  )}
                  {selected.cvss_score !== null && selected.cvss_score !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      CVSS {selected.cvss_score}
                    </span>
                  )}
                  <StatusBadge status={selected.status} />
                </div>
                <DialogTitle className="text-left">{selected.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-5 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Target className="h-3.5 w-3.5" /> Target
                    </div>
                    <div className="font-medium truncate">
                      {selected.repositories?.full_name ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" /> Detected
                    </div>
                    <div className="font-medium">
                      {selected.detected_at ? format(new Date(selected.detected_at), "PPp") : "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Path</div>
                  <div className="font-mono text-xs break-all rounded bg-muted/40 border border-border p-2">
                    {selected.file_path
                      ? `${selected.file_path}${selected.line_start ? `:${selected.line_start}` : ""}${
                          selected.line_end && selected.line_end !== selected.line_start
                            ? `-${selected.line_end}`
                            : ""
                        }`
                      : "Not file-specific"}
                  </div>
                </div>

                {/* Sandbox Verification Section */}
                <SandboxVerificationSection vuln={selected} />

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Description</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selected.description || "No description recorded."}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Wrench className="h-3.5 w-3.5" /> Remediation steps
                  </div>
                  {Array.isArray(selected.remediation_steps) &&
                  selected.remediation_steps.length > 0 ? (
                    <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                      {selected.remediation_steps.map((s: any, i: number) => (
                        <li key={i}>{typeof s === "string" ? s : JSON.stringify(s)}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-muted-foreground">No remediation steps recorded.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Bot className="h-3.5 w-3.5" /> AI agent analysis
                  </div>
                  {selected.detected_by_agents?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selected.detected_by_agents.map((a: string) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 rounded text-xs border border-primary/30 bg-primary/10 text-accent-fg"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selected.ai_analysis || "No AI analysis recorded for this finding."}
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <Button asChild>
                    <Link to="/reports">
                      <FileText className="h-4 w-4 mr-2" /> View report
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The sandbox runs one of three engines depending on probe type (CodeQL,
// semgrep, or trufflehog for secrets), and each emits a differently-shaped
// "details" payload. Best-effort normalize the common ones into a single
// {title, location, tags} shape for a clean list; anything unrecognized
// still renders via the raw JSON fallback below, so this never hides data.
function normalizeFinding(
  item: unknown,
): { title: string; location?: string; tags?: string[] } | null {
  if (!item || typeof item !== "object") return null;
  const f = item as Record<string, any>;

  // CodeQL (via sarif_verdict.py): {rule, message, locations: [{file, line}], tags}
  if (typeof f.rule === "string" || Array.isArray(f.tags)) {
    const loc = Array.isArray(f.locations) ? f.locations[0] : undefined;
    return {
      title: f.message || f.rule || "CodeQL finding",
      location: loc?.file ? `${loc.file}${loc.line ? `:${loc.line}` : ""}` : undefined,
      tags: Array.isArray(f.tags)
        ? f.tags.filter((t: unknown) => typeof t === "string")
        : undefined,
    };
  }

  // Raw semgrep result: {check_id, path, start:{line}, extra:{message, metadata:{cwe}}}
  if (typeof f.check_id === "string") {
    const cwe = f.extra?.metadata?.cwe;
    return {
      title: f.extra?.message || f.check_id,
      location: f.path ? `${f.path}${f.start?.line ? `:${f.start.line}` : ""}` : undefined,
      tags: Array.isArray(cwe) ? cwe : typeof cwe === "string" ? [cwe] : undefined,
    };
  }

  return null;
}

function SandboxVerificationSection({ vuln }: { vuln: any }) {
  const status: string = vuln.verification_status ?? "unverified";
  const cfg = verificationConfig[status] ?? verificationConfig.unverified;
  const Icon = cfg.icon;

  if (status === "unverified" && !vuln.sandbox_job_id) {
    return null;
  }

  const rawFindings: unknown[] = Array.isArray(vuln.verification_details?.results)
    ? vuln.verification_details.results
    : Array.isArray(vuln.verification_details?.matches)
      ? vuln.verification_details.matches
      : [];
  const findings = rawFindings
    .map(normalizeFinding)
    .filter((f): f is NonNullable<typeof f> => f !== null);
  const findingCount: number | undefined =
    vuln.verification_details?.count ?? (rawFindings.length || undefined);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" /> Sandbox Verification
        </div>
        {vuln.verification_duration_ms != null && (
          <span className="text-xs text-muted-foreground">
            Verified in {(vuln.verification_duration_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${cfg.color} ${status === "pending" ? "animate-spin" : ""}`} />
        <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
        {vuln.verification_completed_at && status !== "pending" && (
          <span className="text-xs text-muted-foreground">
            · {format(new Date(vuln.verification_completed_at), "PPp")}
          </span>
        )}
      </div>

      {status === "pending" && (
        <p className="text-xs text-muted-foreground">
          The sandbox is running automated security analysis on this finding. Results will appear
          here automatically.
        </p>
      )}

      {status === "failed" && (
        <p className="text-xs text-medium">
          The verification tool itself errored — this is not a confirmed absence of the
          vulnerability, just an inconclusive run.
        </p>
      )}

      {(status === "confirmed" || status === "not_exploitable" || status === "failed") && (
        <>
          {vuln.verification_evidence && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Evidence</div>
              <p className="text-xs bg-muted/60 border border-border rounded p-2 whitespace-pre-wrap break-all">
                {vuln.verification_evidence}
              </p>
            </div>
          )}

          {findings.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Findings{findingCount ? ` (${findingCount})` : ""}
              </div>
              <ul className="space-y-1.5">
                {findings.map((f, i) => (
                  <li
                    key={i}
                    className="text-xs rounded border border-border bg-muted/60 p-2 space-y-1"
                  >
                    <div>{f.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {f.location && (
                        <span className="font-mono text-muted-foreground">{f.location}</span>
                      )}
                      {f.tags?.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase text-[10px]"
                        >
                          {t.replace(/^external\/cwe\//, "").replace(/^cwe-/, "CWE-")}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vuln.verification_details && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground select-none">
                Raw tool output
              </summary>
              <pre className="mt-1 bg-muted/60 border border-border rounded p-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {JSON.stringify(vuln.verification_details, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}

      {vuln.sandbox_job_id && (
        <div className="text-xs text-muted-foreground">
          Job: <span className="font-mono">{vuln.sandbox_job_id}</span>
        </div>
      )}
    </div>
  );
}
