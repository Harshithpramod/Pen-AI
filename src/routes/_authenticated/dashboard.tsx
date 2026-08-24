import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Activity,
  Shield,
  ArrowRight,
  Github,
  Server,
  Calendar,
  Boxes,
} from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { getGithubStatus } from "@/lib/github.functions";
import { formatDistanceToNow, format } from "date-fns";
import { StatusBadge, SeverityBadge, SkeletonCards, ErrorState } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PentestAI" },
      {
        name: "description",
        content: "Security overview of your repositories, scans, and vulnerabilities.",
      },
      { property: "og:title", content: "Dashboard — PentestAI" },
      {
        property: "og:description",
        content: "Security overview of your repositories, scans, and vulnerabilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const tintClasses: Record<string, string> = {
  critical: "bg-critical/15 text-critical",
  low: "bg-low/15 text-low",
  primary: "bg-primary/15 text-accent-fg",
  accent: "bg-primary/15 text-accent-fg",
};

const sevDot: Record<string, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Panel({
  title,
  action,
  children,
  index = 0,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      custom={index}
      initial="hidden"
      animate="show"
      className={`rounded-xl border border-border bg-card/80 backdrop-blur ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [repos, vulns, scans] = await Promise.all([
        supabase.from("repositories").select("id, name, full_name, security_score, status"),
        supabase
          .from("vulnerabilities")
          .select("id, severity, status, title, detected_at, repository_id")
          .order("detected_at", { ascending: false }),
        supabase
          .from("scans")
          .select(
            "id, status, started_at, created_at, repository_id, critical_count, high_count, medium_count, low_count",
          )
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      return {
        repos: (repos.data ?? []) as any[],
        vulns: (vulns.data ?? []) as any[],
        scans: (scans.data ?? []) as any[],
      };
    },
  });

  const { data: gh } = useQuery({ queryKey: ["github-status"], queryFn: () => getGithubStatus() });

  const repos = data?.repos ?? [];
  const vulns = data?.vulns ?? [];
  const scans = data?.scans ?? [];

  const repoName = (id: string) => {
    const r = repos.find((x) => x.id === id);
    return r?.full_name ?? r?.name ?? "unknown repo";
  };

  const openVulns = vulns.filter((v) => v.status === "open");
  const sevCounts = {
    critical: openVulns.filter((v) => v.severity === "critical").length,
    high: openVulns.filter((v) => v.severity === "high").length,
    medium: openVulns.filter((v) => v.severity === "medium").length,
    low: openVulns.filter((v) => v.severity === "low").length,
  };
  const totalVulns = sevCounts.critical + sevCounts.high + sevCounts.medium + sevCounts.low;
  const fixedCount = vulns.filter((v) => v.status === "fixed").length;

  const activeScans = scans.filter((s) => s.status === "running" || s.status === "queued").length;
  const securedRepos = repos.filter((r) => (r.security_score ?? 0) >= 80).length;
  const avgScore = repos.length
    ? Math.round(repos.reduce((a, r) => a + (r.security_score ?? 0), 0) / repos.length)
    : 0;

  const stats = [
    {
      label: "Critical Vulnerabilities",
      value: sevCounts.critical,
      icon: AlertTriangle,
      tint: "critical",
    },
    { label: "Secured Repositories", value: securedRepos, icon: CheckCircle, tint: "low" },
    { label: "Active Scans", value: activeScans, icon: Activity, tint: "primary" },
    { label: "Security Score", value: `${avgScore}/100`, icon: Shield, tint: "accent" },
  ];

  const pct = (n: number) => (totalVulns ? (n / totalVulns) * 100 : 0);
  const ring = avgScore;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${gh?.github_username ? "border-low/40 bg-low/5" : "border-border bg-card"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-10 w-10 rounded-full grid place-items-center ${gh?.github_username ? "bg-low/15 text-low" : "bg-muted text-muted-foreground"}`}
          >
            <Github className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {gh?.github_username ? `Connected as @${gh.github_username}` : "GitHub not connected"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {gh?.github_username
                ? `Scopes: ${(gh.scopes ?? []).join(", ") || "none"}`
                : "Sign in with GitHub or add a token in Settings to enable scanning."}
            </div>
          </div>
        </div>
        <Link
          to="/settings"
          className="inline-flex min-h-6 items-center cursor-pointer text-xs whitespace-nowrap text-accent-fg hover:underline"
        >
          Manage
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            custom={i}
            initial="hidden"
            animate="show"
            whileHover={{ y: -3 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-5"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {isLoading ? "—" : s.value}
                </div>
              </div>
              <div
                className={`h-10 w-10 rounded-full grid place-items-center ${tintClasses[s.tint]}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Vulnerability summary + score ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          index={1}
          className="lg:col-span-2"
          title="Vulnerability Summary"
          action={
            <Link
              to="/vulnerabilities"
              className="inline-flex min-h-6 items-center cursor-pointer gap-1 text-xs text-accent-fg hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as const).map((sev, i) => (
                <div key={sev} className="rounded-lg bg-muted/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm capitalize">
                      <span className={`h-2 w-2 rounded-full ${sevDot[sev]}`} />
                      {sev}
                    </div>
                    <span className="text-sm font-semibold">{sevCounts[sev]}</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(sevCounts[sev])}%` }}
                      transition={{ duration: 0.7, delay: 0.15 + i * 0.08 }}
                      className={`h-full ${sevDot[sev]}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-background/40 p-6">
              <div className="text-sm text-muted-foreground">Open Vulnerabilities</div>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 16 }}
                className="mt-1 text-5xl font-bold"
              >
                {totalVulns}
              </motion.div>
              <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {(["critical", "high", "medium", "low"] as const).map((sev) => (
                  <motion.div
                    key={sev}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct(sevCounts[sev])}%` }}
                    transition={{ duration: 0.8 }}
                    className={sevDot[sev]}
                  />
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Distribution by severity</div>
              <div className="mt-4 text-xs text-low">{fixedCount} fixed all-time</div>
            </div>
          </div>
        </Panel>

        <Panel
          index={2}
          title="Repository Coverage"
          action={
            <Link
              to="/repositories"
              className="inline-flex min-h-6 items-center cursor-pointer text-xs text-accent-fg hover:underline"
            >
              Details
            </Link>
          }
        >
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="3"
                    className="stroke-muted"
                  />
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="stroke-primary"
                    strokeDasharray={97.4}
                    initial={{ strokeDashoffset: 97.4 }}
                    animate={{ strokeDashoffset: 97.4 - (97.4 * ring) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-sm font-semibold">
                  {ring}
                </div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Average security score</div>
                <div className="text-xs text-muted-foreground">
                  {securedRepos}/{repos.length || 0} repositories hardened
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {repos.slice(0, 5).map((r, i) => {
                const score = r.security_score ?? 0;
                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2 text-muted-foreground">
                        {r.name ?? r.full_name}
                      </span>
                      <span className="font-medium">{score}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.7, delay: i * 0.06 }}
                        className={
                          score >= 80
                            ? "h-full bg-low"
                            : score >= 50
                              ? "h-full bg-medium"
                              : "h-full bg-critical"
                        }
                      />
                    </div>
                  </div>
                );
              })}
              {repos.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Boxes className="h-4 w-4" /> No repositories imported yet.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* Recent scans table */}
      <Panel
        index={3}
        title="Recent Scans"
        action={
          <Link
            to="/scans"
            className="inline-flex min-h-6 items-center cursor-pointer gap-1 text-xs text-accent-fg hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {scans.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No scans yet. Import a repository to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Critical</th>
                  <th className="px-5 py-3 font-medium text-right">High</th>
                  <th className="px-5 py-3 font-medium text-right">Medium</th>
                  <th className="px-5 py-3 font-medium text-right">Low</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((s) => {
                  const when = s.started_at ?? s.created_at;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Server className="h-4 w-4 shrink-0 text-accent-fg" />
                          <span className="truncate">{repoName(s.repository_id)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {when ? format(new Date(when), "yyyy-MM-dd") : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-critical">
                        {s.critical_count ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right text-high">{s.high_count ?? 0}</td>
                      <td className="px-5 py-3 text-right text-medium">{s.medium_count ?? 0}</td>
                      <td className="px-5 py-3 text-right text-low">{s.low_count ?? 0}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          to="/scans/$scanId"
                          params={{ scanId: s.id }}
                          className="rounded-md border border-border px-2.5 py-1 text-xs transition hover:border-primary hover:text-accent-fg"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Recent findings */}
      <Panel
        index={4}
        title="Recent Vulnerabilities"
        action={
          <Link
            to="/vulnerabilities"
            className="inline-flex min-h-6 items-center cursor-pointer gap-1 text-xs text-accent-fg hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="divide-y divide-border">
          {vulns.slice(0, 5).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No vulnerabilities detected yet.
            </div>
          ) : (
            vulns.slice(0, 5).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{v.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {repoName(v.repository_id)}
                    {v.detected_at
                      ? ` · ${formatDistanceToNow(new Date(v.detected_at), { addSuffix: true })}`
                      : ""}
                  </div>
                </div>
                <SeverityBadge severity={v.severity} />
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
