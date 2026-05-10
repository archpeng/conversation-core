import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { AgentService } from "./index.js";
import type { AgentServiceRuntimeConfig } from "./runtime-config.js";

export type StartedAgentHttpServer = {
  server: Server;
  url: string;
  close(): Promise<void>;
};

export async function startAgentHttpServer(config: AgentServiceRuntimeConfig, service: AgentService): Promise<StartedAgentHttpServer> {
  const server = createServer((request, response) => {
    void handleHttpRequest(config, service, request, response);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(config.port, config.host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://${address.address}:${address.port}`;
  return {
    server,
    url,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })
  };
}

async function handleHttpRequest(config: AgentServiceRuntimeConfig, service: AgentService, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!authorized(config, request)) {
    writeJson(response, 401, { type: "refusal", reason: "policy", message: "Unauthorized PMS Agent request." });
    return;
  }

  let body: string | undefined;
  try {
    body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request, config.maxInboundBodyBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      writeJson(response, 413, { type: "refusal", reason: "invalid_request", message: "Request body too large." });
      return;
    }
    throw error;
  }
  const serviceResponse = await service.handle({
    method: request.method ?? "GET",
    path: url.pathname,
    body
  });
  writeJson(response, serviceResponse.status, serviceResponse.body);
}

function authorized(config: AgentServiceRuntimeConfig, request: IncomingMessage): boolean {
  if (!config.inboundAuthToken) return true;
  const header = request.headers["x-pms-agent-token"];
  const token = Array.isArray(header) ? header[0] : header;
  return token === config.inboundAuthToken;
}

class BodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
  }
}

function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        rejectBody(new BodyTooLargeError());
        return;
      }
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", rejectBody);
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}
