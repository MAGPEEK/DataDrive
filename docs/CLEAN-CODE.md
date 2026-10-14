# Clean-Code-Regeln

- Sprechende Namen; Funktionen tun eine Sache, max. ~20 Zeilen, max. 3 Parameter.
- Zyklomatische Komplexität ≤ 10 (Linter erzwingt).
- Schichten: domain → application → adapters. Keine Importe nach außen.
- Keine Kommentare, die Code wiederholen; Kommentare erklären das Warum.
- Typisierte Fehler/Result statt stiller Catches.
- TDD: Test zuerst, Abnahmetests aus `docs/spec/features.md`.
- TypeScript strict, ESLint + Prettier; Rust: clippy + rustfmt.
- Conventional Commits, kleine PRs, CI bei jedem Push (Lint, Typen, Tests).
- Code und Bezeichner Englisch, Doku Deutsch.
- Funktionen: max. 30 Zeilen und 3 Parameter (mehr Daten als Objekt). React-Komponenten (`apps/web/**/*.tsx`) dürfen wegen Markup bis 80 Zeilen lang sein, Komplexität bleibt ≤ 10.
- Fachlogik (domain, application) kennt weder Fastify, Postgres noch React.
