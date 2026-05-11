// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("mobile web app", () => {
  afterEach(() => {
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
});
