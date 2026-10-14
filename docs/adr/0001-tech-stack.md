# ADR 0001 – Tech-Stack

Status: Vorschlag. Datum: 2026-10-14.

## Analyse der Anforderungen
Die Software besteht aus fünf Teilen mit unterschiedlichen Anforderungen:
1. **Server** – viele I/O-Verbindungen, Metadaten, Rechte, Protokolle; stabil und ressourcenschonend.
2. **Sync-Engine im Desktop-Client** – robust, nah am Betriebssystem (Dateisystem-Watcher,
   Platzhalter-Dateien über Windows Cloud Files API / macOS File Provider), geringer Speicherbedarf.
3. **Web-App und Admin-Konsole** – interaktive UI.
4. **Office-Echtzeit-Zusammenarbeit** – konfliktfreie Bearbeitung (CRDT).
5. **Mobile-Apps** (iOS/Android).

Vorhanden auf dieser Maschine: Node 22, Docker, Git. Kein Go, .NET, Python oder Rust.

## Entscheidung
| Teil | Wahl | Begründung |
|---|---|---|
| Sprache Server/Web/Mobile | **TypeScript** (strict) | Eine Sprache, gemeinsame Typen und Protokoll-Pakete, schnelle Iteration |
| Server | **Node 22 + Fastify**, OpenAPI-first | Schnell, schlank, gute Plugin-Struktur |
| Datenbank | **PostgreSQL** (Metadaten, Rechte, Logs); SQLite-Modus für Kleinstinstallationen später | Transaktionen, Volltextsuche, bewährt |
| Dateispeicher | Content-addressed Blockstore (Dateisystem, optional **S3-kompatibel**) | Deduplizierung, Delta-Sync, Versionierung, Hybrid Share |
| Echtzeit | WebSocket (Änderungs-Feed) | Push von Sync-Ereignissen |
| Desktop-Client | **Rust Sync-Core + Tauri** (UI in TypeScript) | OS-nahe Sync-Engine, kleine Binärdatei, Windows/macOS/Linux |
| Web | **React + Vite** | Verbreitet, viele Komponenten |
| Office | **Yjs (CRDT) + TipTap** für Text; Tabellen und Folien auf Yjs-Datenmodell; Import/Export über docx/xlsx/pptx-Bibliotheken | Echtzeit ohne Zentralkonflikte, offlinefähig |
| Mobile | **React Native (Expo)** | Teilt Typen und API-Client mit Web |
| NAS-zu-NAS | Gleiche Sync-Protokoll-Bibliothek, Server als Peer | Kein zweites Protokoll |
| Auth | OIDC/OAuth2, Argon2id, TOTP; LDAP-Adapter | Standards, Unabhängigkeit |
| Betrieb | Docker Compose, OpenTelemetry | Einfaches Self-Hosting |
| Build | pnpm-Monorepo, Turborepo | Gemeinsame Pakete |
| Test | Vitest, Playwright (E2E), Testcontainers, cargo test | TDD-fähig |

## Kernarchitektur (Clean Architecture)
`domain` (Entitäten, Regeln) → `application` (Use-Cases) → `adapters` (HTTP, DB, Speicher) → `apps`.
Abhängigkeiten zeigen nur nach innen. Das Sync-Protokoll ist ein eigenes, dokumentiertes Paket.

## Alternativen
- **Go** für den Server: sehr gut, erzwingt aber eine zweite Sprache neben Web/Mobile.
- **.NET**: starke Windows-Integration, größerer Bruch zu Web/Mobile.
- **Electron statt Tauri**: einfacher, aber deutlich größer; der Rust-Core für OS-Integration bleibt sinnvoll.
- **Flutter für Mobile**: gut, bricht aber die Typenteilung.

## Risiken
- On-Demand-Sync (Platzhalter) ist betriebssystemspezifisch und aufwendig.
- Tabellenkalkulation und Präsentation sind Großprojekte; Formattreue bei docx/xlsx ist schwer.
- Mobiler Hintergrund-Sync ist durch iOS-Regeln begrenzt.
