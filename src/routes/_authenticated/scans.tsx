import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusBadge, SkeletonRows, EmptyState } from "@/components/app/ui";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/scans")({
  head: () => ({
    meta: [
      { title: "Scans — PentestAI" },
      { name: "description", content: "Track penetration test scans across your repositories." },
    ],
  }),
  component: ScansPage,
});

function ScansPage() {
  const { data: scans = [], isLoading } = useQuery({
    queryKey: ["scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("*, repositories(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {isLoading ? (
        <SkeletonRows rows={4} className="p-4" />
      ) : scans.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No scans yet"
          description="Scans will appear here once you trigger them on a repository."
        />
      ) : (
        <div className="divide-y divide-border">
          {scans.map((s: any) => (
            <Link
              key={s.id}
              to="/scans/$scanId"
              params={{ scanId: s.id }}
              className="p-4 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {s.repositories?.full_name ?? "Repository"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.profile} · {s.trigger} ·{" "}
                  {s.started_at
                    ? formatDistanceToNow(new Date(s.started_at), { addSuffix: true })
                    : "not started"}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {s.status === "running" && (
                  <div className="w-40 h-2 rounded-full bg-muted overflow-hidden hidden md:block">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${s.progress ?? 0}%` }}
                    />
                  </div>
                )}
                <div className="text-xs text-muted-foreground hidden md:block">
                  {s.critical_count ?? 0} crit · {s.high_count ?? 0} high · {s.medium_count ?? 0}{" "}
                  med
                </div>
                <StatusBadge status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
