import { failureResponse, okResponse, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prompts = await withMcpClient(async (client) => {
      const { prompts } = await client.listPrompts();
      return prompts.map((p) => ({ name: p.name, description: p.description, arguments: p.arguments ?? [] }));
    });
    return okResponse({ prompts });
  } catch (err) {
    return failureResponse(err);
  }
}
