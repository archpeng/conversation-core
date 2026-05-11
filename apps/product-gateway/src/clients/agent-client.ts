import { validateAgentResult, type AgentResult } from "@pms-agent-v2/adapter-contracts";
import type { MobileAgentTurnInput } from "@pms-agent-v2/product-contracts";

export type AgentClient = {
  runMobileTurn(turn: MobileAgentTurnInput): Promise<AgentResult>;
};

export function createHttpAgentClient(input: { baseUrl: string; authToken?: string; fetch?: typeof fetch }): AgentClient {
  const fetchImpl = input.fetch ?? fetch;
  return {
    async runMobileTurn(turn) {
      const response = await fetchImpl(urlFor(input.baseUrl, "/v1/mobile-turn"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(input.authToken ? { "x-pms-agent-token": input.authToken } : {})
        },
        body: JSON.stringify(turn)
      });
      if (!response.ok) throw new Error(`agent_service_http_${response.status}`);
      const payload = await response.json();
      const result = validateAgentResult(payload);
      if (!result.ok) throw new Error("agent_service_invalid_result");
      return result.value;
    }
  };
}

function urlFor(baseUrl: string, route: string): string {
  return `${baseUrl.replace(/\/$/, "")}${route}`;
}
