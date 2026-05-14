interface Props {
  email: string;
  onSignOut: () => void;
  onSync: () => void;
  syncing: boolean;
  lastSync: string | null;
  search: string;
  onSearch: (v: string) => void;
  onCreateBucket: () => void;
  channelTotal: number;
  activeBucketName: string | null;
}

export function TopBar({
  email,
  onSignOut,
  onSync,
  syncing,
  lastSync,
  search,
  onSearch,
  onCreateBucket,
  channelTotal,
  activeBucketName,
}: Props) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <strong>YouTube Subscription Cleanup</strong>
        <span className="muted">· {channelTotal} channels</span>
        {activeBucketName && (
          <span className="active-bucket-pill" title="Cmd-click a tile to send it here">
            Active: {activeBucketName}
          </span>
        )}
      </div>
      <div className="topbar-mid">
        <input
          type="search"
          placeholder="Search channels…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button onClick={onCreateBucket}>+ Bucket</button>
        <button onClick={onSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync from YouTube"}
        </button>
        {lastSync && <span className="muted small">{lastSync}</span>}
      </div>
      <div className="topbar-right">
        <span className="muted">{email}</span>
        <button onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}
