import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { authRouter } from "./routes/auth.js";
import { syncRouter } from "./routes/sync.js";
import { channelsRouter } from "./routes/channels.js";
import { bucketsRouter } from "./routes/buckets.js";
import { unsubscribeRouter } from "./routes/unsubscribe.js";
import { exportRouter } from "./routes/export.js";
import { logRouter } from "./routes/log.js";
import { db } from "./db.js";
import { quotaUsedToday, DAILY_QUOTA_BUDGET, nextPtMidnightMs } from "./quota.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT ?? 8787);
const IS_DEV = process.env.NODE_ENV !== "production";

async function main() {
  const app = express();
  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/sync", syncRouter);
  app.use("/api/channels", channelsRouter);
  app.use("/api/buckets", bucketsRouter);
  app.use("/api/unsubscribe", unsubscribeRouter);
  app.use("/api/export", exportRouter);
  app.use("/api/log", logRouter);

  app.get("/api/meta", (_req, res) => {
    res.json({
      quota_used_today: quotaUsedToday(),
      quota_budget: DAILY_QUOTA_BUDGET,
      quota_resets_at: new Date(nextPtMidnightMs()).toISOString(),
      server_time: new Date().toISOString(),
    });
  });

  if (IS_DEV) {
    const vite = await createViteServer({
      root: path.join(ROOT, "client"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(ROOT, "client", "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  // Touch db to run migrations before listening.
  void db;

  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}`);
    if (!fs.existsSync(path.join(ROOT, ".env"))) {
      console.warn("[server] WARNING: no .env file found — copy .env.example to .env and fill in Google OAuth credentials.");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
