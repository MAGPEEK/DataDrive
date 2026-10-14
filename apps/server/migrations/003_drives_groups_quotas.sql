CREATE TABLE drives (
  id                 text PRIMARY KEY,
  kind               text NOT NULL CHECK (kind IN ('personal', 'team')),
  name               text NOT NULL,
  quota_bytes        bigint CHECK (quota_bytes IS NULL OR quota_bytes >= 0),
  restrict_downloads boolean NOT NULL DEFAULT false,
  watermark          boolean NOT NULL DEFAULT false,
  file_locking       boolean NOT NULL DEFAULT false,
  max_versions       integer NOT NULL DEFAULT 32 CHECK (max_versions BETWEEN 1 AND 32),
  created_at         timestamptz NOT NULL
);

-- Every existing user already owns a personal drive with the same id.
INSERT INTO drives (id, kind, name, created_at)
SELECT id, 'personal', username, created_at FROM users;

ALTER TABLE nodes DROP CONSTRAINT nodes_owner_id_fkey;
ALTER TABLE nodes RENAME COLUMN owner_id TO drive_id;
ALTER TABLE nodes
  ADD CONSTRAINT nodes_drive_id_fkey FOREIGN KEY (drive_id) REFERENCES drives (id) ON DELETE CASCADE;

CREATE TABLE groups (
  id         text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE group_members (
  group_id text NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members (user_id);

CREATE TABLE drive_members (
  drive_id     text NOT NULL REFERENCES drives (id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('user', 'group')),
  subject_id   text NOT NULL,
  role         text NOT NULL CHECK (role IN ('viewer', 'editor', 'manager')),
  PRIMARY KEY (drive_id, subject_type, subject_id)
);
CREATE INDEX drive_members_subject_idx ON drive_members (subject_type, subject_id);
