import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const response = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("Workspace", () => {
  it("shows access errors without opening the workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      response({ error: "A valid access token is required" }, 401),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText("Access token"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByText("Open workspace →"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("New evaluation")).toBeNull();
  });

  it("runs an evaluation and saves review notes through the API", async () => {
    const run = {
      id: "a".repeat(32),
      created_at: "2026-09-17T10:00:00Z",
      suite: "boundaries",
      verdict: "unreviewed",
      note: "",
      version: 0,
      results: [
        {
          language: "python",
          status: "passed",
          passed: 9,
          total: 9,
          duration_ms: 10,
          cases: [
            {
              name: "empty",
              input: [],
              expected: [],
              actual: [],
              passed: true,
            },
          ],
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((url, options) => {
        if (String(url).endsWith("/catalog"))
          return response({
            implementations: [{ id: "python", available: true, mutant: false }],
          });
        if (options?.method === "POST") return response(run, 201);
        if (options?.method === "PATCH")
          return response({
            ...run,
            verdict: "approved",
            note: "Checked every boundary.",
          });
        return response({ runs: [] });
      });
    render(<App />);
    fireEvent.change(screen.getByLabelText("Access token"), {
      target: { value: "test-token" },
    });
    fireEvent.click(screen.getByText("Open workspace →"));
    fireEvent.click(await screen.findByText("Run evaluation →"));
    await screen.findByText("Evaluation complete. Results saved.");
    fireEvent.change(screen.getByLabelText("Verdict"), {
      target: { value: "approved" },
    });
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Checked every boundary." },
    });
    fireEvent.click(screen.getByText("Save review"));
    await screen.findByText("Review saved.");
    expect(
      fetchMock.mock.calls.some(
        ([, options]) =>
          options?.method === "PATCH" &&
          JSON.parse(options.body as string).note === "Checked every boundary.",
      ),
    ).toBe(true);
    fireEvent.click(screen.getByText("Lock session"));
    await waitFor(() =>
      expect(screen.getByLabelText("Access token")).toBeTruthy(),
    );
    expect(screen.queryByText("Evaluation results")).toBeNull();
  });

  it("rejects malformed custom JSON before sending an evaluation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
      String(url).endsWith("/catalog")
        ? response({
            implementations: [{ id: "python", available: true, mutant: false }],
          })
        : response({ runs: [] }),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText("Access token"), {
      target: { value: "test-token" },
    });
    fireEvent.click(screen.getByText("Open workspace →"));
    fireEvent.change(await screen.findByLabelText("Test suite"), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByLabelText("Intervals as JSON"), {
      target: { value: "oops" },
    });
    fireEvent.click(screen.getByText("Run evaluation →"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "valid JSON",
    );
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
  });
});
