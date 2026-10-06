import { badRequest, failureResponse, isPlainObject, okResponse, readJsonBody, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return badRequest("Request body must be a JSON object.");
  const { name, arguments: args } = body;
  if (typeof name !== "string" || !name.trim()) return badRequest("'name' is required.");
  if (args !== undefined && !isPlainObject(args)) return badRequest("'arguments' must be an object.");

  // MCP prompt arguments are string-valued by spec.
  const stringArgs: Record<string, string> = {};
  for (const [k, v] of Object.entries((args as Record<string, unknown>) ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    stringArgs[k] = String(v);
  }

  try {
    const result = await withMcpClient((client) => client.getPrompt({ name, arguments: stringArgs }));
    return okResponse({ result });
  } catch (err) {
    return failureResponse(err);
  }
}
