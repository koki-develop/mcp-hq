import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import type { Config } from "./config";
import { ConnectionPool } from "./lib/connection-pool";
import { registerTools } from "./tools";

export async function runServer(config: Config) {
  // Create connection pool
  const pool = new ConnectionPool(config);

  // Create MCP server
  const server = new McpServer({
    name: "mcp-hq",
    version: packageJson.version,
  });

  // Register tools
  registerTools(server, config, pool);

  // Graceful shutdown
  const cleanup = async () => {
    await pool.closeAll();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
