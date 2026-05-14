import { useState } from "react";
import type { Bucket, Channel } from "@shared/types";
import { ChannelTile } from "./ChannelTile";
import { getDroppedChannelId, onDropZoneDragOver, onTileDragStart } from "../dnd";

interface Props {
  bucket: Bucket;
  channels: Channel[];
  onMoveChannel: (channelId: string, bucketId: number | null) => void;
  onRename: () => void;
  onDelete: () => void;
  onUnsubscribeAll: () => void;
}

export function BucketColumn({
  bucket,
  channels,
  onMoveChannel,
  onRename,
  onDelete,
  onUnsubscribeAll,
}: Props) {
  const [over, setOver] = useState(false);
  const subscribed = channels.filter((c) => c.status === "subscribed").length;
  return (
    <section
      className={`bucket${over ? " drop-over" : ""}`}
      onDragOver={(e) => {
        onDropZoneDragOver(e);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = getDroppedChannelId(e);
        if (id) onMoveChannel(id, bucket.id);
      }}
    >
      <header>
        <h3 onDoubleClick={onRename} title="Double-click to rename">
          {bucket.name}
        </h3>
        <span className="muted">
          {subscribed}/{channels.length}
        </span>
      </header>
      <div className="bucket-actions">
        <button
          className="danger"
          disabled={subscribed === 0}
          onClick={onUnsubscribeAll}
          title={subscribed === 0 ? "Nothing to unsubscribe" : ""}
        >
          Unsubscribe all ({subscribed})
        </button>
        <button onClick={onDelete} className="ghost">
          Delete bucket
        </button>
      </div>
      <div className="tile-grid">
        {channels.map((c) => (
          <ChannelTile key={c.channel_id} channel={c} onDragStart={onTileDragStart} />
        ))}
        {channels.length === 0 && <div className="empty">Drop channels here.</div>}
      </div>
    </section>
  );
}
