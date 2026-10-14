ALTER TABLE nodes
  ADD COLUMN size        bigint NOT NULL DEFAULT 0,
  ADD COLUMN modified_at timestamptz,
  ADD COLUMN version_id  text;
UPDATE nodes SET modified_at = created_at;
ALTER TABLE nodes ALTER COLUMN modified_at SET NOT NULL;

CREATE TABLE file_versions (
  id           text PRIMARY KEY,
  node_id      text NOT NULL REFERENCES nodes (id) ON DELETE CASCADE,
  size         bigint NOT NULL,
  block_hashes text[] NOT NULL,
  content_hash text NOT NULL,
  created_at   timestamptz NOT NULL,
  author_id    text NOT NULL REFERENCES users (id)
);
CREATE INDEX file_versions_node_idx ON file_versions (node_id, created_at DESC);
