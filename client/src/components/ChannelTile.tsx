import type { Channel } from "@shared/types";

interface Props {
  channel: Channel;
  selected: boolean;
  onClick: (e: React.MouseEvent, channelId: string) => void;
  onDragStart: (e: React.DragEvent, channelId: string) => void;
}

export function ChannelTile({ channel, selected, onClick, onDragStart }: Props) {
  const disabled = channel.status === "unsubscribed";
  return (
    <div
      className={`tile${disabled ? " disabled" : ""}${selected ? " selected" : ""}`}
      draggable={!disabled}
      onClick={(e) => !disabled && onClick(e, channel.channel_id)}
      onDragStart={(e) => !disabled && onDragStart(e, channel.channel_id)}
      title={channel.title}
    >
      {channel.thumbnail_url ? (
        <img
          src={channel.thumbnail_url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="tile-thumb-placeholder" />
      )}
      <div className="tile-title">{channel.title}</div>
      {disabled && <div className="tile-badge">unsubscribed</div>}
      {selected && <div className="tile-check">✓</div>}
    </div>
  );
}
