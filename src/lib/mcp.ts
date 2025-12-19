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

export async function getStdioMcpServerTool(
  command: string,
  args: string[],
  toolName: string,
): Promise<McpToolDetail | null> {
  const client = new Client({ name: "mcp-tools-client", version: "0.0.0" });

  try {
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);

    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === toolName);
    if (!tool) {
      return null;
    }
    return mcpToolDetailSchema.parse(tool);
  } finally {
    await client.close();
  }
}

export async function getStreamableHttpMcpServerTool(
  url: string,
  toolName: string,
): Promise<McpToolDetail | null> {
  const client = new Client({ name: "mcp-tools-client", version: "0.0.0" });

  try {
    // TODO: support auth
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);

    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === toolName);
    if (!tool) {
      return null;
    }
    return mcpToolDetailSchema.parse(tool);
  } finally {
    await client.close();
  }
}
