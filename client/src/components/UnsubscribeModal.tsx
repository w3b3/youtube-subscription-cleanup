import { useEffect, useRef, useState } from "react";
import type { UnsubscribePreview, UnsubscribeProgressEvent, UnsubscribeSummary } from "@shared/types";
import { api, unsubscribeStream } from "../api";

interface Props {
  bucketId: number;
  onClose: () => void;
}

type Phase = "loading" | "preview" | "running" | "done" | "error";

export function UnsubscribeModal({ bucketId, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<UnsubscribePreview | null>(null);
  const [progress, setProgress] = useState<UnsubscribeProgressEvent[]>([]);
  const [summary, setSummary] = useState<UnsubscribeSummary | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api
      .unsubscribePreview(bucketId)
      .then((p) => {
        setPreview(p);
        setPhase("preview");
      })
      .catch((err) => {
        setErrMsg(err.message ?? String(err));
        setPhase("error");
      });
  }, [bucketId]);

  useEffect(() => () => cancelRef.current?.(), []);

  const start = () => {
    setPhase("running");
    cancelRef.current = unsubscribeStream(
      bucketId,
      (e) => setProgress((prev) => [...prev, e]),
      (s) => {
        setSummary(s);
        setPhase("done");
      },
      (m) => {
        setErrMsg(m);
        setPhase("error");
      }
    );
  };

  return (
    <div className="modal-backdrop" onClick={phase === "running" ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {phase === "loading" && <p>Loading preview…</p>}

        {phase === "preview" && preview && (
          <>
            <h2>Unsubscribe all in "{preview.bucket_name}"</h2>
            <p>
              This will unsubscribe <strong>{preview.channels.length}</strong> channel(s) on
              YouTube. Estimated cost: <strong>{preview.estimated_quota_units}</strong> quota
              units. Daily budget remaining (estimate):{" "}
              <strong>{preview.daily_quota_remaining_estimate}</strong>.
            </p>
            {preview.estimated_quota_units > preview.daily_quota_remaining_estimate && (
              <p className="warn">
                ⚠️ Estimated cost exceeds remaining quota. The run will stop partway and resume tomorrow.
              </p>
            )}
            <ul className="preview-list">
              {preview.channels.map((c) => (
                <li key={c.channel_id}>{c.title}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button className="danger" onClick={start} disabled={preview.channels.length === 0}>
                Confirm unsubscribe
              </button>
            </div>
          </>
        )}

        {phase === "running" && preview && (
          <>
            <h2>Unsubscribing…</h2>
            <p>
              {progress.length} / {preview.channels.length}
            </p>
            <progress max={preview.channels.length} value={progress.length} />
            <ul className="progress-list">
              {progress.slice(-15).map((p) => (
                <li key={p.channel_id} className={p.result}>
                  {p.result === "success" && "✓"}
                  {p.result === "stale_404" && "○"}
                  {p.result === "error" && "✗"} {p.title}
                  {p.error && <span className="muted small"> — {p.error}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {phase === "done" && summary && (
          <>
            <h2>Done</h2>
            <p>
              {summary.success} succeeded, {summary.stale_404} already gone, {summary.error}{" "}
              error(s).
            </p>
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <h2>Error</h2>
            <p>{errMsg}</p>
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
