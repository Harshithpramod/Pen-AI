import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Github,
  Trash2,
  Loader2,
  GitBranch,
  Search,
  Download,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listGithubRepos, importGithubRepo, getGithubStatus } from "@/lib/github.functions";
import { startScan } from "@/lib/scans.functions";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge, SkeletonRows, EmptyState, PageShell } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/repositories")({
  head: () => ({
    meta: [
      { title: "Repositories — PentestAI" },
      { name: "description", content: "Manage GitHub repositories monitored by PentestAI." },
    ],
  }),
  component: RepositoriesPage,
});

function RepositoriesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [manualOpen, setManualOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);

  const { data: ghStatus } = useQuery({
    queryKey: ["github-status"],
    queryFn: () => getGithubStatus(),
  });
  const isConnected = Boolean(ghStatus?.github_username);

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ["repositories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repositories")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const importedFullNames = useMemo(() => new Set(repos.map((r: any) => r.full_name)), [repos]);

  const {
    data: ghRepos = [],
    isLoading: ghLoading,
    error: ghError,
    refetch: refetchGh,
    isFetching: ghFetching,
  } = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: browseOpen && isConnected,
  });

  const filteredGhRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ghRepos;
    return ghRepos.filter((r: any) => r.full_name.toLowerCase().includes(q));
  }, [ghRepos, search]);

  const importRepo = useMutation({
    mutationFn: (repo: any) =>
      importGithubRepo({
        data: {
          github_repo_id: repo.github_repo_id,
          owner: repo.owner,
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
          is_private: repo.is_private,
          language: repo.language,
        },
      }),
    onSuccess: (_d, repo: any) => {
      toast.success(`Imported ${repo.full_name}`);
      qc.invalidateQueries({ queryKey: ["repositories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importAll = useMutation({
    mutationFn: async () => {
      const toImport = filteredGhRepos.filter((r: any) => !importedFullNames.has(r.full_name));
      for (const r of toImport) {
        await importGithubRepo({
          data: {
            github_repo_id: r.github_repo_id,
            owner: r.owner,
            name: r.name,
            full_name: r.full_name,
            default_branch: r.default_branch,
            is_private: r.is_private,
            language: r.language,
          },
        });
      }
      return toImport.length;
    },
    onSuccess: (count) => {
      toast.success(`Imported ${count} repositor${count === 1 ? "y" : "ies"}`);
      qc.invalidateQueries({ queryKey: ["repositories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addManual = useMutation({
    mutationFn: async (repoUrl: string) => {
      const m = repoUrl.trim().match(/github\.com[:/]([^/]+)\/([^/.\s]+)/);
      if (!m) throw new Error("Enter a valid GitHub URL like https://github.com/owner/repo");
      const [, owner, name] = m;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("repositories").insert({
        user_id: userData.user.id,
        owner,
        name,
        full_name: `${owner}/${name}`,
        default_branch: "main",
        status: "never_scanned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repository added");
      qc.invalidateQueries({ queryKey: ["repositories"] });
      setManualOpen(false);
      setUrl("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRepo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repositories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repository removed");
      qc.invalidateQueries({ queryKey: ["repositories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scanRepo = useMutation({
    mutationFn: async (repositoryId: string) => {
      setScanningId(repositoryId);
      return startScan({ data: { repositoryId } });
    },
    onSuccess: (res: any) => {
      toast.success(`Scan complete — ${res.findings} finding(s), score ${res.score}`);
      qc.invalidateQueries({ queryKey: ["repositories"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      qc.invalidateQueries({ queryKey: ["vulnerabilities"] });
      navigate({ to: "/scans/$scanId", params: { scanId: res.scanId } });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setScanningId(null),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {repos.length} {repos.length === 1 ? "repository" : "repositories"} monitored
        </p>
        <div className="flex gap-2">
          <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={!isConnected}
                title={isConnected ? "" : "Connect GitHub in Settings first"}
              >
                <Github className="h-4 w-4 mr-2" /> Browse GitHub
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Your GitHub repositories</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter by name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button variant="outline" onClick={() => refetchGh()} disabled={ghFetching}>
                    {ghFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                  </Button>
                  <Button
                    disabled={importAll.isPending || filteredGhRepos.length === 0}
                    onClick={() => importAll.mutate()}
                    className=""
                  >
                    {importAll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import all
                  </Button>
                </div>

                <div className="max-h-96 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {ghLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
                      Loading repositories from GitHub…
                    </div>
                  ) : ghError ? (
                    <div className="p-6 text-sm text-critical">{(ghError as Error).message}</div>
                  ) : filteredGhRepos.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">
                      No repositories found on GitHub.
                    </div>
                  ) : (
                    filteredGhRepos.map((r: any) => {
                      const imported = importedFullNames.has(r.full_name);
                      return (
                        <div
                          key={r.github_repo_id}
                          className="p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.full_name}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              {r.language && <span>{r.language}</span>}
                              {r.is_private && <span>Private</span>}
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {r.default_branch}
                              </span>
                            </div>
                          </div>
                          {imported ? (
                            <span className="text-xs text-low flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Imported
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={importRepo.isPending}
                              onClick={() => importRepo.mutate(r)}
                            >
                              <Download className="h-3 w-3 mr-1" /> Import
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add by URL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add GitHub repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="repo-url">GitHub URL</Label>
                  <Input
                    id="repo-url"
                    placeholder="https://github.com/owner/repo"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Only add repositories you own or are authorized to test.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={addManual.isPending}
                  onClick={() => addManual.mutate(url)}
                  className=""
                >
                  {addManual.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!isConnected && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Connect your GitHub account in{" "}
          <Link to="/settings" className="text-accent-fg hover:underline">
            Settings
          </Link>{" "}
          to browse and import your repositories.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <SkeletonRows rows={4} className="p-4" />
        ) : repos.length === 0 ? (
          <EmptyState
            icon={Github}
            title="No repositories yet"
            description={
              isConnected
                ? "Click Browse GitHub to import your repositories."
                : "Connect GitHub in Settings to get started."
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {repos.map((r: any) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 text-accent-fg grid place-items-center">
                    <Github className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" /> {r.default_branch}
                      </span>
                      {r.language && <span>{r.language}</span>}
                      {r.is_private && <span>Private</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                  <div className="hidden w-28 justify-end sm:flex">
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="hidden w-20 text-right sm:block">
                    <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Score
                    </div>
                    <div className="font-semibold text-foreground tabular-nums">
                      {r.security_score ?? "—"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scanRepo.mutate(r.id)}
                    disabled={scanningId !== null}
                  >
                    {scanningId === r.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scanning…
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3 w-3 mr-1" /> Scan
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.full_name}`}
                    onClick={() => removeRepo.mutate(r.id)}
                    disabled={removeRepo.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
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
