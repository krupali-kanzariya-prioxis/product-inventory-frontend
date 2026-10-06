"use client";

export interface McpApiResponse {
  ok: boolean;
  message?: string;
  unreachable?: boolean;
  [key: string]: unknown;
}

export interface CallRecord {
  id: string;
  kind: "tool" | "resource" | "prompt";
  name: string;
  time: Date;
  ok: boolean;
  /** Server replied "Not saved..." (confirmation required) - informational, not an error. */
  info: boolean;
  httpStatus: number;
  durationMs: number;
  request: unknown;
  response: McpApiResponse;
}

export const NOT_SAVED_PATTERN = /^\s*Not saved\b/i;

/** Calls our own Next.js route handlers; the browser never talks to /mcp directly. */
export async function mcpFetch(path: string, body?: unknown): Promise<{ status: number; data: McpApiResponse; durationMs: number }> {
  const started = performance.now();
  try {
    const res = await fetch(`/api/mcp/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    let data: McpApiResponse;
    try {
      data = (await res.json()) as McpApiResponse;
    } catch {
      data = { ok: false, message: `Unexpected response from playground API (HTTP ${res.status}).` };
    }
    return { status: res.status, data, durationMs: Math.round(performance.now() - started) };
  } catch (err) {
    return {
      status: 0,
      data: { ok: false, message: `Playground API request failed: ${err instanceof Error ? err.message : String(err)}` },
      durationMs: Math.round(performance.now() - started),
    };
  }
}

/** Tool results may arrive as structuredContent or as JSON text content. */
export function extractToolPayload(response: McpApiResponse): unknown {
  const result = response.result as { structuredContent?: Record<string, unknown>; content?: { type: string; text?: string }[] } | undefined;
  if (!result) return undefined;
  if (result.structuredContent) {
    const keys = Object.keys(result.structuredContent);
    return keys.length === 1 && keys[0] === "result" ? result.structuredContent.result : result.structuredContent;
  }
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}
