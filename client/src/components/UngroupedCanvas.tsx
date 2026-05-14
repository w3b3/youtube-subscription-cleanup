import { useState } from "react";
import type { Channel } from "@shared/types";
import { ChannelTile } from "./ChannelTile";
import { getDroppedChannelId, onDropZoneDragOver, onTileDragStart } from "../dnd";

interface Props {
  channels: Channel[];
  onMoveChannel: (channelId: string, bucketId: number | null) => void;
}

export function UngroupedCanvas({ channels, onMoveChannel }: Props) {
  const [over, setOver] = useState(false);
  return (
    <section
      className={`ungrouped${over ? " drop-over" : ""}`}
      onDragOver={(e) => {
        onDropZoneDragOver(e);
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = getDroppedChannelId(e);
        if (id) onMoveChannel(id, null);
      }}
    >
      <header>
        <h2>Ungrouped</h2>
        <span className="muted">{channels.length}</span>
      </header>
      <div className="tile-grid">
        {channels.map((c) => (
          <ChannelTile key={c.channel_id} channel={c} onDragStart={onTileDragStart} />
        ))}
        {channels.length === 0 && <div className="empty">Nothing here.</div>}
      </div>
    </section>
  );
}
