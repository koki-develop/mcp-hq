import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Config } from "../config";

interface PooledConnection {
  client: Client;
  transport: Transport;
  status: "connecting" | "connected" | "reconnecting" | "closed";
  connectPromise?: Promise<void>;
  reconnectAttempts: number;
}

const RECONNECT_OPTIONS = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

export class ConnectionPool {
  private connections = new Map<string, PooledConnection>();
  private config: Config;
  private closing = false;

  constructor(config: Config) {
    this.config = config;
  }

  async getClient(serverName: string): Promise<Client> {
    if (this.closing) {
      throw new Error("Connection pool is closing");
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      throw new Error(
        `MCP server "${serverName}" not found in configuration. Available servers: ${Object.keys(this.config.mcpServers).join(", ")}`,
      );
    }

    let conn = this.connections.get(serverName);

    // 接続がない、または閉じている場合は新規作成
    if (!conn || conn.status === "closed") {
      conn = await this.createConnection(serverName, serverConfig);
    }

    // 接続中の場合は完了を待つ
    if (conn.status === "connecting" && conn.connectPromise) {
      await conn.connectPromise;
    }

    // 再接続中の場合も完了を待つ
    if (conn.status === "reconnecting" && conn.connectPromise) {
      await conn.connectPromise;
    }

    return conn.client;
  }

  private async createConnection(
    serverName: string,
    serverConfig: Config["mcpServers"][string],
  ): Promise<PooledConnection> {
    // トランスポートを作成
    let transport: Transport;
    if ("command" in serverConfig) {
      transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args ?? [],
      });
    } else if ("url" in serverConfig) {
      transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));
    } else {
      throw new Error(`Invalid server config for "${serverName}"`);
    }

    const client = new Client({
      name: "mcp-hq-pooled-client",
      version: "0.0.0",
    });

    const conn: PooledConnection = {
      client,
      transport,
      status: "connecting",
      reconnectAttempts: 0,
    };

    // 接続完了を待つ Promise を作成
    conn.connectPromise = (async () => {
      try {
        await client.connect(transport);
        conn.status = "connected";

        // エラー・クローズハンドラを設定
        transport.onerror = (error) => {
          console.error(`Transport error for ${serverName}:`, error);
          conn.status = "closed";
        };

        transport.onclose = () => {
          conn.status = "closed";
        };
      } catch (error) {
        conn.status = "closed";
        this.connections.delete(serverName);
        throw error;
      }
    })();

    this.connections.set(serverName, conn);
    await conn.connectPromise;

    return conn;
  }

  async reconnect(serverName: string): Promise<void> {
    const conn = this.connections.get(serverName);
    if (!conn) return;

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) return;

    if (conn.reconnectAttempts >= RECONNECT_OPTIONS.maxAttempts) {
      throw new Error(
        `Max reconnect attempts (${RECONNECT_OPTIONS.maxAttempts}) reached for "${serverName}"`,
      );
    }

    conn.status = "reconnecting";
    conn.reconnectAttempts++;

    const delay =
      RECONNECT_OPTIONS.delayMs *
      RECONNECT_OPTIONS.backoffMultiplier ** (conn.reconnectAttempts - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));

    // 古い接続をクローズ
    try {
      await conn.client.close();
    } catch {
      // ignore
    }

    // 接続を削除して新規作成
    this.connections.delete(serverName);
    await this.createConnection(serverName, serverConfig);
  }

  async close(serverName: string): Promise<void> {
    const conn = this.connections.get(serverName);
    if (conn) {
      conn.status = "closed";
      try {
        await conn.client.close();
      } catch {
        // ignore
      }
      this.connections.delete(serverName);
    }
  }

  async closeAll(): Promise<void> {
    this.closing = true;
    const closePromises = Array.from(this.connections.keys()).map((name) =>
      this.close(name),
    );
    await Promise.all(closePromises);
    this.connections.clear();
  }
}
