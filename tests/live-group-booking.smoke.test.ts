import { describe, expect, it } from "vitest";
import type { AgentResult, FeishuTurnInput, PmsApprovalCard } from "../packages/adapter-contracts/src/index.js";

const liveSmokeEnabled = process.env.RUN_PMS_LIVE_SMOKE === "true";

describe.skipIf(!liveSmokeEnabled)("live PMS group-booking smoke", () => {
  it("uses the running real Pi/LLM agent, confirms the approval card, and verifies PMS readback", async () => {
    if (process.env.PMS_AGENT_PI_MODE === "stub") {
      throw new Error("RUN_PMS_LIVE_SMOKE requires a real Pi/LLM runtime, but PMS_AGENT_PI_MODE=stub.");
    }

    const config = liveSmokeConfig();
    const runId = `live-smoke-${Date.now()}`;

    if (config.resetPlatform) await resetPlatform(config);

    const first = await sendTurn(config, liveTurn(runId, 1, "给莉莉定两间房间"));
    const second = await sendTurn(config, liveTurn(runId, 2, "后天入住 两天后离开. 你这里有什么房型"));
    const third = await sendTurn(config, liveTurn(runId, 3, "花园别墅"));
    const card = requireApprovalCard(third);

    expect(first).toMatchObject({ type: "text" });
    expect(second).toMatchObject({ type: "text" });
    expect(JSON.stringify(second)).toContain("花园别墅");
    expect(JSON.stringify(second)).toContain("花园套房");
    expect(JSON.stringify(second)).toContain("秘境洞穴");
    expect(card.ref).toMatchObject({
      type: "pms_pending_action",
      action: "reservation_confirm",
      selectionCount: 2,
    });
    expect(card.summary).toContain("点击确认后");
    expect(card.summary).toContain("正式预订");
    expect(card.summary).toContain("房间分配");
    expect(card.summary).not.toContain("不代表最终预订");

    const confirm = await confirmPendingAction(config, card, runId);
    expect(confirm).toMatchObject({
      ok: true,
      operation: "pms.pending_action.confirm",
      mutationStatus: "committed",
      pendingAction: {
        workflowType: "reservationGroup",
        status: "confirmed",
        mutationStatus: "committed",
      },
    });

    const readback = await platformGetJson(config, "/v1/sandbox/readback");
    expect(readback.reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ guestDisplayName: "莉莉", roomType: "花园别墅", arrivalDate: "2026-05-12", departureDate: "2026-05-14", status: "booked" }),
      expect.objectContaining({ guestDisplayName: "莉莉", roomType: "花园别墅", arrivalDate: "2026-05-12", departureDate: "2026-05-14", status: "booked" }),
    ]));
    const liliReservations = (readback.reservations as Array<Record<string, unknown>>)
      .filter((reservation) =>
        reservation.guestDisplayName === "莉莉"
        && reservation.roomType === "花园别墅"
        && reservation.arrivalDate === "2026-05-12"
        && reservation.departureDate === "2026-05-14"
        && reservation.status === "booked"
      );
    const liliRoomIds = new Set(liliReservations.map((reservation) => reservation.roomId));
    expect(liliReservations).toHaveLength(2);
    expect(readback.reservationAllocations).toEqual(expect.arrayContaining(
      Array.from(liliRoomIds).map((roomId) =>
        expect.objectContaining({ roomId, roomType: "花园别墅", startDate: "2026-05-12", endDate: "2026-05-14", status: "allocated" })
      )
    ));
  }, 180_000);
});

type LiveSmokeConfig = {
  agentBaseUrl: string;
  agentToken: string;
  platformBaseUrl: string;
  platformToken: string;
  resetPlatform: boolean;
};

