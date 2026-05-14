export const DRAG_MIME = "application/x-channel-id";

export function onTileDragStart(e: React.DragEvent, channelId: string) {
  e.dataTransfer.setData(DRAG_MIME, channelId);
  e.dataTransfer.setData("text/plain", channelId);
  e.dataTransfer.effectAllowed = "move";
}

export function onDropZoneDragOver(e: React.DragEvent) {
  if (Array.from(e.dataTransfer.types).includes(DRAG_MIME)) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
}

export function getDroppedChannelId(e: React.DragEvent): string | null {
  const id = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
  return id || null;
}
