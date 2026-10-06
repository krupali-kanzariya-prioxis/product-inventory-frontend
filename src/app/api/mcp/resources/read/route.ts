import { badRequest, failureResponse, okResponse, readJsonBody, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return badRequest("Request body must be a JSON object.");
  const { uri } = body;
  if (typeof uri !== "string" || !uri.trim()) return badRequest("'uri' is required.");
  if (/\{[^}]*\}/.test(uri)) return badRequest("Fill in all template variables before reading.");

  try {
    const result = await withMcpClient((client) => client.readResource({ uri }));
    return okResponse({ result });
  } catch (err) {
    return failureResponse(err);
  }
}
