import { type WorkbenchState } from "../useWorkbench";
import Status from "./Status";
import { names } from "../types";
import ResultPanel from "./ResultPanel";

type Props = Pick<
  WorkbenchState,
  "active" | "passed" | "language" | "setLanguage" | "currentResult"
>;
export default function EvaluationResults({
  active,
  passed,
  language,
  setLanguage,
  currentResult,
}: Props) {
  return (
    <section className="panel">
      <div className="section-line">
        <div>
          <span className="eyebrow">02 / INSPECT</span>
          <h2>Evaluation results</h2>
        </div>
        {active && (
          <span className="count">
            {passed} / {active.results.length} passed
          </span>
        )}
      </div>
      {!active ? (
        <div className="empty">
          <div className="empty-symbol">↔</div>
          <h3>Start with the boundary cases</h3>
          <p>
            Select implementations and run an evaluation.
            <br />
            Add the bug demo to see a real failing comparison.
          </p>
          <div className="empty-tags">
            <span>Independent oracle</span>
            <span>Saved evidence</span>
            <span>Review notes</span>
          </div>
        </div>
      ) : (
        <>
          <p className="muted">
            {active.suite} suite ·{" "}
            {new Date(active.created_at).toLocaleString()}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Implementation</th>
                  <th>Result</th>
                  <th>Cases</th>
                  <th>Elapsed</th>
                </tr>
              </thead>
              <tbody>
                {active.results.map((result) => (
                  <tr
                    key={result.language}
                    className={language === result.language ? "chosen" : ""}
                  >
                    <td>
                      <button
                        className="table-link"
                        onClick={() => setLanguage(result.language)}
                        aria-pressed={language === result.language}
                      >
                        {names[result.language]}
                      </button>
                    </td>
                    <td>
                      <Status value={result.status} />
                    </td>
                    <td>
                      {result.passed}/{result.total}
                    </td>
                    <td>
                      {result.duration_ms === null
                        ? "—"
                        : `${Math.round(result.duration_ms)} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Elapsed time includes process startup. These measurements are
            diagnostics, not a language performance ranking.
          </p>
          {currentResult && (
            <ResultPanel
              key={`${active.id}-${language}`}
              result={currentResult}
            />
          )}
        </>
      )}
    </section>
  );
}
