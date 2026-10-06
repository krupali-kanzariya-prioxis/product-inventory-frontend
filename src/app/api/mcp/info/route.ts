import { failureResponse, getMcpDisplayHost, okResponse, toFailure, withMcpClient } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = await withMcpClient(async (client) => ({
      server: client.getServerVersion(),
      capabilities: client.getServerCapabilities(),
      instructions: client.getInstructions(),
    }));
    return okResponse({ connected: true, host: getMcpDisplayHost(), ...info });
  } catch (err) {
    const { body } = toFailure(err);
    if (body.unreachable) {
      // Status endpoint: report "disconnected" as data so the UI can render a badge + Retry.
      return okResponse({ connected: false, host: getMcpDisplayHost(), message: body.message });
    }
    return failureResponse(err);
  }
}
