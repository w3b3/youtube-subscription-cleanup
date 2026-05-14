import { useState } from "react";
import type { Channel } from "@shared/types";
import { ChannelTile } from "./ChannelTile";
import { getDroppedChannelIds, onDropZoneDragOver } from "../dnd";

interface Props {
  channels: Channel[];
  selectedIds: Set<string>;
  onTileClick: (e: React.MouseEvent, channelId: string) => void;
  onTileDragStart: (e: React.DragEvent, channelId: string) => void;
  onMoveMany: (channelIds: string[], bucketId: number | null) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
}

export function UngroupedCanvas({
  channels,
  selectedIds,
  onTileClick,
  onTileDragStart,
  onMoveMany,
  onSelectAllVisible,
  onClearSelection,
}: Props) {
  const [over, setOver] = useState(false);
  const visibleSelected = channels.filter((c) => selectedIds.has(c.channel_id)).length;
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
        const ids = getDroppedChannelIds(e);
        if (ids.length) onMoveMany(ids, null);
      }}
    >
      <header>
        <h2>Ungrouped · {channels.length}</h2>
        <div className="ungrouped-tools">
          <button onClick={onSelectAllVisible} disabled={channels.length === 0}>
            Select all visible
          </button>
          <button
            onClick={onClearSelection}
            disabled={selectedIds.size === 0}
            className="ghost"
          >
            Clear selection
          </button>
          <span className="muted small">
            {visibleSelected} selected on screen · {selectedIds.size} total
          </span>
        </div>
      </header>
      <div className="tile-grid">
        {channels.map((c) => (
          <ChannelTile
            key={c.channel_id}
            channel={c}
            selected={selectedIds.has(c.channel_id)}
            onClick={onTileClick}
            onDragStart={onTileDragStart}
          />
        ))}
        {channels.length === 0 && <div className="empty">Nothing here.</div>}
      </div>
    </section>
  );
}
