import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const patSchema = z.object({ token: z.string().min(20).max(200) });
const oauthSchema = z.object({
  providerToken: z.string().min(10),
  providerRefreshToken: z.string().optional().nullable(),
});

async function fetchGithubUser(token: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PentestAI",
    },
  });
  if (!res.ok) throw new Error("GitHub token rejected");
  const scopeHeader = res.headers.get("x-oauth-scopes") ?? "";
  const scopes = scopeHeader
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const user = (await res.json()) as { id: number; login: string };
  return { user, scopes };
}

export const saveGithubOAuthToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => oauthSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { user, scopes } = await fetchGithubUser(data.providerToken);
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { error } = await supabaseAdmin.from("github_connections").upsert(
      {
        user_id: context.userId,
        github_user_id: user.id,
        github_username: user.login,
        access_token_encrypted: data.providerToken,

        scopes: scopes.length ? scopes : ["oauth"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { username: user.login, scopes };
  });

async function verifyPat(token: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PentestAI",
    },
  });
  if (!res.ok) throw new Error("Invalid GitHub token");
  const scopeHeader = res.headers.get("x-oauth-scopes") ?? "";
  const scopes = scopeHeader
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const user = (await res.json()) as { id: number; login: string };
  return { user, scopes };
}

export const connectGithubPat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => patSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { user, scopes } = await verifyPat(data.token);
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { error } = await supabaseAdmin.from("github_connections").upsert(
      {
        user_id: context.userId,
        github_user_id: user.id,
        github_username: user.login,
        access_token_encrypted: data.token,
        scopes: scopes.length ? scopes : ["classic-pat"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return { username: user.login, scopes };
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { error } = await supabaseAdmin
      .from("github_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getGithubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { data, error } = await supabaseAdmin
      .from("github_connections")
      .select("github_username, scopes, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

async function getUserAccessToken(userId: string): Promise<string> {
  const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from("github_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_token_encrypted) throw new Error("GitHub is not connected");
  return data.access_token_encrypted as string;
}

export const listGithubRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = await getUserAccessToken(context.userId);
    const repos: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      default_branch: string;
      private: boolean;
      language: string | null;
      description: string | null;
      updated_at: string;
    }> = [];
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(
        `https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "PentestAI",
          },
        },
      );
      if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
      const batch = (await res.json()) as typeof repos;
      repos.push(...batch);
      if (batch.length < 100) break;
    }
    return repos.map((r) => ({
      github_repo_id: r.id,
      owner: r.owner.login,
      name: r.name,
      full_name: r.full_name,
      default_branch: r.default_branch,
      is_private: r.private,
      language: r.language,
      description: r.description,
      updated_at: r.updated_at,
    }));
  });

export const importGithubRepo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        github_repo_id: z.number(),
        owner: z.string(),
        name: z.string(),
        full_name: z.string(),
        default_branch: z.string(),
        is_private: z.boolean(),
        language: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const { error } = await supabaseAdmin.from("repositories").upsert(
      {
        user_id: context.userId,
        github_repo_id: data.github_repo_id,
        owner: data.owner,
        name: data.name,
        full_name: data.full_name,
        default_branch: data.default_branch,
        is_private: data.is_private,
        language: data.language ?? null,
        status: "never_scanned",
      },
      { onConflict: "user_id,full_name" },
    );
    if (error) throw error;
    return { ok: true };
  });
