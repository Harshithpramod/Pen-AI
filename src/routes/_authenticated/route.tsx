import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  BarChart3,
  Target,
  Zap,
  AlertCircle,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Search,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@supabase/supabase-js";
import { SeverityBadge, Skeleton } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/repositories", label: "Repositories", icon: Target },
  { to: "/scans", label: "Pen Test Scans", icon: Zap },
  { to: "/vulnerabilities", label: "Vulnerabilities", icon: AlertCircle },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/**
 * Title + a subtitle that describes the page. Previously every page showed
 * "Welcome back, {name}" under its heading, which said nothing on six of the
 * seven screens and wasted the most prominent line on the page.
 */
const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Security posture across your repositories" },
  "/repositories": { title: "Repositories", subtitle: "Connect and scan GitHub repositories" },
  "/scans": { title: "Pen Test Scans", subtitle: "Scan history and live progress" },
  "/vulnerabilities": { title: "Vulnerabilities", subtitle: "Findings triaged by severity" },
  "/reports": { title: "Reports", subtitle: "Export sandbox-verified scan results" },
  "/settings": { title: "Settings", subtitle: "Profile, notifications, and integrations" },
};

function metaFor(pathname: string) {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith("/scans/")) {
    return { title: "Scan detail", subtitle: "Execution log and findings for this scan" };
  }
  return { title: "PentestAI", subtitle: "" };
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Shield aria-hidden className="h-6 w-6 text-accent-fg" strokeWidth={2.5} />
        <span className="text-lg font-bold text-white">PentestAI</span>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              // bg-primary + white measured 4.23:1 — below AA. primary-strong
              // is the same hue at 5.70:1.
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                active
                  ? "bg-primary-strong text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              }`}
            >
              <item.icon aria-hidden className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={handleLogout}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <LogOut aria-hidden className="h-4 w-4 shrink-0" />
          Log Out
        </button>
      </div>
    </div>
  );
}

type Notification = {
  id: string;
  title: string;
  severity: string;
  detected_at: string;
  file_path: string | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NotificationsMenu() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("vulnerabilities")
      .select("id,title,severity,detected_at,file_path")
      .in("severity", ["critical", "high"])
      .eq("status", "open")
      .order("detected_at", { ascending: false })
      .limit(12);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const criticalCount = items.filter((i) => i.severity === "critical").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Notifications"
        >
          <Bell aria-hidden className="h-5 w-5 text-muted-foreground" />
          {items.length > 0 && (
            <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
              {items.length > 9 ? "9+" : items.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-card border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {criticalCount > 0
                ? `${criticalCount} critical finding${criticalCount > 1 ? "s" : ""} need attention`
                : "Security alerts from your scans"}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={load}>
            Refresh
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {loading && (
            <div role="status" aria-busy="true" className="space-y-3 px-4 py-4">
              <span className="sr-only">Loading notifications…</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              ))}
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No critical or high severity alerts. You're all clear.
            </p>
          )}
          {items.map((n) => (
            <Link
              key={n.id}
              to="/vulnerabilities"
              className="block px-4 py-3 hover:bg-accent/50 transition"
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    n.severity === "critical" ? "text-critical-fg" : "text-high-fg"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    Detected a {n.severity} vulnerability: {n.title}
                  </p>
                  {n.file_path && (
                    <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {n.file_path}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <SeverityBadge severity={n.severity} className="text-[10px]" />
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(n.detected_at)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border">
          <Link
            to="/vulnerabilities"
            className="cursor-pointer text-xs text-accent-fg hover:underline"
          >
            View all vulnerabilities →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
    github_username: string | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (!data.user) return;
      const { data: p } = await (supabase as any)
        .from("profiles")
        .select("full_name,avatar_url,github_username")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p) setProfile(p);
    });
  }, []);

  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const githubUsername =
    meta.user_name ?? meta.preferred_username ?? profile?.github_username ?? null;
  const displayName =
    githubUsername ?? profile?.full_name ?? meta.full_name ?? user?.email?.split("@")[0] ?? "there";
  const avatarUrl = meta.avatar_url ?? profile?.avatar_url ?? null;

  const { title, subtitle } = metaFor(pathname);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:block sticky top-0 h-screen">
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
          <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-60 bg-sidebar border-sidebar-border">
                  <SidebarContent pathname={pathname} />
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative hidden sm:block">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Search"
                  placeholder="Search..."
                  className="h-11 w-56 border-border bg-card pl-9"
                />
              </div>
              <NotificationsMenu />
              <Link
                to="/settings"
                aria-label="Account settings"
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-l border-border py-1 pr-1 pl-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-primary/20 text-sm font-semibold text-accent-fg">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <div className="text-sm leading-tight font-medium text-foreground">
                    {displayName}
                  </div>
                  <div className="text-xs leading-tight text-muted-foreground">
                    {githubUsername ? `@${githubUsername}` : "Developer"}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
