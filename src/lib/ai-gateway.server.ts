// Lovable AI Gateway helper (server-only).
// Do not import from the browser.

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Gemini OpenAI-compatible endpoint — used when LOVABLE_API_KEY is absent (local dev).
const GEMINI_GATEWAY_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callAI<T = unknown>(opts: {
  model?: string;
  messages: ChatMessage[];
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
  temperature?: number;
}): Promise<T | string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!lovableKey && !geminiKey) {
    throw new Error("No AI key configured — set LOVABLE_API_KEY or GEMINI_API_KEY.");
  }

  const usingLovable = Boolean(lovableKey);
  const url = usingLovable ? LOVABLE_GATEWAY_URL : GEMINI_GATEWAY_URL;
  // Lovable gateway uses OpenRouter-style provider/model names; Gemini API uses bare model ids.
  const model = opts.model
    ? usingLovable
      ? opts.model
      : opts.model.replace(/^google\//, "")
    : usingLovable
      ? "google/gemini-2.5-flash"
      : "gemini-2.5-flash";

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
  };

  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: opts.jsonSchema.name,
        strict: true,
        schema: opts.jsonSchema.schema,
      },
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (usingLovable) {
    headers["Lovable-API-Key"] = lovableKey!;
  } else {
    headers["Authorization"] = `Bearer ${geminiKey}`;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("AI rate limit exceeded — please retry shortly.");
    if (res.status === 402)
      throw new Error("Lovable AI credits exhausted — add credits in workspace billing.");
    throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (opts.jsonSchema) {
    try {
      return JSON.parse(content) as T;
    } catch {
      // Some models wrap JSON in code fences — strip and retry.
      const stripped = content
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      return JSON.parse(stripped) as T;
    }
  }
  return content;
}
