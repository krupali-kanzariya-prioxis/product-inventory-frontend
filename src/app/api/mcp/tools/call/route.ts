import { NextResponse } from "next/server";
import { badRequest, failureResponse, isPlainObject, readJsonBody, withMcpClient } from "@/lib/mcp/client";
import type { ContentBlock } from "@/lib/mcp/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return badRequest("Request body must be a JSON object.");
  const { name, arguments: args } = body;
  if (typeof name !== "string" || !name.trim()) return badRequest("'name' is required.");
  if (args !== undefined && !isPlainObject(args)) return badRequest("'arguments' must be an object.");

  try {
    const result = await withMcpClient((client) =>
      client.callTool({ name, arguments: (args as Record<string, unknown>) ?? {} })
    );
    const content = (result.content ?? []) as ContentBlock[];
    const payload = {
      content,
      structuredContent: result.structuredContent as Record<string, unknown> | undefined,
      isError: result.isError === true,
    };
    if (payload.isError) {
      const message =
        content.filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n") || "Tool returned an error.";
      return NextResponse.json({ ok: false, message, result: payload }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true, result: payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return failureResponse(err);
  }
}
