import { Router } from "express";
import { db } from "../db.js";

export const exportRouter = Router();

interface ChannelExportRow {
  bucket: string | null;
  title: string;
  channel_id: string;
  channel_url: string;
  status: string;
  unsubscribed_at: number | null;
  first_seen_at: number;
}

function fetchChannels(bucketId?: number): ChannelExportRow[] {
  const base = `
    SELECT b.name AS bucket, c.title, c.channel_id, c.status,
           c.unsubscribed_at, c.first_seen_at,
           'https://www.youtube.com/channel/' || c.channel_id AS channel_url
    FROM channel c
    LEFT JOIN bucket b ON b.id = c.bucket_id
  `;
  if (bucketId != null) {
    return db.prepare(base + " WHERE c.bucket_id = ? ORDER BY c.title COLLATE NOCASE").all(bucketId) as ChannelExportRow[];
  }
  return db
    .prepare(base + " ORDER BY b.name COLLATE NOCASE, c.title COLLATE NOCASE")
    .all() as ChannelExportRow[];
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: ChannelExportRow[]): string {
  const headers = [
    "bucket",
    "title",
    "channel_id",
    "channel_url",
    "status",
    "unsubscribed_at_iso",
    "first_seen_at_iso",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.bucket ?? "",
        r.title,
        r.channel_id,
        r.channel_url,
        r.status,
        r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : "",
        new Date(r.first_seen_at).toISOString(),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  return lines.join("\n");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "bucket";
}

exportRouter.get("/all.json", (_req, res) => {
  const buckets = db.prepare("SELECT id, name, position, created_at FROM bucket ORDER BY position, id").all();
  const channels = db
    .prepare(
      `SELECT channel_id, subscription_id, title, thumbnail_url, status, bucket_id,
              first_seen_at, last_seen_at, unsubscribed_at
       FROM channel ORDER BY title COLLATE NOCASE`
    )
    .all();
  const log = db
    .prepare(
      `SELECT channel_id, channel_title_snapshot, bucket_name_snapshot, attempted_at, result
       FROM unsubscribe_log ORDER BY attempted_at DESC`
    )
    .all();
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="youtube-subscriptions-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.send(JSON.stringify({ exported_at: new Date().toISOString(), buckets, channels, unsubscribe_log: log }, null, 2));
});

exportRouter.get("/all.csv", (_req, res) => {
  const rows = fetchChannels();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="youtube-subscriptions-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(toCsv(rows));
});

exportRouter.get("/bucket/:id.csv", (req, res) => {
  const id = Number(req.params.id);
  const bucket = db.prepare("SELECT id, name FROM bucket WHERE id = ?").get(id) as
    | { id: number; name: string }
    | undefined;
  if (!bucket) {
    res.status(404).json({ error: "Bucket not found" });
    return;
  }
  const rows = fetchChannels(id);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizeFilename(bucket.name)}-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(toCsv(rows));
});
