import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getScanDetail } from "@/lib/scans.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/scans/$scanId")({
  head: () => ({
    meta: [
      { title: "Scan detail — PentestAI" },
      { name: "description", content: "Detailed execution log and findings for a scan." },
    ],
  }),
  component: ScanDetailPage,
});

const levelTint: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-medium",
  error: "text-critical",
};

function ScanDetailPage() {
  const { scanId } = Route.useParams();
  const [tick, setTick] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["scan-detail", scanId, tick],
    queryFn: () => getScanDetail({ data: { scanId } }),
    refetchInterval: (q) => {
      const status = (q.state.data as any)?.scan?.status;
      return status === "running" || status === "queued" ? 1500 : false;
    },
  });

  // Live subscribe to new logs
  useEffect(() => {
    const channel = supabase
      .channel(`scan-logs-${scanId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_logs", filter: `scan_id=eq.${scanId}` },
        () => setTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [scanId]);

  const scan = (data as any)?.scan;
  const logs = ((data as any)?.logs ?? []) as Array<{
    id: string;
    stage: string;
    level: string;
    message: string;
    created_at: string;
  }>;

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading scan…</div>;
  }
  if (!scan) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Scan not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/scans"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> All scans
      </Link>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {scan.repositories?.full_name ?? "Repository"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {scan.branch} · {scan.commit_sha?.slice(0, 7) ?? "—"} ·{" "}
              {scan.started_at
                ? formatDistanceToNow(new Date(scan.started_at), { addSuffix: true })
                : "queued"}
            </p>
          </div>
          <span
            className={`px-2 py-1 rounded text-xs font-medium capitalize ${
              scan.status === "completed"
                ? "bg-low/15 text-low"
                : scan.status === "failed"
                  ? "bg-critical/15 text-critical"
                  : "bg-primary/15 text-accent-fg"
            }`}
          >
            {scan.status === "running" && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
            {scan.status}
          </span>
        </div>

        {scan.status === "running" && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${scan.progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {scan.current_stage ?? ""} — {scan.progress ?? 0}%
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          <Stat label="Critical" value={scan.critical_count} tint="critical" />
          <Stat label="High" value={scan.high_count} tint="high" />
          <Stat label="Medium" value={scan.medium_count} tint="medium" />
          <Stat label="Low" value={scan.low_count} tint="low" />
          <Stat label="Score" value={scan.security_score ?? "—"} />
        </div>

        {scan.error_message && (
          <div className="mt-4 p-3 rounded border border-critical/40 bg-critical/10 text-critical text-sm">
            {scan.error_message}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Execution log</h3>
          <button
            onClick={() => refetch()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>
        <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No logs yet.</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="px-4 py-1.5 flex gap-3 border-b border-border/50">
                <span className="text-muted-foreground shrink-0">
                  {new Date(l.created_at).toLocaleTimeString()}
                </span>
                <span className="text-accent-fg shrink-0 w-20 truncate">{l.stage}</span>
                <span className={`${levelTint[l.level] ?? ""} break-all`}>{l.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: any; tint?: string }) {
  const tintClass =
    tint === "critical"
      ? "text-critical"
      : tint === "high"
        ? "text-high"
        : tint === "medium"
          ? "text-medium"
          : tint === "low"
            ? "text-low"
            : "text-foreground";
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${tintClass}`}>{value ?? 0}</div>
    </div>
  );
}
