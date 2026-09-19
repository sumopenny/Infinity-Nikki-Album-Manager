-- 点赞计数器：单行表，id 固定为 1，count 为累计点赞总数。
-- 应用方式见根目录《D1点赞功能部署教程.md》：wrangler d1 migrations apply wxnn-likes
CREATE TABLE IF NOT EXISTS like_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO like_counter (id, count) VALUES (1, 0);
