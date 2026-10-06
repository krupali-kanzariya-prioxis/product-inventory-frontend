import { failureResponse, okResponse, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await withMcpClient(async (client) => {
      const [{ resources }, { resourceTemplates }] = await Promise.all([
        client.listResources(),
        client.listResourceTemplates(),
      ]);
      return {
        resources: resources.map((r) => ({ uri: r.uri, name: r.name, description: r.description, mimeType: r.mimeType })),
        resourceTemplates: resourceTemplates.map((t) => ({
          uriTemplate: t.uriTemplate,
          name: t.name,
          description: t.description,
          mimeType: t.mimeType,
        })),
      };
    });
    return okResponse(data);
  } catch (err) {
    return failureResponse(err);
  }
}
