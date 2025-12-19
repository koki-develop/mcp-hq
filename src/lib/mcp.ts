import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
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

// JSON Schema オブジェクトの基本形
export const jsonSchemaObjectSchema = zod
  .object({
    type: zod.literal("object"),
    properties: zod.record(zod.string(), zod.unknown()).optional(),
    required: zod.array(zod.string()).optional(),
  })
  .passthrough();

// ツールのアノテーション
export const mcpToolAnnotationsSchema = zod.object({
  title: zod.string().optional(),
  readOnlyHint: zod.boolean().optional(),
  destructiveHint: zod.boolean().optional(),
  idempotentHint: zod.boolean().optional(),
  openWorldHint: zod.boolean().optional(),
});

// 詳細なツール情報
export const mcpToolDetailSchema = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  inputSchema: jsonSchemaObjectSchema,
  outputSchema: jsonSchemaObjectSchema.optional(),
  annotations: mcpToolAnnotationsSchema.optional(),
});
export type McpToolDetail = zod.infer<typeof mcpToolDetailSchema>;

// Helper functions
async function withMcpClient<T>(
  transport: Transport,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: "mcp-info-client", version: "0.0.0" });
  try {
    await client.connect(transport);
    return await callback(client);
  } finally {
    await client.close();
  }
}

async function getMcpServerInfo(transport: Transport): Promise<McpServerInfo> {
  return withMcpClient(transport, async (client) => {
    const version = client.getServerVersion();
    const instructions = client.getInstructions();
    return mcpServerInfoSchema.parse({ ...version, instructions });
  });
}

async function getMcpServerTools(transport: Transport): Promise<McpTool[]> {
  return withMcpClient(transport, async (client) => {
    const result = await client.listTools();
    return result.tools.map((tool) => mcpToolSchema.parse(tool));
  });
}

async function getMcpServerTool(
  transport: Transport,
  toolName: string,
): Promise<McpToolDetail | null> {
  return withMcpClient(transport, async (client) => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === toolName);
    if (!tool) {
      return null;
    }
    return mcpToolDetailSchema.parse(tool);
  });
}

export async function getStdioMcpServer(
  command: string,
  args: string[],
): Promise<McpServerInfo> {
  const transport = new StdioClientTransport({ command, args });
  return getMcpServerInfo(transport);
}

export async function getStreamableHttpMcpServer(
  url: string,
): Promise<McpServerInfo> {
  // TODO: support auth
  const transport = new StreamableHTTPClientTransport(new URL(url));
  return getMcpServerInfo(transport);
}

export async function getStdioMcpServerTools(
  command: string,
  args: string[],
): Promise<McpTool[]> {
  const transport = new StdioClientTransport({ command, args });
  return getMcpServerTools(transport);
}

export async function getStreamableHttpMcpServerTools(
  url: string,
): Promise<McpTool[]> {
  // TODO: support auth
  const transport = new StreamableHTTPClientTransport(new URL(url));
  return getMcpServerTools(transport);
}

export async function getStdioMcpServerTool(
  command: string,
  args: string[],
  toolName: string,
): Promise<McpToolDetail | null> {
  const transport = new StdioClientTransport({ command, args });
  return getMcpServerTool(transport, toolName);
}

export async function getStreamableHttpMcpServerTool(
  url: string,
  toolName: string,
): Promise<McpToolDetail | null> {
  // TODO: support auth
  const transport = new StreamableHTTPClientTransport(new URL(url));
  return getMcpServerTool(transport, toolName);
}
