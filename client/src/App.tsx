import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthStatus, Bucket, Channel } from "@shared/types";
import { api } from "./api";
import { TopBar } from "./components/TopBar";
import { BucketColumn } from "./components/BucketColumn";
import { UngroupedCanvas } from "./components/UngroupedCanvas";
import { UnsubscribeModal } from "./components/UnsubscribeModal";

export function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [unsubBucketId, setUnsubBucketId] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [a, ch, bk] = await Promise.all([
      api.authStatus(),
      api.listChannels().catch(() => []),
      api.listBuckets().catch(() => []),
    ]);
    setAuth(a);
    setChannels(ch);
    setBuckets(bk);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.sync();
      setLastSync(
        `Imported ${result.total_subscribed} (added ${result.added}, updated ${result.updated}, externally unsubscribed ${result.unsubscribed_externally})`
      );
      await refreshAll();
    } catch (err: any) {
      setLastSync(`Sync failed: ${err.message ?? err}`);
    } finally {
      setSyncing(false);
    }
  }, [refreshAll]);

  const onMoveChannel = useCallback(
    async (channelId: string, bucketId: number | null) => {
      setChannels((prev) =>
        prev.map((c) => (c.channel_id === channelId ? { ...c, bucket_id: bucketId } : c))
      );
      try {
        await api.moveChannel(channelId, bucketId);
      } catch {
        await refreshAll();
      }
    },
    [refreshAll]
  );

  const onCreateBucket = useCallback(async () => {
    const name = prompt("New bucket name?");
    if (!name?.trim()) return;
    try {
      await api.createBucket(name.trim());
      await refreshAll();
    } catch (err: any) {
      alert(err.message ?? String(err));
    }
  }, [refreshAll]);

  const onRenameBucket = useCallback(
    async (id: number, currentName: string) => {
      const name = prompt("Rename bucket", currentName);
      if (!name?.trim() || name === currentName) return;
      try {
        await api.renameBucket(id, name.trim());
        await refreshAll();
      } catch (err: any) {
        alert(err.message ?? String(err));
      }
    },
    [refreshAll]
  );

  const onDeleteBucket = useCallback(
    async (id: number, name: string) => {
      if (!confirm(`Delete bucket "${name}"? Channels in it move back to Ungrouped.`)) return;
      await api.deleteBucket(id);
      await refreshAll();
    },
    [refreshAll]
  );

  const channelsByBucket = useMemo(() => {
    const m = new Map<number | "none", Channel[]>();
    m.set("none", []);
    for (const b of buckets) m.set(b.id, []);
    for (const c of channels) {
      const key = c.bucket_id ?? "none";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  }, [channels, buckets]);

  const filterFn = useCallback(
    (c: Channel) => {
      if (!search.trim()) return true;
      return c.title.toLowerCase().includes(search.trim().toLowerCase());
    },
    [search]
  );

  if (auth === null) {
    return <div className="loading">Loading…</div>;
  }

  if (!auth.authenticated) {
    return (
      <div className="signin">
        <h1>YouTube Subscription Cleanup</h1>
        <p>Local tool to group and bulk-unsubscribe YouTube channels.</p>
        <a className="btn primary" href="/api/auth/start">
          Sign in with Google
        </a>
        <p className="hint">
          The first time, Google will warn "this app isn't verified" — that's expected for a
          personal unverified app. Continue past it.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        email={auth.email ?? ""}
        onSignOut={async () => {
          await api.signOut();
          await refreshAll();
        }}
        onSync={doSync}
        syncing={syncing}
        lastSync={lastSync}
        search={search}
        onSearch={setSearch}
        onCreateBucket={onCreateBucket}
        channelTotal={channels.length}
      />

      <div className="board">
        <UngroupedCanvas
          channels={(channelsByBucket.get("none") ?? []).filter(filterFn)}
          onMoveChannel={onMoveChannel}
        />
        <div className="buckets-row">
          {buckets.map((b) => (
            <BucketColumn
              key={b.id}
              bucket={b}
              channels={(channelsByBucket.get(b.id) ?? []).filter(filterFn)}
              onMoveChannel={onMoveChannel}
              onRename={() => onRenameBucket(b.id, b.name)}
              onDelete={() => onDeleteBucket(b.id, b.name)}
              onUnsubscribeAll={() => setUnsubBucketId(b.id)}
            />
          ))}
        </div>
      </div>

      {unsubBucketId != null && (
        <UnsubscribeModal
          bucketId={unsubBucketId}
          onClose={async () => {
            setUnsubBucketId(null);
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}
