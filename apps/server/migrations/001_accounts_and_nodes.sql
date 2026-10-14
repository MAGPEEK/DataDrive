CREATE TABLE users (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'user')),
  totp_secret   text,
  totp_enabled  boolean NOT NULL DEFAULT false,
  disabled      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE nodes (
  id         text PRIMARY KEY,
  owner_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_id  text REFERENCES nodes (id) ON DELETE CASCADE,
  name       text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('file', 'folder')),
  created_at timestamptz NOT NULL,
  trashed_at timestamptz
);
CREATE INDEX nodes_children_idx ON nodes (owner_id, parent_id);
-- Safety net for the domain rule: no two live siblings with the same name (case-insensitive).
CREATE UNIQUE INDEX nodes_live_name_idx
  ON nodes (owner_id, COALESCE(parent_id, ''), lower(name))
  WHERE trashed_at IS NULL;
