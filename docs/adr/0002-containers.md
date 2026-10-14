# ADR 0002 – Alles in Containern

Status: angenommen. Datum: 2026-10-14.

## Entscheidung
- **Betrieb:** `compose.yaml` startet `postgres` und `server` (später `web`, `collab`, `blobstore`, `sharesync-peer`).
  Multi-Stage-Dockerfile (`target: server`), Non-Root-Benutzer, Healthcheck auf `/health`.
- **Entwicklung:** `compose.dev.yaml` mit Dienst `dev` (Node 22, pnpm via Corepack). Quellcode als Bind-Mount,
  `node_modules` und pnpm-Store als benannte Volumes (kein Mischen von Windows- und Linux-Binärdateien).
- **Befehle:** `docker compose -f compose.dev.yaml run --rm dev pnpm <install|lint|typecheck|test|build>`.
- **CI:** GitHub Actions führt exakt dieselben Container-Befehle aus.
- **Secrets:** nur über `.env` (ignoriert) oder Docker-Secrets; `.env.example` enthält Platzhalter.
- **Native Clients** (Desktop, Mobile) laufen auf dem Gerät. Gebaut wird, wo möglich, im Container
  (Linux, Android); Windows, macOS und iOS über GitHub-Actions-Runner.

## Konsequenzen
Auf dem Entwicklungsrechner werden nur Docker und Git benötigt. Builds sind reproduzierbar.
Ein Pfad-Fallstrick: `outDir` in `tsconfig` wird relativ zur definierenden Datei aufgelöst und steht daher pro Paket.
