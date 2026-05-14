export const DRAG_MIME = "application/x-channel-ids";

export function setDragChannelIds(e: React.DragEvent, channelIds: string[]) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(channelIds));
  e.dataTransfer.setData("text/plain", channelIds.join("\n"));
  e.dataTransfer.effectAllowed = "move";
}

// Compatibility wrapper for ChannelTile (single-id drag start).
// Kept as default so the tile can pass its own id straight through.
export function onTileDragStart(e: React.DragEvent, channelId: string) {
  setDragChannelIds(e, [channelId]);
}

export function onDropZoneDragOver(e: React.DragEvent) {
  if (Array.from(e.dataTransfer.types).includes(DRAG_MIME)) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
}

export function getDroppedChannelIds(e: React.DragEvent): string[] {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
    } catch {
      /* fall through to text/plain */
    }
  }
  const plain = e.dataTransfer.getData("text/plain");
  return plain ? plain.split("\n").filter(Boolean) : [];
}
