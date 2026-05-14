import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      google_sub TEXT NOT NULL,
      email TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token TEXT,
      access_token_expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bucket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel (
      channel_id TEXT PRIMARY KEY,
      subscription_id TEXT,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      status TEXT NOT NULL DEFAULT 'subscribed',
      bucket_id INTEGER REFERENCES bucket(id) ON DELETE SET NULL,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      unsubscribed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_channel_bucket ON channel(bucket_id);
    CREATE INDEX IF NOT EXISTS idx_channel_status ON channel(status);

    CREATE TABLE IF NOT EXISTS unsubscribe_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_title_snapshot TEXT NOT NULL,
      bucket_name_snapshot TEXT,
      attempted_at INTEGER NOT NULL,
      result TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Additive migrations for existing databases.
  const cols = db
    .prepare("PRAGMA table_info(unsubscribe_log)")
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "error_message")) {
    db.exec("ALTER TABLE unsubscribe_log ADD COLUMN error_message TEXT");
  }
}
