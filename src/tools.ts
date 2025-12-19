import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pLimit from "p-limit";
import * as zod from "zod";
import type { Config } from "./config";
import {
  callStdioMcpServerTool,
  callStreamableHttpMcpServerTool,
  getStdioMcpServer,
  getStdioMcpServerTool,
  getStdioMcpServerTools,
  getStreamableHttpMcpServer,
  getStreamableHttpMcpServerTool,
  getStreamableHttpMcpServerTools,
  type McpCallToolResult,
  type McpTool,
  type McpToolDetail,
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

export function registerTools(server: McpServer, config: Config) {
  server.registerTool(
    "list_mcp_servers",
    {
      outputSchema: listMcpServersOutputSchema,
    },
    async () => {
      const limit = pLimit(5); // limit concurrency to 5

      const output: ListMcpServersOutput = {
        servers: await Promise.all(
          Object.entries(config.mcpServers).map(([name, serverConfig]) =>
            limit(async () => {
              console.log({ name, serverConfig });

              // stdio server
              if ("command" in serverConfig) {
                const server = await getStdioMcpServer(
                  serverConfig.command,
                  serverConfig.args ?? [],
                );
                return { name, ...server };
              }

              // streamable HTTP server
              if ("url" in serverConfig) {
                const server = await getStreamableHttpMcpServer(
                  serverConfig.url,
                );
                return { name, ...server };
              }

              throw new Error(`Invalid MCP server config for "${name}".`);
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
      const serverConfig = config.mcpServers[server_name];
      if (!serverConfig) {
        throw new Error(
          `MCP server "${server_name}" not found in configuration. Available servers: ${Object.keys(config.mcpServers).join(", ")}`,
        );
      }

      let tools: McpTool[];

      // stdio server
      if ("command" in serverConfig) {
        tools = await getStdioMcpServerTools(
          serverConfig.command,
          serverConfig.args ?? [],
        );
      }
      // streamable HTTP server
      else if ("url" in serverConfig) {
        tools = await getStreamableHttpMcpServerTools(serverConfig.url);
      } else {
        throw new Error(`Invalid MCP server config for "${server_name}".`);
      }

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
      const serverConfig = config.mcpServers[server_name];
      if (!serverConfig) {
        throw new Error(
          `MCP server "${server_name}" not found in configuration. Available servers: ${Object.keys(config.mcpServers).join(", ")}`,
        );
      }

      let tool: McpToolDetail | null;

      // stdio server
      if ("command" in serverConfig) {
        tool = await getStdioMcpServerTool(
          serverConfig.command,
          serverConfig.args ?? [],
          tool_name,
        );
      }
      // streamable HTTP server
      else if ("url" in serverConfig) {
        tool = await getStreamableHttpMcpServerTool(
          serverConfig.url,
          tool_name,
        );
      } else {
        throw new Error(`Invalid MCP server config for "${server_name}".`);
      }

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
      const serverConfig = config.mcpServers[server_name];
      if (!serverConfig) {
        throw new Error(
          `MCP server "${server_name}" not found in configuration. Available servers: ${Object.keys(config.mcpServers).join(", ")}`,
        );
      }

      let result: McpCallToolResult;

      // stdio server
      if ("command" in serverConfig) {
        result = await callStdioMcpServerTool(
          serverConfig.command,
          serverConfig.args ?? [],
          tool_name,
          toolArgs,
        );
      }
      // streamable HTTP server
      else if ("url" in serverConfig) {
        result = await callStreamableHttpMcpServerTool(
          serverConfig.url,
          tool_name,
          toolArgs,
        );
      } else {
        throw new Error(`Invalid MCP server config for "${server_name}".`);
      }

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
