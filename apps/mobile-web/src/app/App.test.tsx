// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("mobile web app", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the agent-first mobile shell", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(sessionResponse())));

    render(<App />);

    expect(screen.getByText("Conversation")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent message")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Objects")).toBeInTheDocument();
    expect(screen.getByLabelText("Review")).toBeInTheDocument();
  });

  it("renders agent replies and executes inline action cards", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("/api/session/current")) return jsonResponse(sessionResponse());
      if (target.includes("/api/mobile/turn")) {
        return jsonResponse({
          ok: true,
          task: taskResponse({
            id: "task-agent-1",
            summary: "今天暂无到店。",
            messages: ["今天暂无到店。"],
            evidenceRefs: ["pms_ev_arrivals"],
            objectRefs: [{ kind: "reservation", id: "R-1", label: "张三 · D1", evidenceRefs: ["pms_ev_arrivals"] }],
            actionCards: [{
              id: "card-1",
              title: "确认操作",
              summary: "需要确认后执行。",
              mutationStatus: "awaitingConfirmation",
              confirmationMode: "typedCardOnly",
              actions: [{ id: "confirm", label: "确认执行", kind: "primary" }]
            }]
          })
        });
      }
      if (target.includes("/api/tasks/task-agent-1/action-cards/card-1/actions/confirm")) {
        return jsonResponse({
          ok: true,
          task: taskResponse({
            id: "task-agent-1",
            status: "committed",
            summary: "操作已完成。",
            messages: ["操作已完成。"],
            actionCards: [{
              id: "card-1",
              title: "确认操作",
              summary: "需要确认后执行。",
              mutationStatus: "committed",
              confirmationMode: "typedCardOnly",
              actions: [{ id: "confirm", label: "确认执行", kind: "primary", disabled: true }]
            }]
          })
        });
      }
      return jsonResponse(sessionResponse());
    }));

    render(<App />);

    await waitFor(() => expect(screen.getByText("在线")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Agent message"), { target: { value: "今天到店情况" } });
    await waitFor(() => expect(screen.getByLabelText("Send message")).not.toBeDisabled());
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByText("今天到店情况")).toBeInTheDocument();
    expect(await screen.findByText("今天暂无到店。")).toBeInTheDocument();
    expect(screen.queryByText(/依据 PMS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pms_ev_arrivals/)).not.toBeInTheDocument();
    expect(screen.queryByText("证据 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PMS 证据 1 条" }));
    expect(screen.getByText("证据 1")).toBeInTheDocument();
    expect(screen.getByText("pms_ev_arrivals")).toBeInTheDocument();
    expect(screen.getByText("确认操作")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "张三 · D1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认执行" }));
    expect(await screen.findByText("操作已完成。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认执行" })).toBeDisabled();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("exposes PMS read object lookup modes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("/api/session/current")) return jsonResponse(sessionResponse());
      if (target.includes("/api/objects/reservations/")) {
        return jsonResponse({
          ok: true,
          object: {
            ref: { kind: "reservation", id: "RES-001", label: "RES-001" },
            status: "confirmed",
            roomId: "room_1",
            evidenceRefs: ["pms_ev_reservation"]
          }
        });
      }
      return jsonResponse({ ok: true, tasks: [] });
    }));

    render(<App />);
    fireEvent.click(screen.getByLabelText("Objects"));

    expect(screen.getByRole("button", { name: "房间" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预订" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "可用房" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预订" }));
    fireEvent.change(screen.getByLabelText("Reservation id"), { target: { value: "RES-001" } });
    fireEvent.click(screen.getByLabelText("Search object"));

    await waitFor(() => expect(screen.getByText("confirmed")).toBeInTheDocument());
    expect(screen.getByText("房间：room_1")).toBeInTheDocument();
  });
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  };
}

function sessionResponse() {
  return {
    ok: true,
    session: {
      sessionId: "session-test",
      tenantId: "tenant_1",
      propertyId: "property_small_hotel",
      actor: { role: "staff", id: "mobile_staff_1", displayName: "Mobile Staff" },
      expiresAt: "2026-05-12T01:00:00.000Z"
    }
  };
}

function taskResponse(input: {
  id: string;
  status?: string;
  summary: string;
  messages?: string[];
  evidenceRefs?: string[];
  actionCards?: unknown[];
  objectRefs?: unknown[];
}) {
  return {
    id: input.id,
    title: "Agent response",
    summary: input.summary,
    status: input.status ?? "read_only",
    source: "agent",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    evidenceRefs: input.evidenceRefs ?? [],
    objectRefs: input.objectRefs ?? [],
    actionCards: input.actionCards ?? [],
    messages: input.messages ?? []
  };
}
