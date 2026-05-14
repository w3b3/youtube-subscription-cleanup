import { Router } from "express";
import { db } from "../db.js";
import { getAuthedClient } from "../oauth.js";
import { listAllSubscriptions } from "../youtube.js";

export const syncRouter = Router();

syncRouter.post("/", async (_req, res) => {
  let auth;
  try {
    auth = await getAuthedClient();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const remote = await listAllSubscriptions(auth);
    const now = Date.now();

    const upsert = db.prepare(`
      INSERT INTO channel (channel_id, subscription_id, title, thumbnail_url, status, first_seen_at, last_seen_at)
      VALUES (@channel_id, @subscription_id, @title, @thumbnail_url, 'subscribed', @now, @now)
      ON CONFLICT(channel_id) DO UPDATE SET
        subscription_id = excluded.subscription_id,
        title = excluded.title,
        thumbnail_url = excluded.thumbnail_url,
        status = 'subscribed',
        last_seen_at = excluded.last_seen_at,
        unsubscribed_at = NULL
    `);

    const seenIds = new Set(remote.map((r) => r.channel_id));

    let added = 0;
    let updated = 0;
    const existsStmt = db.prepare("SELECT 1 FROM channel WHERE channel_id = ?");
    const tx = db.transaction(() => {
      for (const r of remote) {
        const existed = !!existsStmt.get(r.channel_id);
        upsert.run({
          channel_id: r.channel_id,
          subscription_id: r.subscription_id,
          title: r.title,
          thumbnail_url: r.thumbnail_url,
          now,
        });
        if (existed) updated++;
        else added++;
      }
    });
    tx();

    // Mark anything previously subscribed but no longer present as externally unsubscribed.
    const stillSubscribed = db
      .prepare("SELECT channel_id FROM channel WHERE status = 'subscribed'")
      .all() as Array<{ channel_id: string }>;
    const markStale = db.prepare(
      `UPDATE channel SET status = 'unsubscribed', unsubscribed_at = ?, subscription_id = NULL
       WHERE channel_id = ? AND status = 'subscribed'`
    );
    let externallyUnsub = 0;
    for (const row of stillSubscribed) {
      if (!seenIds.has(row.channel_id)) {
        markStale.run(now, row.channel_id);
        externallyUnsub++;
      }
    }

    res.json({
      added,
      updated,
      unsubscribed_externally: externallyUnsub,
      total_subscribed: remote.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
