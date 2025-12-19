import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pLimit from "p-limit";
import * as zod from "zod";
import type { Config } from "./config";
import { getStdioMcpServer, getStreamableHttpMcpServer } from "./lib/mcp";

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
}
