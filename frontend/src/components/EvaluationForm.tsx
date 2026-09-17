import { type WorkbenchState } from "../useWorkbench";
import { names } from "../types";

type Props = Pick<
  WorkbenchState,
  | "evaluate"
  | "role"
  | "busy"
  | "catalog"
  | "selected"
  | "setSelected"
  | "suite"
  | "setSuite"
  | "custom"
  | "setCustom"
>;
export default function EvaluationForm({
  evaluate,
  role,
  busy,
  catalog,
  selected,
  setSelected,
  suite,
  setSuite,
  custom,
  setCustom,
}: Props) {
  return (
    <form className="panel" onSubmit={evaluate}>
      <span className="eyebrow">01 / CONFIGURE</span>
      <h2>New evaluation</h2>
      {role === "viewer" && (
        <p className="muted">
          Read-only access. Open a saved run to inspect it.
        </p>
      )}
      <fieldset disabled={!!busy || role === "viewer"}>
        <legend>Implementations</legend>
        <div className="implementations">
          {catalog.map((item) => (
            <label
              key={item.id}
              className={`implementation ${selected.includes(item.id) ? "selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!item.available}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
              <span
                className={`language-badge language-${item.id}`}
                aria-hidden="true"
              >
                {
                  {
                    python: "PY",
                    javascript: "JS",
                    java: "JV",
                    go: "GO",
                    rust: "RS",
                    "javascript-mutant": "!!",
                  }[item.id]
                }
              </span>
              <span>
                {names[item.id]}
                <small>
                  {!item.available
                    ? "Build required"
                    : item.mutant
                      ? "Intentionally incorrect"
                      : "Ready to evaluate"}
                </small>
              </span>
              <span
                className={`runtime-dot ${item.available ? "ready" : ""}`}
              />
            </label>
          ))}
        </div>
        <label htmlFor="suite">Test suite</label>
        <select
          id="suite"
          value={suite}
          onChange={(e) => setSuite(e.target.value)}
        >
          <option value="boundaries">Boundary cases · 9 tests</option>
          <option value="regression">Seeded regression · 49 tests</option>
          <option value="custom">Custom intervals</option>
        </select>
        {suite === "custom" && (
          <>
            <label htmlFor="custom">Intervals as JSON</label>
            <textarea
              id="custom"
              rows={4}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              spellCheck={false}
            />
            <small className="muted">
              At most 128 integer pairs; endpoints between ±1,000,000.
            </small>
          </>
        )}
        <button className="primary full" disabled={!selected.length}>
          {busy === "run" ? "Evaluating…" : "Run evaluation →"}
        </button>
      </fieldset>
      <p className="footnote">
        Only checked-in implementations run here. No uploaded or arbitrary code
        execution.
      </p>
    </form>
  );
}
