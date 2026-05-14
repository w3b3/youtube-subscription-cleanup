import type {
  AuthStatus,
  Bucket,
  Channel,
  SyncResult,
  UnsubscribePreview,
  UnsubscribeProgressEvent,
  UnsubscribeSummary,
} from "@shared/types";

async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const resp = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  return (await resp.json()) as T;
}

export const api = {
  authStatus: () => j<AuthStatus>("/api/auth/status"),
  signOut: () => j<{ ok: true }>("/api/auth/signout", { method: "POST" }),
  sync: () => j<SyncResult>("/api/sync", { method: "POST" }),
  listChannels: () => j<Channel[]>("/api/channels"),
  listBuckets: () => j<Bucket[]>("/api/buckets"),
  createBucket: (name: string) =>
    j<{ id: number; name: string }>("/api/buckets", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameBucket: (id: number, name: string) =>
    j<{ ok: true }>(`/api/buckets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteBucket: (id: number) =>
    j<{ ok: true }>(`/api/buckets/${id}`, { method: "DELETE" }),
  moveChannel: (channelId: string, bucketId: number | null) =>
    j<{ ok: true }>(`/api/channels/${encodeURIComponent(channelId)}`, {
      method: "PATCH",
      body: JSON.stringify({ bucket_id: bucketId }),
    }),
  bulkMove: (channelIds: string[], bucketId: number | null) =>
    j<{ ok: true; moved: number }>(`/api/channels/_bulk_move`, {
      method: "POST",
      body: JSON.stringify({ channel_ids: channelIds, bucket_id: bucketId }),
    }),
  unsubscribePreview: (bucketId: number) =>
    j<UnsubscribePreview>(`/api/unsubscribe/${bucketId}/preview`),
};

export function unsubscribeStream(
  bucketId: number,
  onProgress: (e: UnsubscribeProgressEvent) => void,
  onDone: (s: UnsubscribeSummary) => void,
  onError: (msg: string) => void
): () => void {
  const ctrl = new AbortController();
  fetch(`/api/unsubscribe/${bucketId}/execute`, {
    method: "POST",
    signal: ctrl.signal,
  })
    .then(async (resp) => {
      if (!resp.ok || !resp.body) {
        onError(`${resp.status} ${resp.statusText}`);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.done) onDone(payload as UnsubscribeSummary);
          else onProgress(payload as UnsubscribeProgressEvent);
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err.message ?? String(err));
    });
  return () => ctrl.abort();
}
