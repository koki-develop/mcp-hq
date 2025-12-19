import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pLimit from "p-limit";
import * as zod from "zod";
import type { Config } from "./config";
import type { ConnectionPool } from "./lib/connection-pool";
import {
  callMcpServerToolWithPool,
  getMcpServerInfoWithPool,
  getMcpServerToolsWithPool,
  getMcpServerToolWithPool,
  mcpCallToolResultSchema,
  mcpToolDetailSchema,
  mcpToolSchema,
} from "./lib/mcp";

const listMcpServersOutputSchema = zod.object({
  servers: zod.array(
    zod.object({
      name: zod.string().describe("Name of the MCP server"),
      version: zod.string().describe("Version of the MCP server"),
      description: zod
        .string()
        .optional()
        .describe("Description of the MCP server"),
      instructions: zod
        .string()
        .optional()
        .describe("Instructions for using the MCP server"),
    }),
  ),
});
type ListMcpServersOutput = zod.infer<typeof listMcpServersOutputSchema>;

const listToolsInputSchema = zod.object({
  server_name: zod
    .string()
    .describe("Name of the MCP server to list tools from"),
});

const listToolsOutputSchema = zod.object({
  server_name: zod.string().describe("Name of the MCP server"),
  tools: zod.array(mcpToolSchema),
});
type ListToolsOutput = zod.infer<typeof listToolsOutputSchema>;

const describeToolInputSchema = zod.object({
  server_name: zod
    .string()
    .describe("Name of the MCP server to get the tool from"),
  tool_name: zod.string().describe("Name of the tool to describe"),
});

const describeToolOutputSchema = zod.object({
  server_name: zod.string().describe("Name of the MCP server"),
  tool: mcpToolDetailSchema
    .nullable()
    .describe("Detailed tool information, or null if not found"),
});
type DescribeToolOutput = zod.infer<typeof describeToolOutputSchema>;

const callToolInputSchema = zod.object({
  server_name: zod
    .string()
    .describe("Name of the MCP server to call the tool on"),
  tool_name: zod.string().describe("Name of the tool to call"),
  arguments: zod
    .record(zod.string(), zod.unknown())
    .optional()
    .describe("Arguments to pass to the tool (as a JSON object)"),
});

const callToolOutputSchema = zod.object({
  server_name: zod.string().describe("Name of the MCP server"),
  tool_name: zod.string().describe("Name of the tool that was called"),
  result: mcpCallToolResultSchema.describe("The result returned by the tool"),
});
type CallToolOutput = zod.infer<typeof callToolOutputSchema>;

export function registerTools(
  server: McpServer,
  config: Config,
  pool: ConnectionPool,
) {
  server.registerTool(
    "list_mcp_servers",
    {
      outputSchema: listMcpServersOutputSchema,
    },
    async () => {
      const limit = pLimit(5); // limit concurrency to 5

      const output: ListMcpServersOutput = {
        servers: await Promise.all(
          Object.keys(config.mcpServers).map((name) =>
            limit(async () => {
              const info = await getMcpServerInfoWithPool(pool, name);
              return { name, ...info };
            }),
          ),
        ),
      };

      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  server.registerTool(
    "list_tools",
    {
      inputSchema: listToolsInputSchema,
      outputSchema: listToolsOutputSchema,
    },
    async ({ server_name }) => {
      const tools = await getMcpServerToolsWithPool(pool, server_name);

      const output: ListToolsOutput = {
        server_name,
        tools,
      };

      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  server.registerTool(
    "describe_tool",
    {
      description:
        "Get detailed information about a specific tool from an MCP server, including input/output schemas and annotations",
      inputSchema: describeToolInputSchema,
      outputSchema: describeToolOutputSchema,
    },
    async ({ server_name, tool_name }) => {
      const tool = await getMcpServerToolWithPool(pool, server_name, tool_name);

      const output: DescribeToolOutput = {
        server_name,
        tool,
      };

      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );

  server.registerTool(
    "call_tool",
    {
      description: "Call/execute a tool on a configured MCP server",
      inputSchema: callToolInputSchema,
      outputSchema: callToolOutputSchema,
    },
    async ({ server_name, tool_name, arguments: toolArgs }) => {
      const result = await callMcpServerToolWithPool(
        pool,
        server_name,
        tool_name,
        toolArgs,
      );

      const output: CallToolOutput = {
        server_name,
        tool_name,
        result,
      };

      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output) }],
      };
    },
  );
}
