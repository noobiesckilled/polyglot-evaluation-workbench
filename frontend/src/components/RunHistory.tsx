import { type WorkbenchState } from "../useWorkbench";
import Status from "./Status";

type Props = Pick<WorkbenchState, "history" | "busy" | "active" | "openRun">;
export default function RunHistory({ history, busy, active, openRun }: Props) {
  return (
    <section className="panel history">
      <div className="section-line">
        <h2>Recent runs</h2>
        <span className="count">{history.length}</span>
      </div>
      {!history.length && (
        <p className="muted">Your saved runs will appear here.</p>
      )}
      {history.map((run) => (
        <button
          key={run.id}
          disabled={!!busy}
          className={`history-item ${active?.id === run.id ? "active" : ""}`}
          onClick={() => openRun(run.id)}
        >
          <span>
            {run.suite}
            <small>{new Date(run.created_at).toLocaleString()}</small>
          </span>
          <Status value={run.verdict} />
        </button>
      ))}
    </section>
  );
}
