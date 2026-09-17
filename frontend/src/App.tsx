import { useWorkbench } from "./useWorkbench";
import EvaluationForm from "./components/EvaluationForm";
import RunHistory from "./components/RunHistory";
import EvaluationResults from "./components/EvaluationResults";
import ReviewForm from "./components/ReviewForm";

export default function App() {
  const state = useWorkbench();
  const {
    token,
    setToken,
    draftToken,
    setDraftToken,
    setHistory,
    active,
    setActive,
    busy,
    error,
    setError,
    notice,
    setNotice,
    unlock,
  } = state;

  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Workbench home">
          <span className="brand-icon">W</span>
          <span>
            WORKBENCH<small>POLYGLOT EVALUATION</small>
          </span>
        </a>
        <div className="header-right">
          <span className="private-label">Controlled test environment</span>
          {token && (
            <button
              className="ghost"
              disabled={!!busy}
              onClick={() => {
                setToken("");
                setActive(null);
                setHistory([]);
                setNotice("");
                setError("");
              }}
            >
              Lock session
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <span className="eyebrow">ENGINEERING / EVALUATIONS</span>
            <h1>
              One contract.
              <br />
              <em>Five implementations.</em>
            </h1>
            <p>
              Compare behavior across languages. Inspect the edge cases.
              <br className="desktop-break" /> Keep the evidence behind every
              review.
            </p>
          </div>
          <div className="contract">
            <div className="contract-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="eyebrow">CURRENT CONTRACT</span>
            <strong>Merge closed intervals</strong>
            <code>[[1, 3], [3, 5]] → [[1, 5]]</code>
            <span>Touching boundaries merge. Inputs stay unchanged.</span>
          </div>
        </div>
        {error && (
          <div className="error banner" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice banner" role="status">
            {notice}
          </div>
        )}
        {!token ? (
          <section className="unlock">
            <div>
              <span className="eyebrow">WORKSPACE ACCESS</span>
              <h2>Unlock your workbench</h2>
              <p>
                Enter the access token from your local launcher or deployment
                configuration. It stays in memory for this session.
              </p>
            </div>
            <form onSubmit={unlock}>
              <label htmlFor="token">Access token</label>
              <input
                id="token"
                type="password"
                value={draftToken}
                onChange={(e) => setDraftToken(e.target.value)}
                autoComplete="off"
                required
              />
              <button className="primary" disabled={!!busy}>
                {busy ? "Connecting…" : "Open workspace →"}
              </button>
            </form>
          </section>
        ) : (
          <div className="workspace">
            <aside>
              <EvaluationForm {...state} />
              <RunHistory {...state} />
            </aside>
            <div className="results">
              <EvaluationResults {...state} />
              {active && <ReviewForm {...state} />}
            </div>
          </div>
        )}
        <footer>
          <span>Polyglot Evaluation Workbench</span>
          <span>Correctness first. Evidence retained.</span>
        </footer>
      </main>
    </>
  );
}
