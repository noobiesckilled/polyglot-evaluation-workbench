import { useState } from "react";
import { request, ApiError } from "./api";
import { type Implementation, type Run } from "./types";

export function useWorkbench() {
  // Access tokens remain in memory and are cleared on refresh or lock.
  const [token, setToken] = useState("");
  const [role, setRole] = useState("operator");
  const [draftToken, setDraftToken] = useState("");
  const [catalog, setCatalog] = useState<Implementation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [suite, setSuite] = useState("boundaries");
  const [custom, setCustom] = useState("[[1, 3], [3, 5], [8, 10]]");
  const [history, setHistory] = useState<Run[]>([]);
  const [active, setActive] = useState<Run | null>(null);
  const [language, setLanguage] = useState("");
  const [verdict, setVerdict] = useState<Run["verdict"]>("unreviewed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function loadRun(run: Run) {
    setActive(run);
    setLanguage(run.results[0]?.language || "");
    setVerdict(run.verdict);
    setNote(run.note);
  }
  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      setToken("");
      setDraftToken("");
    }
    setError(
      error instanceof Error
        ? error.message
        : "Something went wrong. Please retry.",
    );
  }
  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy("unlock");
    setError("");
    try {
      const [catalogData, historyData] = await Promise.all([
        request<{ implementations: Implementation[]; role: string }>(
          "/api/catalog",
          draftToken,
        ),
        request<{ runs: Run[] }>("/api/runs", draftToken),
      ]);
      setRole(catalogData.role || "operator");
      setActive(null);
      setNotice("");
      setToken(draftToken);
      setDraftToken("");
      setCatalog(catalogData.implementations);
      setSelected(
        catalogData.implementations
          .filter((i) => i.available && !i.mutant)
          .map((i) => i.id),
      );
      setHistory(historyData.runs);
    } catch (error) {
      report(error);
    } finally {
      setBusy("");
    }
  }
  async function evaluate(event: React.FormEvent) {
    event.preventDefault();
    setBusy("run");
    setError("");
    setNotice("");
    try {
      let intervals;
      if (suite === "custom") {
        try {
          intervals = JSON.parse(custom);
        } catch {
          throw new Error(
            "Custom intervals must be valid JSON, for example [[1,3],[3,5]].",
          );
        }
      }
      const run = await request<Run>("/api/runs", token, "POST", {
        languages: selected,
        suite,
        ...(suite === "custom" ? { intervals } : {}),
      });
      loadRun(run);
      setHistory((current) => [run, ...current].slice(0, 50));
      setNotice("Evaluation complete. Results saved.");
    } catch (error) {
      report(error);
    } finally {
      setBusy("");
    }
  }
  async function openRun(id: string) {
    setBusy("history");
    setError("");
    setNotice("");
    try {
      loadRun(await request<Run>(`/api/runs/${id}`, token));
    } catch (error) {
      report(error);
    } finally {
      setBusy("");
    }
  }
  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    setBusy("review");
    setError("");
    setNotice("");
    try {
      const updated = await request<Run>(
        `/api/runs/${active.id}/review`,
        token,
        "PATCH",
        { verdict, note, version: active.version },
      );
      setActive(updated);
      setHistory((current) =>
        current.map((run) => (run.id === updated.id ? updated : run)),
      );
      setNotice("Review saved.");
    } catch (error) {
      report(error);
    } finally {
      setBusy("");
    }
  }
  const currentResult = active?.results.find((r) => r.language === language);
  const passed =
    active?.results.filter((r) => r.status === "passed").length || 0;

  return {
    token,
    setToken,
    role,
    draftToken,
    setDraftToken,
    catalog,
    selected,
    setSelected,
    suite,
    setSuite,
    custom,
    setCustom,
    history,
    setHistory,
    active,
    setActive,
    language,
    setLanguage,
    verdict,
    setVerdict,
    note,
    setNote,
    busy,
    error,
    setError,
    notice,
    setNotice,
    unlock,
    evaluate,
    openRun,
    saveReview,
    currentResult,
    passed,
  };
}
export type WorkbenchState = ReturnType<typeof useWorkbench>;
