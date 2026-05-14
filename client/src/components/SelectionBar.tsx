import { useState } from "react";
import type { Bucket } from "@shared/types";

interface Props {
  count: number;
  buckets: Bucket[];
  activeBucketId: number | null;
  onMoveTo: (bucketId: number | null) => void;
  onClear: () => void;
}

export function SelectionBar({ count, buckets, activeBucketId, onMoveTo, onClear }: Props) {
  const [target, setTarget] = useState<string>(
    activeBucketId != null ? String(activeBucketId) : ""
  );
  if (count === 0) return null;

  return (
    <div className="selection-bar">
      <span className="selection-bar-count">{count} selected</span>
      <div className="sel-divider" />
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">— move to —</option>
        <option value="__ungrouped">Ungrouped</option>
        {buckets.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.name}
          </option>
        ))}
      </select>
      <button
        className="primary"
        disabled={!target}
        onClick={() => {
          if (!target) return;
          onMoveTo(target === "__ungrouped" ? null : Number(target));
        }}
      >
        Move
      </button>
      {activeBucketId != null && (
        <button onClick={() => onMoveTo(activeBucketId)}>Active bucket</button>
      )}
      <div className="sel-divider" />
      <button className="ghost" onClick={onClear}>✕</button>
    </div>
  );
}
