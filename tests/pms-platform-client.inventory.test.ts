import { describe, expect, it } from "vitest";
import { createPmsPlatformClient, type InventorySummaryInput, type RoomReservationContextInput, type TodayArrivalsInput, type TodayDeparturesInput } from "../packages/pms-platform-client/src/index.js";
import { fakeFetch, invalidPmsInput, type FetchCall } from "./pms-platform-client.helpers.js";

describe("PMS Platform client inventory reads", () => {
  it("wraps inventorySummary in evidence with parsed result", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.inventorySummary({
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      startDate: "2026-05-09",
      endDate: "2026-05-10"
    });

    expect(evidence.source.method).toBe("inventorySummary");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(calls[0].body).toEqual({
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      startDate: "2026-05-09",
      horizonDays: 2
    });
    expect(evidence.summary).toContain("Inventory for");
    expect(evidence.summary).toContain("10 total rooms across 2 dates");
    expect(evidence.summary).toContain("Room types:");
    expect(evidence.data.dates).toHaveLength(2);
    expect(evidence.data.roomTypes).toEqual([
      { roomType: "花园别墅", total: 6 },
      { roomType: "花园套房", total: 4 }
    ]);
    expect(evidence.data.dates[0]).toEqual({
      date: "2026-05-09",
      total: 10,
      available: 5,
      reserved: 3,
      blocked: 1,
      occupied: 1
    });
  });

  it("wraps roomReservationContext in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.roomReservationContext({
      tenantId: "tenant_1",
      roomId: "room_1"
    });

    expect(evidence.source.method).toBe("roomReservationContext");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("Room room_1: current status occupied, associated with 3 reservation(s)/block(s).");
    expect(evidence.data).toEqual({
      roomId: "room_1",
      currentStatus: "occupied",
      reservationRefs: ["res_ref_1", "res_ref_2"],
      blockRefs: ["block_ref_1"]
    });
  });

  it("wraps todayArrivals in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.todayArrivals({
      tenantId: "tenant_1",
      businessDate: "2026-05-09"
    });

    expect(evidence.source.method).toBe("todayArrivals");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("RES-001, RES-002");
    expect(evidence.data.arrivals).toHaveLength(2);
    expect(evidence.data.arrivals[0]).toEqual({
      reservationCode: "RES-001",
      roomId: "room_1",
      guestName: "Alice",
      status: "checkedIn"
    });
  });

  it("parses pms-platform projection shape for today arrivals", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          readModel: {
            reservations: [
              {
                reservationCode: "R-001",
                roomId: "room-D2",
                guestDisplayName: "李晶晶",
                status: "booked"
              }
            ]
          }
        })
      }),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.todayArrivals({
      tenantId: "tenant_1",
      businessDate: "2026-05-09"
    });

    expect(evidence.data.arrivals).toEqual([
      { reservationCode: "R-001", roomId: "room-D2", guestName: "李晶晶", status: "booked" }
    ]);
  });

  it("wraps todayDepartures in evidence with parsed result", async () => {
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch([]),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.todayDepartures({
      tenantId: "tenant_1",
      businessDate: "2026-05-09"
    });

    expect(evidence.source.method).toBe("todayDepartures");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.summary).toContain("RES-003");
    expect(evidence.data.departures).toHaveLength(1);
    expect(evidence.data.departures[0]).toEqual({
      reservationCode: "RES-003",
      roomId: "room_3",
      guestName: "Charlie",
      status: "checkedOut"
    });
  });

  it("supports reservationLookup by reservationCode", async () => {
    const calls: FetchCall[] = [];
    const client = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: fakeFetch(calls),
      now: () => new Date("2026-05-09T08:00:00.000Z")
    });

    const evidence = await client.reservationLookup({
      tenantId: "tenant_1",
      reservationCode: "RES-001"
    });

    expect(evidence.source.method).toBe("reservationLookup");
    expect(evidence.scope).toEqual({ tenantId: "tenant_1" });
    expect(evidence.data).toMatchObject({ reservationId: "res_1" });
    expect(calls[calls.length - 1].body).toMatchObject({ tenantId: "tenant_1", reservationCode: "RES-001" });
  });

  it("rejects invalid inventorySummary input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    const invalidInputs = [
      invalidPmsInput<InventorySummaryInput>({ tenantId: "t", propertyId: "p", startDate: "invalid", endDate: "2026-05-10" }),
      invalidPmsInput<InventorySummaryInput>({})
    ];

    for (const invalid of invalidInputs) {
      try {
        await client.inventorySummary(invalid);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toMatchObject({
          name: "PmsPlatformClientError",
          operation: "inventorySummary",
          causeCode: "invalid_input"
        });
      }
    }
  });

  it("rejects invalid roomReservationContext input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    try {
      await client.roomReservationContext(invalidPmsInput<RoomReservationContextInput>({}));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "roomReservationContext",
        causeCode: "invalid_input"
      });
    }
  });

  it("rejects invalid todayArrivals and todayDepartures input", async () => {
    const client = createPmsPlatformClient({ baseUrl: "https://pms.local", fetch: fakeFetch([]) });

    try {
      await client.todayArrivals(invalidPmsInput<TodayArrivalsInput>({}));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayArrivals",
        causeCode: "invalid_input"
      });
    }
    try {
      await client.todayDepartures(invalidPmsInput<TodayDeparturesInput>({}));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayDepartures",
        causeCode: "invalid_input"
      });
    }
  });

  it("returns HTTP error for new inventory endpoints", async () => {
    const errorClient = createPmsPlatformClient({
      baseUrl: "https://pms.local",
      fetch: async () => ({ ok: false, status: 503, json: async () => ({}) })
    });

    try {
      await errorClient.inventorySummary({
        tenantId: "tenant_1",
        propertyId: "property_small_hotel",
        startDate: "2026-05-09",
        endDate: "2026-05-10"
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "inventorySummary",
        causeCode: "http_error",
        status: 503
      });
    }
    try {
      await errorClient.todayArrivals({
        tenantId: "tenant_1",
        businessDate: "2026-05-09"
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({
        name: "PmsPlatformClientError",
        operation: "todayArrivals",
        causeCode: "http_error",
        status: 503
      });
    }
  });
});
