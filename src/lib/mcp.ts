import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as zod from "zod";

export const mcpServerInfoSchema = zod.object({
  version: zod.string(),
  description: zod.string().optional(),
  instructions: zod.string().optional(),
});
export type McpServerInfo = zod.infer<typeof mcpServerInfoSchema>;

export async function getStdioMcpServer(
  command: string,
  args: string[],
): Promise<McpServerInfo> {
  const client = new Client({ name: "mcp-info-client", version: "0.0.0" });

  try {
    const transport = new StdioClientTransport({
      command,
      args,
    });
    await client.connect(transport);

    const version = client.getServerVersion();
    const instructions = client.getInstructions();

    return mcpServerInfoSchema.parse({
      ...version,
      instructions,
    });
  } finally {
    await client.close();
  }
}

export async function getStreamableHttpMcpServer(
  url: string,
): Promise<McpServerInfo> {
  const client = new Client({ name: "mcp-info-client", version: "0.0.0" });

  try {
    // TODO: support auth
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);

    const version = client.getServerVersion();
    const instructions = client.getInstructions();

    return mcpServerInfoSchema.parse({
      ...version,
      instructions,
    });
  } finally {
    await client.close();
  }
}
