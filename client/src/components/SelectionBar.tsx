import { useState } from "react";
import type { Bucket } from "@shared/types";

interface Props {
  count: number;
  buckets: Bucket[];
  activeBucketId: number | null;
  onMoveTo: (bucketId: number | null) => void;
  onClear: () => void;
}

export function SelectionBar({
  count,
  buckets,
  activeBucketId,
  onMoveTo,
  onClear,
}: Props) {
  const [target, setTarget] = useState<string>(
    activeBucketId != null ? String(activeBucketId) : ""
  );
  if (count === 0) return null;
  return (
    <div className="selection-bar">
      <span>
        <strong>{count}</strong> selected
      </span>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">— pick destination —</option>
        <option value="__ungrouped">Ungrouped (remove from bucket)</option>
        {buckets.map((b) => (
          <option key={b.id} value={String(b.id)}>
            → {b.name}
          </option>
        ))}
      </select>
      <button
        className="primary"
        disabled={!target}
        onClick={() => {
          if (!target) return;
          const bid = target === "__ungrouped" ? null : Number(target);
          onMoveTo(bid);
        }}
      >
        Move
      </button>
      {activeBucketId != null && (
        <button
          onClick={() => onMoveTo(activeBucketId)}
          title="Send to active bucket"
        >
          Send to active
        </button>
      )}
      <button className="ghost" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
