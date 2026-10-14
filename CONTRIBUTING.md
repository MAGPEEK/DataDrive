# Contributing

- Everything runs in containers: `docker compose -f compose.dev.yaml run --rm dev pnpm <command>`.
- Rules: see `docs/CLEAN-CODE.md`. Tests first. Conventional Commits.
- Spec lives in `docs/spec/features.md`; a feature is "implemented" only with a passing test.
- Clean-room: describe observed behaviour only; do not copy code, design, texts or trademarks of other products.
