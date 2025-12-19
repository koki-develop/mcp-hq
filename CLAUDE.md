# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run fmt        # Format code (Biome)
bun run lint       # Lint check
bun run typecheck  # TypeScript type check
bun run build      # Build to dist/index.js
bun run inspector  # Launch MCP Inspector for debugging
```

## Architecture

mcp-hq is an MCP (Model Context Protocol) multiplexer that aggregates multiple MCP servers into a unified interface.

```
src/
├── index.ts      # CLI entry point (Commander)
├── config.ts     # Config schema (Zod) for .mcp-hq.json
├── server.ts     # MCP server initialization
├── tools.ts      # Tool registration (list_mcp_servers, list_tools)
└── lib/
    └── mcp.ts    # MCP client utilities for stdio/HTTP transports
```

### Data Flow

1. CLI loads `.mcp-hq.json` config defining MCP servers (stdio or HTTP)
2. `runServer()` creates an MCP server with registered tools
3. Tools connect to configured MCP servers on-demand to fetch metadata/tools
4. Responses return both `structuredContent` and JSON text content

### Key Patterns

- **Zod schemas** for config validation and type inference
- **p-limit(5)** for concurrent MCP server connections
- **try/finally** for MCP client cleanup (`client.close()`)
- Two server types: stdio (`command` + `args`) and HTTP (`url`)
