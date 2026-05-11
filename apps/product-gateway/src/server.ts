import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ProductGatewayService } from "./service.js";
import type { ProductGatewayConfig, ProductGatewayRequest } from "./types.js";

export type StartedProductGatewayServer = {
  server: Server;
  url: string;
  close(): Promise<void>;
};

export async function startProductGatewayServer(config: ProductGatewayConfig, service: ProductGatewayService): Promise<StartedProductGatewayServer> {
  const server = createServer((request, response) => {
    void handleHttpRequest(config, service, request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  const url = `http://${address.address}:${address.port}`;
  return {
    server,
    url,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

async function handleHttpRequest(config: ProductGatewayConfig, service: ProductGatewayService, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method?.toUpperCase() === "OPTIONS") {
    writeJson(config, response, 204, {});
    return;
  }

  let body: unknown;
  try {
    body = request.method === "GET" || request.method === "HEAD" ? undefined : await readJsonBody(request, config.maxInboundBodyBytes);
  } catch {
    writeJson(config, response, 400, { ok: false, code: "invalid_request", message: "Request body must be valid JSON." });
    return;
  }

  const gatewayRequest: ProductGatewayRequest = {
    method: request.method ?? "GET",
    path: url.pathname,
    query: url.searchParams,
    headers: normalizedHeaders(request),
    body
  };
  const result = await service.handle(gatewayRequest);
  writeJson(config, response, result.status, result.body, result.headers);
}

function normalizedHeaders(request: IncomingMessage): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return headers;
}

function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  return readBody(request, maxBytes).then((text) => text.trim() ? JSON.parse(text) : undefined);
}

function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) reject(new Error("request_body_too_large"));
      else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeJson(config: ProductGatewayConfig, response: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": config.corsOrigin ?? "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-product-gateway-token",
    ...headers
  });
  response.end(statusCode === 204 ? "" : `${JSON.stringify(body)}\n`);
}
