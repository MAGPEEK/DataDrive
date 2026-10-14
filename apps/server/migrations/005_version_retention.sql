ALTER TABLE drives
  ADD COLUMN version_policy text NOT NULL DEFAULT 'fifo' CHECK (version_policy IN ('fifo', 'intelligent')),
  ADD COLUMN retention_days integer CHECK (retention_days IS NULL OR retention_days > 0);

CREATE INDEX file_versions_block_idx ON file_versions USING gin (block_hashes);
