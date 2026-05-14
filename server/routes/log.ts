import { Router } from "express";
import { db } from "../db.js";

export const logRouter = Router();

logRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const rows = db
    .prepare(
      `SELECT id, channel_id, channel_title_snapshot, bucket_name_snapshot,
              attempted_at, result, error_message
       FROM unsubscribe_log
       ORDER BY attempted_at DESC
       LIMIT ?`
    )
    .all(limit);
  const summary = db
    .prepare(
      `SELECT result, COUNT(*) AS count FROM unsubscribe_log GROUP BY result`
    )
    .all() as Array<{ result: string; count: number }>;
  res.json({ entries: rows, summary });
});
