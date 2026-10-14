CREATE TABLE stars (
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  node_id    text NOT NULL REFERENCES nodes (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);

CREATE INDEX nodes_recent_idx ON nodes (drive_id, modified_at DESC)
  WHERE kind = 'file' AND trashed_at IS NULL;
