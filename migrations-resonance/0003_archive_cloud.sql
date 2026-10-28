-- 统一档案操作的持久回执；只在两个模块均满足版本条件的同一事务内生成。
CREATE TABLE cloud_archive_requests (
  user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  digest TEXT NOT NULL,
  result_json TEXT NOT NULL,
  committed INTEGER NOT NULL DEFAULT 0 CHECK(committed IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,id)
);
CREATE INDEX cloud_archive_request_expiry ON cloud_archive_requests(created_at);
