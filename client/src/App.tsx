import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthStatus, Bucket, Channel } from "@shared/types";
import { api } from "./api";
import { TopBar } from "./components/TopBar";
import { UngroupedCanvas } from "./components/UngroupedCanvas";
import { UnsubscribeModal } from "./components/UnsubscribeModal";
import { Sidebar } from "./components/Sidebar";
import { SelectionBar } from "./components/SelectionBar";
import { HistoryModal } from "./components/HistoryModal";
import { setDragChannelIds } from "./dnd";

const ACTIVE_BUCKET_KEY = "ysc.activeBucketId";

export function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [unsubBucketId, setUnsubBucketId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeBucketId, setActiveBucketIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(ACTIVE_BUCKET_KEY);
    return raw ? Number(raw) : null;
  });
  const lastSelectedRef = useRef<string | null>(null);

  const setActiveBucketId = useCallback((id: number | null) => {
    setActiveBucketIdState(id);
    if (id == null) localStorage.removeItem(ACTIVE_BUCKET_KEY);
    else localStorage.setItem(ACTIVE_BUCKET_KEY, String(id));
  }, []);

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

  // If the active bucket got deleted, clear it.
  useEffect(() => {
    if (activeBucketId != null && !buckets.some((b) => b.id === activeBucketId)) {
      setActiveBucketId(null);
    }
  }, [activeBucketId, buckets, setActiveBucketId]);

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

  const channelsByBucket = useMemo(() => {
    const m = new Map<number, Channel[]>();
    for (const b of buckets) m.set(b.id, []);
    const ungrouped: Channel[] = [];
    for (const c of channels) {
      if (c.bucket_id != null && m.has(c.bucket_id)) m.get(c.bucket_id)!.push(c);
      else if (c.bucket_id == null) ungrouped.push(c);
    }
    return { byBucket: m, ungrouped };
  }, [channels, buckets]);

  const filterFn = useCallback(
    (c: Channel) => {
      if (!search.trim()) return true;
      return c.title.toLowerCase().includes(search.trim().toLowerCase());
    },
    [search]
  );

  const visibleUngrouped = useMemo(
    () => channelsByBucket.ungrouped.filter(filterFn),
    [channelsByBucket.ungrouped, filterFn]
  );

  const applyMove = useCallback(
    async (ids: string[], bucketId: number | null) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setChannels((prev) =>
        prev.map((c) => (idSet.has(c.channel_id) ? { ...c, bucket_id: bucketId } : c))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      try {
        if (ids.length === 1) await api.moveChannel(ids[0], bucketId);
        else await api.bulkMove(ids, bucketId);
      } catch {
        await refreshAll();
      }
    },
    [refreshAll]
  );

  const onTileClick = useCallback(
    (e: React.MouseEvent, channelId: string) => {
      // Cmd/Ctrl+click → send straight to active bucket (single-channel shortcut).
      if ((e.metaKey || e.ctrlKey) && activeBucketId != null) {
        e.preventDefault();
        applyMove([channelId], activeBucketId);
        return;
      }
      // Shift+click → range select within currently visible ungrouped order.
      if (e.shiftKey && lastSelectedRef.current) {
        const ids = visibleUngrouped.map((c) => c.channel_id);
        const from = ids.indexOf(lastSelectedRef.current);
        const to = ids.indexOf(channelId);
        if (from >= 0 && to >= 0) {
          const [a, b] = from < to ? [from, to] : [to, from];
          const range = ids.slice(a, b + 1);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of range) next.add(id);
            return next;
          });
          lastSelectedRef.current = channelId;
          return;
        }
      }
      // Plain click → toggle selection.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(channelId)) next.delete(channelId);
        else next.add(channelId);
        return next;
      });
      lastSelectedRef.current = channelId;
    },
    [activeBucketId, applyMove, visibleUngrouped]
  );

  // When a tile is being dragged, attach the whole selection if the dragged tile is part of it.
  const onTileDragStart = useCallback(
    (e: React.DragEvent, channelId: string) => {
      const ids = selectedIds.has(channelId) ? Array.from(selectedIds) : [channelId];
      setDragChannelIds(e, ids);
    },
    [selectedIds]
  );

  // Override the export so children calling onTileDragStart use the selection-aware version.
  // (UngroupedCanvas and BucketRow components import onTileDragStart from "../dnd"; we pass it
  // down explicitly via props on the tile component for selection-aware behaviour.)
  // The simplest path: ChannelTile receives onDragStart prop; we pass our selection-aware one.

  const onCreateBucket = useCallback(async () => {
    const name = prompt("New bucket name?");
    if (!name?.trim()) return;
    try {
      const created = await api.createBucket(name.trim());
      await refreshAll();
      setActiveBucketId(created.id);
    } catch (err: any) {
      alert(err.message ?? String(err));
    }
  }, [refreshAll, setActiveBucketId]);

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

  if (auth === null) return <div className="loading">Loading…</div>;

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

  const activeBucket = buckets.find((b) => b.id === activeBucketId) ?? null;

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
        activeBucketName={activeBucket?.name ?? null}
      />

      <div className="board">
        <div className="main-pane">
          <UngroupedCanvas
            channels={visibleUngrouped}
            selectedIds={selectedIds}
            onTileClick={onTileClick}
            onTileDragStart={onTileDragStart}
            onMoveMany={applyMove}
            onSelectAllVisible={() =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const c of visibleUngrouped) next.add(c.channel_id);
                return next;
              })
            }
            onClearSelection={() => setSelectedIds(new Set())}
          />
        </div>

        <Sidebar
          buckets={buckets}
          channelsByBucket={channelsByBucket.byBucket}
          activeBucketId={activeBucketId}
          onSetActive={setActiveBucketId}
          onCreateBucket={onCreateBucket}
          onRenameBucket={onRenameBucket}
          onDeleteBucket={onDeleteBucket}
          onUnsubscribeBucket={(id) => setUnsubBucketId(id)}
          onMoveMany={applyMove}
          onRemoveChannel={(id) => applyMove([id], null)}
          onShowHistory={() => setHistoryOpen(true)}
        />
      </div>

      <SelectionBar
        count={selectedIds.size}
        buckets={buckets}
        activeBucketId={activeBucketId}
        onMoveTo={(bid) => applyMove(Array.from(selectedIds), bid)}
        onClear={() => setSelectedIds(new Set())}
      />

      {unsubBucketId != null && (
        <UnsubscribeModal
          bucketId={unsubBucketId}
          onClose={async () => {
            setUnsubBucketId(null);
            await refreshAll();
          }}
        />
      )}

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
