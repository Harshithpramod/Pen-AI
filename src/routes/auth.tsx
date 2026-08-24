import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Github } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PentestAI" },
      {
        name: "description",
        content: "Sign in to PentestAI with GitHub to scan your repositories.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) setExistingEmail(data.user.email ?? "your account");
    });
  }, []);

  const handleSwitchAccount = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setExistingEmail(null);
    setLoading(false);
  };

  const handleGithub = async () => {
    setLoading(true);
    const redirectTo = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        scopes: "repo read:user user:email",
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      toast.error(error?.message ?? "Failed to start GitHub sign-in");
      setLoading(false);
      return;
    }
    const inIframe = window.top !== window.self;
    if (inIframe) {
      const opened = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error("Popup blocked. Open the preview in a new tab, then try again.");
        setLoading(false);
        return;
      }
      toast.info("Complete GitHub sign-in in the new tab, then return here.");
      setLoading(false);
    } else {
      window.location.href = data.url;
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-marketing-bg)" }}
    >
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative w-full max-w-md rounded-xl border border-marketing-border bg-marketing-card p-8">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Shield className="h-6 w-6 text-primary" strokeWidth={2.5} />
          <span className="font-bold text-white text-lg">PentestAI</span>
        </Link>

        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-marketing-muted">
          Sign in with GitHub to run penetration tests on your repositories.
        </p>

        {existingEmail && (
          <div className="mt-6 rounded-lg border border-marketing-border bg-black/40 p-4">
            <p className="text-sm text-white">
              You're already signed in as <span className="font-semibold">{existingEmail}</span>
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                onClick={() => navigate({ to: "/dashboard", replace: true })}
                className="h-9 flex-1 bg-primary hover:bg-primary-hover"
              >
                Continue
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleSwitchAccount}
                className="h-9 flex-1 border-marketing-border text-white hover:bg-white/10"
              >
                Use another account
              </Button>
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={handleGithub}
          disabled={loading}
          className="mt-6 w-full h-11 bg-[#24292f] text-white hover:bg-[#24292f]/90"
        >
          <Github className="h-4 w-4 mr-2" />
          Continue with GitHub
        </Button>

        <p className="mt-6 text-center text-xs text-marketing-muted">
          Only scan repositories you own or are authorized to test.
        </p>
      </div>
    </div>
  );
}
