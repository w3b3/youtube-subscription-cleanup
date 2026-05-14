import { useEffect, useMemo, useState } from "react";
import type { UnsubscribeLogResponse, UnsubscribeResult } from "@shared/types";
import { api } from "../api";

interface Props {
  onClose: () => void;
}

type Filter = "all" | UnsubscribeResult;

const RESULT_LABEL: Record<UnsubscribeResult, string> = {
  success: "succeeded",
  stale_404: "already gone",
  error: "errored",
};

export function HistoryModal({ onClose }: Props) {
  const [data, setData] = useState<UnsubscribeLogResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api
      .log(500)
      .then(setData)
      .catch((e) => setErr(e.message ?? String(e)));
  }, []);

  const entries = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.entries;
    return data.entries.filter((e) => e.result === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { success: 0, stale_404: 0, error: 0 };
    for (const s of data?.summary ?? []) m[s.result] = s.count;
    return m;
  }, [data]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Unsubscribe history</h2>
        {err && <p className="warn">Failed to load: {err}</p>}
        {!data && !err && <p>Loading…</p>}
        {data && (
          <>
            <div className="history-summary">
              <button
                className={filter === "all" ? "primary small" : "small"}
                onClick={() => setFilter("all")}
              >
                All ({data.entries.length})
              </button>
              <button
                className={filter === "success" ? "primary small" : "small"}
                onClick={() => setFilter("success")}
              >
                Succeeded ({counts.success ?? 0})
              </button>
              <button
                className={filter === "stale_404" ? "primary small" : "small"}
                onClick={() => setFilter("stale_404")}
              >
                Already gone ({counts.stale_404 ?? 0})
              </button>
              <button
                className={filter === "error" ? "primary small" : "small"}
                onClick={() => setFilter("error")}
              >
                Errored ({counts.error ?? 0})
              </button>
            </div>

            <ul className="history-list">
              {entries.length === 0 && <li className="empty small">No entries.</li>}
              {entries.map((e) => (
                <li key={e.id} className={`history-row ${e.result}`}>
                  <span className="when muted small">
                    {new Date(e.attempted_at).toLocaleString()}
                  </span>
                  <span className="result-tag">{RESULT_LABEL[e.result]}</span>
                  <span className="bucket muted small">
                    {e.bucket_name_snapshot ?? "—"}
                  </span>
                  <span className="title" title={e.channel_title_snapshot}>
                    {e.channel_title_snapshot}
                  </span>
                  {e.error_message && (
                    <span className="err small" title={e.error_message}>
                      {e.error_message}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <p className="muted small">
              Showing up to 500 most recent attempts. The full log is in{" "}
              <code>data/app.db</code> in the <code>unsubscribe_log</code> table.
            </p>
          </>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
