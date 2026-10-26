-- 衣橱共用账号和会话，版本与共鸣独立；只应用到 RESONANCE_DB。
CREATE TABLE cloud_wardrobe_state (
  user_id TEXT PRIMARY KEY REFERENCES cloud_users(id) ON DELETE CASCADE,
  active_snapshot TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  updated_at INTEGER NOT NULL DEFAULT 0,
  last_request TEXT
);
CREATE TABLE cloud_wardrobe_snapshots (
  user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('upload','delete')),
  digest TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  record_count INTEGER NOT NULL CHECK(record_count >= 0),
  entry_count INTEGER NOT NULL,
  owned_count INTEGER NOT NULL,
  unknown_suit_count INTEGER NOT NULL,
  committed_revision INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,id)
);
CREATE INDEX cloud_wardrobe_expiry ON cloud_wardrobe_snapshots(user_id,created_at);
CREATE TABLE cloud_wardrobe_records (
  user_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  record_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(user_id,snapshot_id,record_key),
  FOREIGN KEY(user_id,snapshot_id) REFERENCES cloud_wardrobe_snapshots(user_id,id) ON DELETE CASCADE
);
