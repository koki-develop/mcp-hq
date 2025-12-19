import fs from "node:fs/promises";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { configSchema } from "./config";
import { runServer } from "./server";

const program = new Command();

program.name("mcp-hq").version(packageJson.version);

program.command("server").action(async () => {
  const configFilename = ".mcp-hq.json";
  if (!(await fs.stat(configFilename).catch(() => false))) {
    throw new Error(
      `Config file "${configFilename}" not found. Please create one to configure the MCP server.`,
    );
  }
  const configRaw = await fs.readFile(configFilename, "utf-8");
  const config = configSchema.parse(JSON.parse(configRaw));

  await runServer(config);
});

program.parse(process.argv);
