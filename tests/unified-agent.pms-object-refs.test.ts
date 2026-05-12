import { describe, expect, it } from "vitest";
import { createPmsEvidence, type ReservationFact } from "../packages/pms-platform-client/src/index.js";
import { createUnifiedAgentSession, runAgentTurn } from "../packages/unified-agent/src/index.js";
import { baseTurn, fakeCreateAgentSessionWithToolCalls, pmsReadExecutors, safetyGateway } from "./unified-agent.helpers.js";

describe("unified Agent PMS object refs", () => {
  it("synthesizes arrival guest and room details from PMS evidence object refs", async () => {
    const arrivals = createPmsEvidence({
      method: "todayArrivals",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-12T08:00:00.000Z",
      summary: "1 arrivals: R-8BECAC0845AFE7E8 张三 D1 booked.",
      data: {
        arrivals: [{
          reservationCode: "R-8BECAC0845AFE7E8",
          reservationId: "reservation-1",
          guestName: "张三",
          roomId: "room-D1",
          roomNumber: "D1",
          roomType: "秘境洞穴",
          arrivalDate: "2026-05-12",
          departureDate: "2026-05-13",
          status: "booked"
        }]
      }
    });
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_today_arrivals", params: { businessDate: "2026-05-12" } }],
        text: "今天到店 1 单：R-8BECAC0845AFE7E8。"
      }], prompts),
      executors: {
        pmsReadExecutors: pmsReadExecutors({
          pms_today_arrivals: () => arrivals
        })
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "今天到店" } });

    expect(result).toMatchObject({
      type: "text",
      evidenceRefs: [arrivals.evidenceRef],
      objectRefs: [expect.objectContaining({ kind: "reservation", id: "R-8BECAC0845AFE7E8", label: "张三 · D1" })]
    });
    expect(result.type === "text" ? result.text : "").toContain("张三 · D1 · 秘境洞穴");
    expect(result.type === "text" ? result.text : "").toContain("状态：booked");
    expect(session.state.objectRefs).toContainEqual(expect.objectContaining({ kind: "reservation", id: "R-8BECAC0845AFE7E8" }));
    expect(prompts[0]).not.toContain("张三 · D1");
  });

  it("keeps recent reservation refs available for follow-up detail lookup", async () => {
    const arrivals = createPmsEvidence({
      method: "todayArrivals",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-12T08:00:00.000Z",
      summary: "1 arrivals.",
      data: { arrivals: [{ reservationCode: "R-8BECAC0845AFE7E8", guestName: "张三", roomId: "room-D1", roomNumber: "D1", status: "booked" }] }
    });
    const lookup = reservationEvidence("R-8BECAC0845AFE7E8", "张三", "D1");
    const lookupRequests: unknown[] = [];
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([
        { calls: [{ toolName: "pms_today_arrivals", params: { businessDate: "2026-05-12" } }], text: "今天到店 1 单。" },
        { calls: [{ toolName: "pms_reservation_lookup", params: { target: "R-8BECAC0845AFE7E8" } }], text: "详情已查到。" }
      ], prompts),
      executors: {
        pmsReadExecutors: pmsReadExecutors({
          pms_today_arrivals: () => arrivals,
          pms_reservation_lookup: ({ request }) => {
            lookupRequests.push({ reservationCode: request.reservationCode, reservationId: request.reservationId, target: request.target });
            return lookup;
          }
        })
      }
    });

    await runAgentTurn(session, { ...baseTurn, message: { text: "今天到店" } });
    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "客人详情" }, messageId: "message_2" });

    expect(prompts[1]).toContain("recentObjectRefs=reservation:R-8BECAC0845AFE7E8");
    expect(lookupRequests).toEqual([{ reservationCode: undefined, reservationId: undefined, target: "R-8BECAC0845AFE7E8" }]);
    expect(result.type === "text" ? result.text : "").toContain("预订 R-8BECAC0845AFE7E8");
    expect(result.type === "text" ? result.text : "").toContain("张三 · D1 · 秘境洞穴");
  });

  it("does not require aggregate lineage for ordinary arrival identity questions", async () => {
    const arrivals = createPmsEvidence({
      method: "todayArrivals",
      tenantId: "tenant_1",
      fetchedAt: "2026-05-12T08:00:00.000Z",
      summary: "1 arrivals.",
      data: { arrivals: [{ reservationCode: "R-1", guestName: "张三", roomId: "room-D1", roomNumber: "D1", status: "booked" }] }
    });
    const prompts: string[] = [];
    const session = await createUnifiedAgentSession({
      turn: baseTurn,
      gateway: safetyGateway([]),
      createAgentSession: fakeCreateAgentSessionWithToolCalls([{
        calls: [{ toolName: "pms_today_arrivals", params: { businessDate: "2026-05-12" } }],
        text: "今天入住的是张三。"
      }], prompts),
      executors: {
        pmsReadExecutors: pmsReadExecutors({
          pms_today_arrivals: () => arrivals
        })
      }
    });

    const result = await runAgentTurn(session, { ...baseTurn, message: { text: "今天入住的是谁？" } });

    expect(prompts).toHaveLength(1);
    expect(result).toMatchObject({ type: "text", evidenceRefs: [arrivals.evidenceRef] });
  });
});

function reservationEvidence(reservationCode: string, guestName: string, roomNumber: string) {
  return createPmsEvidence<ReservationFact>({
    method: "reservationLookup",
    tenantId: "tenant_1",
    fetchedAt: "2026-05-13T08:00:00.000Z",
    summary: `Reservation ${reservationCode}: guest ${guestName} room ${roomNumber} 秘境洞穴 dates 2026-05-10 to 2026-05-15 status booked.`,
    data: {
      reservationId: `reservation-${reservationCode.toLowerCase()}`,
      reservationCode,
      guestName,
      roomId: `room-${roomNumber}`,
      roomNumber,
      roomType: "秘境洞穴",
      arrivalDate: "2026-05-10",
      departureDate: "2026-05-15",
      status: "booked"
    }
  });
}
