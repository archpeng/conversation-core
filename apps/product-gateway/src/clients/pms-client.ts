import { createPmsPlatformClient, type PmsFetch } from "@pms-agent-v2/pms-platform-client";
import type { ProductGatewayPmsClient } from "../types.js";

export function createHttpPmsClient(input: { baseUrl: string; authToken?: string; fetch?: typeof fetch }): ProductGatewayPmsClient {
  return createPmsPlatformClient({
    baseUrl: input.baseUrl,
    authToken: input.authToken,
    fetch: pmsFetch(input.fetch ?? fetch)
  });
}

function pmsFetch(fetchImpl: typeof fetch): PmsFetch {
  return async (url, init) => {
    const response = await fetchImpl(url, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
      text: () => response.text()
    };
  };
}
