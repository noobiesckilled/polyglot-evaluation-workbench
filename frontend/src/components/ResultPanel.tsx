import { useState } from "react";
import { names, type Result } from "../types";

export default function ResultPanel({ result }: { result: Result }) {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [limit, setLimit] = useState(10);
  const cases = result.cases?.filter((c) => !failuresOnly || !c.passed) || [];
  return (
    <section className="case-panel">
      <div className="section-line">
        <h3>{names[result.language]} case results</h3>
        <label className="inline">
          <input
            type="checkbox"
            checked={failuresOnly}
            onChange={(e) => {
              setFailuresOnly(e.target.checked);
              setLimit(10);
            }}
          />{" "}
          Failures only
        </label>
      </div>
      {result.error && (
        <p role="alert" className="error">
          {result.error}
        </p>
      )}
      {!cases.length && !result.error && (
        <p className="muted">No cases match this filter.</p>
      )}
      <p className="muted">
        Showing {Math.min(limit, cases.length)} of {cases.length} matching cases
      </p>
      {cases.slice(0, limit).map((c) => (
        <details key={c.name} className="case">
          <summary>
            <span className={c.passed ? "pass-dot" : "fail-dot"} />
            {c.name}
            <span>{c.passed ? "Passed" : "Failed"}</span>
          </summary>
          <div className="case-data">
            <div>
              <small>INPUT</small>
              <pre>{JSON.stringify(c.input)}</pre>
            </div>
            <div>
              <small>EXPECTED</small>
              <pre>{JSON.stringify(c.expected)}</pre>
            </div>
            <div>
              <small>ACTUAL</small>
              <pre>{JSON.stringify(c.actual)}</pre>
            </div>
          </div>
        </details>
      ))}
      {limit < cases.length && (
        <button
          className="secondary more-cases"
          onClick={() => setLimit((value) => value + 10)}
        >
          Show next {Math.min(10, cases.length - limit)} cases
        </button>
      )}
    </section>
  );
}
