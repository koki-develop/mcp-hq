import * as zod from "zod";

export const configSchema = zod.object({
  mcpServers: zod.record(
    // server name
    zod.string(),
    // server config
    zod.union([
      // stdio server
      zod.object({
        command: zod.string().min(1),
        args: zod.array(zod.string()).default([]),
      }),
      // streamable HTTP server
      zod.object({
        url: zod.url().min(1),
      }),
    ]),
  ),
});

export type Config = zod.infer<typeof configSchema>;
