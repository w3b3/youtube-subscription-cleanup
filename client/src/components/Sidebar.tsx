import type { Bucket, Channel } from "@shared/types";
import { BucketRow } from "./BucketRow";

interface Props {
  buckets: Bucket[];
  channelsByBucket: Map<number, Channel[]>;
  activeBucketId: number | null;
  onSetActive: (id: number | null) => void;
  onCreateBucket: () => void;
  onRenameBucket: (id: number, currentName: string) => void;
  onDeleteBucket: (id: number, name: string) => void;
  onUnsubscribeBucket: (id: number) => void;
  onMoveMany: (channelIds: string[], bucketId: number | null) => void;
  onRemoveChannel: (channelId: string) => void;
  onShowHistory: () => void;
}

export function Sidebar({
  buckets,
  channelsByBucket,
  activeBucketId,
  onSetActive,
  onCreateBucket,
  onRenameBucket,
  onDeleteBucket,
  onUnsubscribeBucket,
  onMoveMany,
  onRemoveChannel,
  onShowHistory,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <strong>Buckets</strong>
        <button onClick={onCreateBucket}>+ New</button>
      </div>
      <div className="sidebar-body">
        {buckets.length === 0 && (
          <div className="empty small">No buckets yet. Create one to start sorting.</div>
        )}
        {buckets.map((b) => (
          <BucketRow
            key={b.id}
            bucket={b}
            channels={channelsByBucket.get(b.id) ?? []}
            active={activeBucketId === b.id}
            onSetActive={() => onSetActive(activeBucketId === b.id ? null : b.id)}
            onRename={() => onRenameBucket(b.id, b.name)}
            onDelete={() => onDeleteBucket(b.id, b.name)}
            onUnsubscribe={() => onUnsubscribeBucket(b.id)}
            onMoveMany={onMoveMany}
            onRemoveChannel={onRemoveChannel}
          />
        ))}
      </div>
      <div className="sidebar-footer muted small">
        <div className="export-links">
          <a href="/api/export/all.csv" download>Export all (CSV)</a>
          <span className="muted"> · </span>
          <a href="/api/export/all.json" download>Export all (JSON)</a>
          <span className="muted"> · </span>
          <button className="linklike" onClick={onShowHistory}>View history</button>
        </div>
        <div className="tip">
          Tip: click a tile to select. Shift-click for ranges. Cmd-click to send to active bucket.
        </div>
      </div>
    </aside>
  );
}