function liveSmokeConfig(): LiveSmokeConfig {
  return {
    agentBaseUrl: optionalEnv("PMS_LIVE_AGENT_URL") ?? "http://127.0.0.1:8792",
    agentToken: requiredEnv(["PMS_LIVE_AGENT_AUTH_TOKEN", "PMS_AGENT_AUTH_TOKEN"]),
    platformBaseUrl: optionalEnv("PMS_LIVE_PLATFORM_URL") ?? optionalEnv("PMS_PLATFORM_BASE_URL") ?? "http://127.0.0.1:8791",
    platformToken: requiredEnv(["PMS_LIVE_PLATFORM_AUTH_TOKEN", "PMS_PLATFORM_LOCAL_AUTH_TOKEN", "PMS_PLATFORM_AUTH_TOKEN"]),
    resetPlatform: process.env.PMS_LIVE_SMOKE_RESET === "true",
  };
}

function liveTurn(runId: string, turnIndex: number, text: string): FeishuTurnInput {
  return {
    channel: "feishu",
    tenantId: "tenant_live_smoke",
    sessionId: runId,
    messageId: `${runId}-message-${turnIndex}`,
    actor: { role: "customer", id: "live-smoke-user", displayName: "JL" },
    message: { text },
    receivedAt: "2026-05-10T00:00:00.000Z",
  };
}

async function sendTurn(config: LiveSmokeConfig, turn: FeishuTurnInput): Promise<AgentResult> {
  return postJson<AgentResult>(`${config.agentBaseUrl}/v1/feishu-turn`, turn, {
    "content-type": "application/json",
    "x-pms-agent-token": config.agentToken,
  });
}

async function resetPlatform(config: LiveSmokeConfig): Promise<void> {
  await platformPostJson(config, "/v1/sandbox/reset", {});
}

async function confirmPendingAction(config: LiveSmokeConfig, card: PmsApprovalCard, runId: string): Promise<Record<string, unknown>> {
  const pendingActionRef = card.ref.pendingActionRef ?? card.ref.pendingActionId;
  if (!card.ref.cardPayloadRef) throw new Error("approval card is missing cardPayloadRef; cannot simulate typed card callback");
  return platformPostJson(config, "/v1/pms/pending-actions/confirm", {
    operation: "pms.pending_action.confirm",
    pendingActionRef,
    actor: { type: "human", id: "live-smoke-user", displayName: "JL" },
    scope: { propertyId: "property-small-hotel", channel: "typed_card", userIdHash: "sha256:live-smoke-user" },
    clientToken: `${runId}-confirm`,
    requestFingerprint: `sha256:${runId}-confirm`,
    correlationId: `corr-${runId}`,
    requestedAt: "2026-05-10T00:05:00.000Z",
    cardPayloadRef: card.ref.cardPayloadRef,
  });
}

async function platformGetJson(config: LiveSmokeConfig, path: string): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`${config.platformBaseUrl}${path}`, {
    authorization: `Bearer ${config.platformToken}`,
  });
}

async function platformPostJson(config: LiveSmokeConfig, path: string, body: unknown): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>>(`${config.platformBaseUrl}${path}`, body, {
    "content-type": "application/json",
    authorization: `Bearer ${config.platformToken}`,
  });
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}: ${redactedBody(text)}`);
  return JSON.parse(text) as T;
}

async function postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`POST ${url} failed with HTTP ${response.status}: ${redactedBody(text)}`);
  return JSON.parse(text) as T;
}

function requireApprovalCard(result: AgentResult): PmsApprovalCard {
  if (result.type !== "approval_card") {
    throw new Error(`Expected approval_card from final live turn, got ${redactedBody(JSON.stringify(result))}`);
  }
  return result.card;
}

function requiredEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = optionalEnv(name);
    if (value) return value;
  }
  throw new Error(`Missing required env var. Set one of: ${names.join(", ")}`);
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function redactedBody(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/"x-pms-agent-token"\s*:\s*"[^"]+"/gi, "\"x-pms-agent-token\":\"[redacted]\"")
    .slice(0, 2000);
}
