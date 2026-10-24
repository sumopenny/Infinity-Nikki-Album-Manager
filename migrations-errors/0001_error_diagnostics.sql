-- 仅供 wxnn-errors 云端数据库执行；不改动点赞和共鸣云同步库。
CREATE TABLE IF NOT EXISTS error_groups (
  fingerprint TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0 CHECK(total_count >= 0),
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  latest_event_id TEXT,
  last_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','ignored')),
  resolved_at INTEGER,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS error_events (
  event_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_name TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT NOT NULL,
  build_id TEXT NOT NULL,
  app_version TEXT NOT NULL,
  request_id TEXT,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TABLE IF NOT EXISTS error_breadcrumbs (
  event_id TEXT NOT NULL REFERENCES error_events(event_id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  PRIMARY KEY(event_id,sequence)
);
CREATE TABLE IF NOT EXISTS error_release_stats (
  build_id TEXT PRIMARY KEY,
  app_version TEXT NOT NULL,
  git_commit TEXT NOT NULL,
  built_at TEXT NOT NULL,
  deployment_env TEXT NOT NULL,
  source_map_artifact TEXT,
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
-- 限流键只保存按日 HMAC；不保存用户 IP、账号或稳定设备标识。
CREATE TABLE IF NOT EXISTS error_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS error_groups_recent ON error_groups(status,last_seen);
CREATE INDEX IF NOT EXISTS error_events_group ON error_events(fingerprint,received_at);
CREATE INDEX IF NOT EXISTS error_events_build ON error_events(build_id,received_at);
CREATE INDEX IF NOT EXISTS error_events_module ON error_events(module,received_at);
CREATE INDEX IF NOT EXISTS error_events_retention ON error_events(received_at);
CREATE INDEX IF NOT EXISTS error_limits_retention ON error_rate_limits(expires_at);
-- 仅在事件实际插入后累计：重试/相同 event_id 不会让计数翻倍。
-- 分组更新、版本观测和日预算与事件属于同一条 SQL 的原子事务。
CREATE TRIGGER IF NOT EXISTS error_event_insert AFTER INSERT ON error_events BEGIN
  INSERT INTO error_groups(fingerprint,module,action,error_type,error_code,message,total_count,first_seen,last_seen,latest_event_id,last_version)
  VALUES(NEW.fingerprint,NEW.module,NEW.action,NEW.error_type,NEW.error_code,NEW.message,1,NEW.received_at,NEW.received_at,NEW.event_id,NEW.app_version)
  ON CONFLICT(fingerprint) DO UPDATE SET
    total_count=total_count+1,last_seen=NEW.received_at,latest_event_id=NEW.event_id,
    message=NEW.message,last_version=NEW.app_version,
    resolved_at=CASE WHEN status='resolved' THEN NULL ELSE resolved_at END,
    status=CASE WHEN status='resolved' THEN 'open' ELSE status END;
  INSERT INTO error_release_stats(build_id,app_version,git_commit,built_at,deployment_env,first_seen,last_seen)
  VALUES(NEW.build_id,NEW.app_version,json_extract(NEW.payload_json,'$.build.gitCommit'),json_extract(NEW.payload_json,'$.build.builtAt'),json_extract(NEW.payload_json,'$.build.environment'),NEW.received_at,NEW.received_at)
  ON CONFLICT(build_id) DO UPDATE SET last_seen=NEW.received_at;
  INSERT INTO error_rate_limits(key,count,expires_at)
  VALUES('day:' || strftime('%Y-%m-%d',NEW.received_at / 1000,'unixepoch'),1,NEW.received_at+172800000)
  ON CONFLICT(key) DO UPDATE SET count=count+1;
END;
