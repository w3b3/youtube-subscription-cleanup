import { QuotaIndicator } from "./QuotaIndicator";

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
      <div className="topbar-brand">
        <img src="/favicon.svg" alt="" className="topbar-brand-logo" />
        <span className="topbar-brand-name">YT Sub Cleanup</span>
        <span className="topbar-count">{channelTotal}</span>
      </div>

      <div className="topbar-divider" />

      <div className="topbar-mid">
        <input
          type="search"
          placeholder="Search channels…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {activeBucketName && (
          <span className="active-bucket-pill" title="Cmd-click a tile to send it here">
            {activeBucketName}
          </span>
        )}
        {lastSync && <span className="sync-status" title={lastSync}>{lastSync}</span>}
      </div>

      <div className="topbar-right">
        <button onClick={onCreateBucket}>+ Bucket</button>
        <button onClick={onSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync"}
        </button>
        <QuotaIndicator />
        <div className="topbar-divider" />
        <span className="topbar-email">{email}</span>
        <button className="ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}
