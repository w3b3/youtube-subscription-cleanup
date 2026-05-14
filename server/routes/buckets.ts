import { Router } from "express";
import { db } from "../db.js";

export const bucketsRouter = Router();

bucketsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.name, b.position, b.created_at,
              (SELECT COUNT(*) FROM channel c WHERE c.bucket_id = b.id) AS channel_count,
              (SELECT COUNT(*) FROM channel c WHERE c.bucket_id = b.id AND c.status = 'subscribed') AS subscribed_count
       FROM bucket b
       ORDER BY b.position ASC, b.id ASC`
    )
    .all();
  res.json(rows);
});

bucketsRouter.post("/", (req, res) => {
  const name = (req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const maxPos = (db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM bucket").get() as { m: number }).m;
  try {
    const info = db
      .prepare("INSERT INTO bucket (name, position, created_at) VALUES (?, ?, ?)")
      .run(name, maxPos + 1, Date.now());
    res.json({ id: Number(info.lastInsertRowid), name, position: maxPos + 1 });
  } catch (err: any) {
    if (String(err?.message).includes("UNIQUE")) {
      res.status(409).json({ error: "A bucket with that name already exists" });
      return;
    }
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

bucketsRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const exists = db.prepare("SELECT 1 FROM bucket WHERE id = ?").get(id);
  if (!exists) {
    res.status(404).json({ error: "Bucket not found" });
    return;
  }
  try {
    db.prepare("UPDATE bucket SET name = ? WHERE id = ?").run(name, id);
    res.json({ ok: true });
  } catch (err: any) {
    if (String(err?.message).includes("UNIQUE")) {
      res.status(409).json({ error: "A bucket with that name already exists" });
      return;
    }
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

bucketsRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT 1 FROM bucket WHERE id = ?").get(id);
  if (!exists) {
    res.status(404).json({ error: "Bucket not found" });
    return;
  }
  db.prepare("DELETE FROM bucket WHERE id = ?").run(id);
  // ON DELETE SET NULL clears bucket_id on channels automatically.
  res.json({ ok: true });
});
