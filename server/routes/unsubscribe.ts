import { Router } from "express";
import { db } from "../db.js";
import { getAuthedClient } from "../oauth.js";
import { deleteSubscription } from "../youtube.js";
import { QUOTA_COST, quotaRemainingEstimate } from "../quota.js";

export const unsubscribeRouter = Router();

interface ChannelRow {
  channel_id: string;
  subscription_id: string | null;
  title: string;
  thumbnail_url: string | null;
}

function bucketSubscribedChannels(bucketId: number): ChannelRow[] {
  return db
    .prepare(
      `SELECT channel_id, subscription_id, title, thumbnail_url
       FROM channel
       WHERE bucket_id = ? AND status = 'subscribed'
       ORDER BY title COLLATE NOCASE ASC`
    )
    .all(bucketId) as ChannelRow[];
}

unsubscribeRouter.get("/:id/preview", (req, res) => {
  const id = Number(req.params.id);
  const bucket = db.prepare("SELECT id, name FROM bucket WHERE id = ?").get(id) as
    | { id: number; name: string }
    | undefined;
  if (!bucket) {
    res.status(404).json({ error: "Bucket not found" });
    return;
  }
  const channels = bucketSubscribedChannels(id);
  res.json({
    bucket_id: bucket.id,
    bucket_name: bucket.name,
    channels,
    estimated_quota_units: channels.length * QUOTA_COST.subscriptionsDelete,
    daily_quota_remaining_estimate: quotaRemainingEstimate(),
  });
});

unsubscribeRouter.post("/:id/execute", async (req, res) => {
  const id = Number(req.params.id);
  const bucket = db.prepare("SELECT id, name FROM bucket WHERE id = ?").get(id) as
    | { id: number; name: string }
    | undefined;
  if (!bucket) {
    res.status(404).json({ error: "Bucket not found" });
    return;
  }
  let auth;
  try {
    auth = await getAuthedClient();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const channels = bucketSubscribedChannels(id);

  const markUnsub = db.prepare(
    `UPDATE channel SET status = 'unsubscribed', unsubscribed_at = ?, subscription_id = NULL
     WHERE channel_id = ?`
  );
  const logInsert = db.prepare(
    `INSERT INTO unsubscribe_log (channel_id, channel_title_snapshot, bucket_name_snapshot, attempted_at, result, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let success = 0;
  let stale = 0;
  let errors = 0;
  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  for (const ch of channels) {
    if (aborted) break;
    if (quotaRemainingEstimate() < QUOTA_COST.subscriptionsDelete) {
      const msg = "Daily quota budget exhausted. Try again tomorrow.";
      logInsert.run(ch.channel_id, ch.title, bucket.name, Date.now(), "error", msg);
      send({
        channel_id: ch.channel_id,
        title: ch.title,
        result: "error",
        error: msg,
      });
      errors++;
      break;
    }
    if (!ch.subscription_id) {
      // Already unsubscribed locally (shouldn't happen — filtered above) — skip.
      continue;
    }
    const { outcome, error } = await deleteSubscription(auth, ch.subscription_id);
    const now = Date.now();
    if (outcome === "success" || outcome === "stale_404") {
      markUnsub.run(now, ch.channel_id);
      logInsert.run(ch.channel_id, ch.title, bucket.name, now, outcome, null);
      if (outcome === "success") success++;
      else stale++;
      send({ channel_id: ch.channel_id, title: ch.title, result: outcome });
    } else {
      logInsert.run(ch.channel_id, ch.title, bucket.name, now, "error", error ?? null);
      errors++;
      send({ channel_id: ch.channel_id, title: ch.title, result: "error", error });
    }
  }

  send({ done: true, total: channels.length, success, stale_404: stale, error: errors });
  res.end();
});
