import { Router } from "express";
import { db } from "../db.js";

export const channelsRouter = Router();

channelsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT channel_id, subscription_id, title, thumbnail_url, status, bucket_id,
              first_seen_at, last_seen_at, unsubscribed_at
       FROM channel
       ORDER BY title COLLATE NOCASE ASC`
    )
    .all();
  res.json(rows);
});

channelsRouter.post("/_bulk_move", (req, res) => {
  const body = req.body as { channel_ids?: string[]; bucket_id?: number | null };
  if (!Array.isArray(body.channel_ids) || body.channel_ids.length === 0) {
    res.status(400).json({ error: "channel_ids must be a non-empty array" });
    return;
  }
  if (!("bucket_id" in body)) {
    res.status(400).json({ error: "bucket_id is required (null for ungrouped)" });
    return;
  }
  if (body.bucket_id != null) {
    const ok = db.prepare("SELECT 1 FROM bucket WHERE id = ?").get(body.bucket_id);
    if (!ok) {
      res.status(400).json({ error: "Bucket not found" });
      return;
    }
  }
  const stmt = db.prepare("UPDATE channel SET bucket_id = ? WHERE channel_id = ?");
  const tx = db.transaction((ids: string[]) => {
    let n = 0;
    for (const id of ids) {
      const info = stmt.run(body.bucket_id ?? null, id);
      n += info.changes;
    }
    return n;
  });
  const moved = tx(body.channel_ids);
  res.json({ ok: true, moved });
});

channelsRouter.patch("/:channelId", (req, res) => {
  const { channelId } = req.params;
  const body = req.body as { bucket_id?: number | null };
  if (!("bucket_id" in body)) {
    res.status(400).json({ error: "bucket_id is required" });
    return;
  }
  const exists = db.prepare("SELECT 1 FROM channel WHERE channel_id = ?").get(channelId);
  if (!exists) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  if (body.bucket_id != null) {
    const ok = db.prepare("SELECT 1 FROM bucket WHERE id = ?").get(body.bucket_id);
    if (!ok) {
      res.status(400).json({ error: "Bucket not found" });
      return;
    }
  }
  db.prepare("UPDATE channel SET bucket_id = ? WHERE channel_id = ?").run(
    body.bucket_id ?? null,
    channelId
  );
  res.json({ ok: true });
});
