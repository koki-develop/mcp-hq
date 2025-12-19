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

export const mcpToolSchema = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
});
export type McpTool = zod.infer<typeof mcpToolSchema>;

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

export async function getStdioMcpServerTools(
  command: string,
  args: string[],
): Promise<McpTool[]> {
  const client = new Client({ name: "mcp-tools-client", version: "0.0.0" });

  try {
    const transport = new StdioClientTransport({
      command,
      args,
    });
    await client.connect(transport);

    const result = await client.listTools();
    return result.tools.map((tool) => mcpToolSchema.parse(tool));
  } finally {
    await client.close();
  }
}

export async function getStreamableHttpMcpServerTools(
  url: string,
): Promise<McpTool[]> {
  const client = new Client({ name: "mcp-tools-client", version: "0.0.0" });

  try {
    // TODO: support auth
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);

    const result = await client.listTools();
    return result.tools.map((tool) => mcpToolSchema.parse(tool));
  } finally {
    await client.close();
  }
}
