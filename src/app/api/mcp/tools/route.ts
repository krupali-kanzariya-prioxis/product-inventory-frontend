import { failureResponse, okResponse, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tools = await withMcpClient(async (client) => {
      const { tools } = await client.listTools();
      return tools.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      }));
    });
    return okResponse({ tools });
  } catch (err) {
    return failureResponse(err);
  }
}
