import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Download, Loader2, Printer, FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SkeletonRows } from "@/components/app/ui";
import { generateReport, getReportPayload, listCompletedScans } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — PentestAI" },
      { name: "description", content: "Download and share security reports for your scans." },
    ],
  }),
  component: ReportsPage,
});

function downloadJson(payload: any, name: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function printPdf(payload: any) {
  const rows = (payload.findings ?? [])
    .map(
      (f: any) => `
      <div class="finding ${esc(f.severity)}">
        <div class="head"><span class="sev">${esc(f.severity)}</span> <strong>${esc(f.title)}</strong></div>
        <div class="meta">${esc(f.cwe_id ?? "")} ${f.cvss_score ? `· CVSS ${esc(f.cvss_score)}` : ""} ${
          f.file_path ? `· ${esc(f.file_path)}${f.line_start ? ":" + esc(f.line_start) : ""}` : ""
        }</div>
        <p>${esc(f.description)}</p>
        ${
          Array.isArray(f.remediation_steps) && f.remediation_steps.length
            ? `<ol>${f.remediation_steps.map((s: any) => `<li>${esc(s)}</li>`).join("")}</ol>`
            : ""
        }
      </div>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>PentestAI Report — ${esc(
    payload.repository?.full_name ?? "",
  )}</title><style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;margin:40px;line-height:1.5}
    h1{margin:0 0 4px;font-size:22px} .sub{color:#666;font-size:12px;margin-bottom:20px}
    .score{font-size:34px;font-weight:700}
    .counts span{display:inline-block;margin-right:12px;font-size:12px}
    .finding{border:1px solid #ddd;border-radius:6px;padding:12px;margin:12px 0;page-break-inside:avoid}
    .sev{text-transform:uppercase;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#eee}
    .critical .sev{background:#fde2e2;color:#a10000}.high .sev{background:#ffe9d6;color:#a14b00}
    .medium .sev{background:#fff6d6;color:#8a6d00}.low .sev{background:#e3f2e5;color:#1b5e20}
    .meta{color:#666;font-size:11px;margin:4px 0 8px} ol{margin:8px 0 0 18px;font-size:13px}
  </style></head><body>
    <h1>PentestAI Security Report</h1>
    <div class="sub">${esc(payload.repository?.full_name ?? "Repository")} · generated ${esc(
      new Date(payload.generated_at).toUTCString(),
    )}</div>
    <div class="score">${esc(payload.security_score)}<span style="font-size:14px;color:#666">/100</span></div>
    <div class="counts">
      <span><b>${esc(payload.counts.critical)}</b> critical</span>
      <span><b>${esc(payload.counts.high)}</b> high</span>
      <span><b>${esc(payload.counts.medium)}</b> medium</span>
      <span><b>${esc(payload.counts.low)}</b> low</span>
    </div>
    <p>${esc(payload.summary)}</p>
    <h2 style="font-size:16px;margin-top:24px">Findings</h2>
    ${rows || "<p>No findings recorded for this scan.</p>"}
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to export the PDF");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function ReportsPage() {
  const qc = useQueryClient();
  const genFn = useServerFn(generateReport);
  const payloadFn = useServerFn(getReportPayload);
  const scansFn = useServerFn(listCompletedScans);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, repositories(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: completedScans = [] } = useQuery({
    queryKey: ["completed-scans"],
    queryFn: () => scansFn(),
  });

  const reportedScanIds = new Set(reports.map((r: any) => r.scan_id));
  const pending = completedScans.filter((s: any) => !reportedScanIds.has(s.id));

  const generate = useMutation({
    mutationFn: (scanId: string) => genFn({ data: { scanId } }),
    onSuccess: () => {
      toast.success("Report generated");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exporting = useMutation({
    mutationFn: async ({ scanId, kind }: { scanId: string; kind: "json" | "pdf" }) => {
      const payload = await payloadFn({ data: { scanId } });
      if (kind === "json") {
        downloadJson(
          payload,
          `pentestai-${(payload.repository?.name ?? "report").replace(/\W+/g, "-")}`,
        );
      } else {
        printPdf(payload);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3 text-sm">Scans without a report</h2>
          <div className="divide-y divide-border">
            {pending.map((s: any) => (
              <div key={s.id} className="py-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.repositories?.full_name ?? "Repository"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.completed_at
                      ? formatDistanceToNow(new Date(s.completed_at), { addSuffix: true })
                      : "—"}{" "}
                    · score {s.security_score ?? "—"}
                  </div>
                </div>
                <Button
                  size="sm"
                  className=""
                  disabled={generate.isPending}
                  onClick={() => generate.mutate(s.id)}
                >
                  {generate.isPending && generate.variables === s.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FilePlus2 className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={3} className="p-4" />
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No reports yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Run a scan, then generate a report to download it as JSON or PDF.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((r: any) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.repositories?.full_name ?? "Report"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                  {r.summary && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-2xl">
                      {r.summary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-lg font-bold">{r.security_score ?? "—"}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting.isPending}
                    onClick={() => exporting.mutate({ scanId: r.scan_id, kind: "json" })}
                  >
                    <Download className="h-4 w-4 mr-2" /> JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting.isPending}
                    onClick={() => exporting.mutate({ scanId: r.scan_id, kind: "pdf" })}
                  >
                    <Printer className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
