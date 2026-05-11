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
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, tasks: [] })
    })));

    render(<App />);

    expect(screen.getByText("Today Agent Feed")).toBeInTheDocument();
    expect(screen.getByText("Ask Agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Objects")).toBeInTheDocument();
    expect(screen.getByLabelText("Review")).toBeInTheDocument();
  });

  it("exposes PMS read object lookup modes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("/api/objects/reservations/")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            object: {
              ref: { kind: "reservation", id: "RES-001", label: "RES-001" },
              status: "confirmed",
              roomId: "room_1",
              evidenceRefs: ["pms_ev_reservation"]
            }
          })
        };
      }
      return { ok: true, json: async () => ({ ok: true, tasks: [] }) };
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
