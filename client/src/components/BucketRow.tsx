import { useState } from "react";
import type { Bucket, Channel } from "@shared/types";
import { getDroppedChannelIds, onDropZoneDragOver } from "../dnd";

interface Props {
  bucket: Bucket;
  channels: Channel[];
  active: boolean;
  onSetActive: () => void;
  onRename: () => void;
  onDelete: () => void;
  onUnsubscribe: () => void;
  onMoveMany: (channelIds: string[], bucketId: number | null) => void;
  onRemoveChannel: (channelId: string) => void;
}

export function BucketRow({
  bucket,
  channels,
  active,
  onSetActive,
  onRename,
  onDelete,
  onUnsubscribe,
  onMoveMany,
  onRemoveChannel,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [over, setOver] = useState(false);
  const subscribed = channels.filter((c) => c.status === "subscribed").length;
  return (
    <div
      className={`bucket-row${active ? " active" : ""}${over ? " drop-over" : ""}`}
      onDragOver={(e) => {
        onDropZoneDragOver(e);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const ids = getDroppedChannelIds(e);
        if (ids.length) onMoveMany(ids, bucket.id);
      }}
    >
      <div className="bucket-row-head">
        <button
          className="bucket-toggle"
          onClick={() => setExpanded((x) => !x)}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          className={`bucket-name${active ? " active" : ""}`}
          onClick={onSetActive}
          title="Click to set as active target (cmd-click on tiles sends them here)"
        >
          {bucket.name}
        </button>
        <span className="muted small bucket-count">
          {subscribed}/{channels.length}
        </span>
      </div>
      <div className="bucket-row-actions">
        <button
          className="danger small"
          disabled={subscribed === 0}
          onClick={onUnsubscribe}
          title={subscribed === 0 ? "Nothing to unsubscribe" : ""}
        >
          Unsubscribe ({subscribed})
        </button>
        <button className="ghost small" onClick={onRename}>
          Rename
        </button>
        <button className="ghost small" onClick={onDelete}>
          Delete
        </button>
      </div>
      {expanded && (
        <ul className="bucket-row-list">
          {channels.length === 0 && <li className="empty small">Empty.</li>}
          {channels.map((c) => (
            <li key={c.channel_id} className={c.status === "unsubscribed" ? "unsub" : ""}>
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="row-thumb-placeholder" />
              )}
              <span className="row-title" title={c.title}>
                {c.title}
              </span>
              <button
                className="row-remove"
                onClick={() => onRemoveChannel(c.channel_id)}
                title="Remove from bucket"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
