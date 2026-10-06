import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { NextResponse } from "next/server";
import type { McpFailure } from "./types";

const DEFAULT_MCP_URL = "http://localhost:5105/mcp";

export function getMcpUrl(): string {
  return process.env.MCP_URL || DEFAULT_MCP_URL;
}

/** Host part only, safe to show in the UI (no path, query or credentials). */
export function getMcpDisplayHost(): string {
  try {
    return new URL(getMcpUrl()).host;
  } catch {
    return "invalid MCP_URL";
  }
}

export class McpUnreachableError extends Error {}

/**
 * Opens a fresh MCP connection for each call and always closes it.
 * A new connection per request is fine for a local demo; a real app would pool/reuse sessions.
 * No elicitation capability is declared, so the server uses its non-interactive fallback.
 */
export async function withMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = getMcpUrl();
  const client = new Client({ name: "mcp-playground", version: "1.0.0" }, { capabilities: {} });
  try {
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    } catch (err) {
      throw new McpUnreachableError(
        `Cannot reach MCP server at ${getMcpDisplayHost()}. Is the API running?` +
          (err instanceof Error && err.message ? ` (${err.message})` : "")
      );
    }
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function isConnectionError(err: unknown): boolean {
  if (err instanceof McpUnreachableError) return true;
  const e = err as { message?: string; cause?: { code?: string } };
  const code = e?.cause?.code;
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    (typeof e?.message === "string" && e.message.includes("fetch failed"))
  );
}

export function toFailure(err: unknown): { status: number; body: McpFailure } {
  if (isConnectionError(err)) {
    const message =
      err instanceof McpUnreachableError
        ? err.message
        : `Cannot reach MCP server at ${getMcpDisplayHost()}. Is the API running?`;
    return { status: 503, body: { ok: false, message, unreachable: true } };
  }
  if (err instanceof McpError) {
    // The SDK prefixes messages with "MCP error <code>: "; keep the server's own text.
    const message = err.message.replace(/^MCP error -?\d+:\s*/, "");
    return { status: 502, body: { ok: false, message, code: err.code } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, body: { ok: false, message } };
}

export function failureResponse(err: unknown) {
  const { status, body } = toFailure(err);
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function okResponse<T extends object>(data: T) {
  return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, message } satisfies McpFailure, { status: 400 });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
