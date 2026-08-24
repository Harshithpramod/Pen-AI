/**
 * Shared building blocks for the authenticated app.
 *
 * Before this existed each page hand-rolled its own page header, card, badge,
 * empty state and loading text, which is why severity badges failed contrast
 * in four different places and raw enum values ("never_scanned") leaked to
 * the UI. Anything reused across two or more pages belongs here.
 */
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { humanize } from "@/lib/labels";

/* ---------------- badges ---------------- */

// Foreground uses the -fg tokens, which are verified against the 15% tint of
// the same hue. Using the base colour here measures ~2.85–4.12:1.
const severityTone: Record<string, string> = {
  critical: "text-critical-fg bg-critical/15 border-critical/30",
  high: "text-high-fg bg-high/15 border-high/30",
  medium: "text-medium-fg bg-medium/15 border-medium/30",
  low: "text-low-fg bg-low/15 border-low/30",
  info: "text-muted-foreground bg-muted border-border",
};

export function SeverityBadge({
  severity,
  className = "",
}: {
  severity: string;
  className?: string;
}) {
  const tone = severityTone[severity] ?? severityTone.info;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${tone} ${className}`}
    >
      {severity}
    </span>
  );
}

const statusTone: Record<string, string> = {
  // scans
  completed: "text-low-fg bg-low/15 border-low/30",
  running: "text-accent-fg bg-primary/15 border-primary/30",
  queued: "text-medium-fg bg-medium/15 border-medium/30",
  failed: "text-critical-fg bg-critical/15 border-critical/30",
  cancelled: "text-muted-foreground bg-muted border-border",
  // repositories
  secure: "text-low-fg bg-low/15 border-low/30",
  vulnerable: "text-critical-fg bg-critical/15 border-critical/30",
  testing: "text-accent-fg bg-primary/15 border-primary/30",
  never_scanned: "text-muted-foreground bg-muted border-border",
  // vulnerabilities
  open: "text-high-fg bg-high/15 border-high/30",
  in_progress: "text-accent-fg bg-primary/15 border-primary/30",
  fixed: "text-low-fg bg-low/15 border-low/30",
  false_positive: "text-muted-foreground bg-muted border-border",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const tone = statusTone[status] ?? "text-muted-foreground bg-muted border-border";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone} ${className}`}
    >
      {humanize(status)}
    </span>
  );
}

/* ---------------- layout ---------------- */

/**
 * Caps line length on wide monitors. Without it, table rows stretched to the
 * full 1440px viewport and pushed row actions miles from their labels.
 */
export function PageShell({
  children,
  className = "",
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "narrow";
}) {
  const max = width === "narrow" ? "max-w-3xl" : "max-w-[1400px]";
  return <div className={`mx-auto w-full ${max} ${className}`}>{children}</div>;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ---------------- states ---------------- */

/**
 * Skeletons rather than a bare "Loading…". The UX guidance the design system
 * was generated from rates loading feedback High severity and asks for a
 * stable skeleton with an accessible busy status — a text swap causes the
 * layout to jump once data lands.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function SkeletonRows({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`space-y-3 ${className}`}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({
  count = 4,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">Loading…</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-border bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Query failures previously rendered as nothing at all on some pages. */
export function ErrorState({
  title = "Couldn't load this",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-critical/30 bg-critical/10">
        <AlertCircle className="h-5 w-5 text-critical-fg" />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Try again
        </button>
      )}
    </div>
  );
}
