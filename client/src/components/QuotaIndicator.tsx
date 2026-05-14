import { useEffect, useState } from "react";

interface MetaResponse {
  quota_used_today: number;
  quota_budget: number;
  quota_resets_at: string;
  server_time: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}

export function QuotaIndicator() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const fetchMeta = async () => {
      try {
        const resp = await fetch("/api/meta");
        if (!resp.ok) return;
        const data = (await resp.json()) as MetaResponse;
        if (!cancelled) setMeta(data);
      } catch { /* stale display is fine */ }
    };
    fetchMeta();
    const poll = setInterval(fetchMeta, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; clearInterval(poll); clearInterval(tick); };
  }, []);

  if (!meta) return null;

  const used = meta.quota_used_today;
  const budget = meta.quota_budget;
  const pct = Math.min(100, (used / budget) * 100);
  const resetsAt = new Date(meta.quota_resets_at).getTime();
  const remainingMs = resetsAt - now;
  const exhausted = budget - used < 50;

  const tone = exhausted ? "exhausted" : pct > 80 ? "warn" : "ok";

  return (
    <div
      className={`quota-indicator ${tone}`}
      title={`YouTube API quota · resets ${new Date(meta.quota_resets_at).toLocaleString()} PT`}
    >
      <div className="quota-label">
        <span>Quota</span>
        <span className="quota-nums">
          {used.toLocaleString()} / {budget.toLocaleString()}
        </span>
      </div>
      <div className="quota-bar">
        <div className="quota-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="quota-reset">
        {exhausted ? "exhausted · " : ""}resets {formatCountdown(remainingMs)}
      </div>
    </div>
  );
}
