-- 共鸣专用 D1，不应用到点赞数据库。每个账户只有一个当前存档指针。
CREATE TABLE cloud_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active_snapshot TEXT,
  last_request TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE cloud_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX cloud_sessions_user ON cloud_sessions(user_id);
CREATE TABLE cloud_snapshots (
  user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  digest TEXT NOT NULL,
  count INTEGER NOT NULL,
  committed_revision INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE cloud_records (
  user_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(user_id, snapshot_id, record_id),
  FOREIGN KEY(user_id, snapshot_id) REFERENCES cloud_snapshots(user_id, id) ON DELETE CASCADE
);
CREATE TABLE cloud_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);
CREATE INDEX cloud_rate_expiry ON cloud_rate_limits(resets_at);
