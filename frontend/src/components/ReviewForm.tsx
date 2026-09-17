import { type WorkbenchState } from "../useWorkbench";
import { type Run } from "../types";

type Props = Pick<
  WorkbenchState,
  | "active"
  | "saveReview"
  | "verdict"
  | "setVerdict"
  | "note"
  | "setNote"
  | "busy"
  | "role"
>;
export default function ReviewForm({
  active,
  saveReview,
  verdict,
  setVerdict,
  note,
  setNote,
  busy,
  role,
}: Props) {
  if (!active) return null;
  return (
    <section className="panel">
      <span className="eyebrow">03 / REVIEW</span>
      <h2>
        {role === "viewer" ? "Saved assessment" : "Record your assessment"}
      </h2>
      <form onSubmit={saveReview}>
        <fieldset disabled={!!busy || role === "viewer"}>
          <label htmlFor="verdict">Verdict</label>
          <select
            id="verdict"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as Run["verdict"])}
          >
            <option value="unreviewed">Unreviewed</option>
            <option value="approved">Approved</option>
            <option value="needs-work">Needs work</option>
          </select>
          <label htmlFor="note">Review notes</label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Explain the behavior you verified, any failure, and the next change."
            required={verdict !== "unreviewed"}
          />
          <div className="section-line">
            <small className="muted">{note.length}/2000 characters</small>
            <button className="secondary" disabled={!!busy}>
              {busy === "review" ? "Saving…" : "Save review"}
            </button>
          </div>
        </fieldset>
      </form>
      {!!active.reviews?.length && (
        <details className="case">
          <summary>Review history ({active.version} revisions)</summary>
          {active.reviews.map((review) => (
            <div key={review.version} className="case-data">
              <small>
                Revision {review.version} · {review.verdict} ·{" "}
                {new Date(review.created_at).toLocaleString()}
              </small>
              <p>{review.note}</p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
