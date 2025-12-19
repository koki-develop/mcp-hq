import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import type { Config } from "./config";
import { registerTools } from "./tools";

export async function runServer(config: Config) {
  // Create MCP server
  const server = new McpServer({
    name: "mcp-hq",
    version: packageJson.version,
  });

  // Register tools
  registerTools(server, config);

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
