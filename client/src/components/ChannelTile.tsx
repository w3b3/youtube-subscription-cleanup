import type { Channel } from "@shared/types";

interface Props {
  channel: Channel;
  onDragStart: (e: React.DragEvent, channelId: string) => void;
}

export function ChannelTile({ channel, onDragStart }: Props) {
  const disabled = channel.status === "unsubscribed";
  return (
    <div
      className={`tile${disabled ? " disabled" : ""}`}
      draggable={!disabled}
      onDragStart={(e) => !disabled && onDragStart(e, channel.channel_id)}
      title={channel.title}
    >
      {channel.thumbnail_url ? (
        <img src={channel.thumbnail_url} alt="" loading="lazy" />
      ) : (
        <div className="tile-thumb-placeholder" />
      )}
      <div className="tile-title">{channel.title}</div>
      {disabled && <div className="tile-badge">unsubscribed</div>}
    </div>
  );
}
