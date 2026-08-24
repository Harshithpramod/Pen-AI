import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

type CallbackPayload = {
  job_id: string;
  scan_id: string;
  vulnerability_id: string;
  verdict: {
    // "failed" means the probe itself errored (e.g. CodeQL/semgrep crashed) —
    // distinct from a clean scan that legitimately found nothing, so the UI
    // never has to guess whether "not_exploitable" was actually verified.
    status: "confirmed" | "not_exploitable" | "failed";
    evidence: string;
    details?: Record<string, unknown>;
  };
  duration_ms: number;
};

const VALID_STATUSES = new Set(["confirmed", "not_exploitable", "failed"]);

export async function handleSandboxCallback(request: Request): Promise<Response> {
  const secret = process.env.CALLBACK_HMAC_SECRET;
  if (!secret) {
    console.error("[sandbox-callback] CALLBACK_HMAC_SECRET not set");
    return new Response("misconfigured", { status: 500 });
  }

  const body = await request.text();

  const sig = request.headers.get("x-sandbox-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    console.warn("[sandbox-callback] HMAC mismatch — rejected");
    return new Response("unauthorized", { status: 401 });
  }

  let payload: CallbackPayload;
  try {
    payload = JSON.parse(body) as CallbackPayload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const { vulnerability_id, scan_id, job_id, verdict } = payload;
  if (!vulnerability_id || !scan_id || !job_id || !verdict?.status) {
    return new Response("missing fields", { status: 400 });
  }
  if (!VALID_STATUSES.has(verdict.status)) {
    return new Response("invalid verdict status", { status: 400 });
  }

  const evidence = (verdict.evidence || "").slice(0, 10000);

  // Keep the structured payload separate from the evidence sentence so the UI
  // can render actual findings instead of a wall of stringified JSON. Cap the
  // size defensively — the sandbox already trims to a handful of results, but
  // this is a network-facing write path.
  let details: Record<string, unknown> | null = verdict.details ?? null;
  if (details && JSON.stringify(details).length > 20000) {
    details = { truncated: true, note: "Details payload exceeded size limit and was dropped." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: updated, error } = await supabase
      .from("vulnerabilities")
      .update({
        verification_status: verdict.status,
        verification_evidence: evidence || null,
        verification_details: details,
        verification_duration_ms: Number.isFinite(payload.duration_ms) ? payload.duration_ms : null,
        verification_completed_at: new Date().toISOString(),
      })
      // Bind to the scan and the job we actually submitted, not just the
      // vulnerability id, so a stray/replayed callback can't overwrite a
      // different scan's verdict for the same vulnerability row.
      .eq("id", vulnerability_id)
      .eq("scan_id", scan_id)
      .eq("sandbox_job_id", job_id)
      .select("id");

    if (error) {
      console.error("[sandbox-callback] DB update failed", error);
      return new Response("db error", { status: 500 });
    }
    if (!updated || updated.length === 0) {
      console.warn(
        `[sandbox-callback] no matching vulnerability for id=${vulnerability_id} scan=${scan_id} job=${job_id}`,
      );
      return new Response("not found", { status: 404 });
    }

    console.log(`[sandbox-callback] ${vulnerability_id} -> ${verdict.status}`);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[sandbox-callback] unexpected error", err);
    return new Response("internal error", { status: 500 });
  }
}
