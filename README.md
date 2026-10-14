# DataDrive

**DataDrive** ist eine synchronisierte Plattform für den Datenaustausch. Dateien liegen auf einem eigenen
Server und stehen auf allen Geräten bereit: im Browser, auf dem Desktop und auf dem Smartphone.
Der Aufbau orientiert sich funktional an Diensten wie Synology Drive.

## Was DataDrive kann (Ziel)
- **Synchronisierung:** automatischer Abgleich zwischen Server und Geräten (Windows, macOS, Linux),
  wahlweise nur bei Bedarf geladen (On-Demand).
- **Backup:** geplante und Echtzeit-Sicherung wichtiger Ordner, Schutz vor Ransomware und versehentlichem Löschen.
- **Versionierung:** frühere Dateistände ansehen und wiederherstellen.
- **Freigabe und Datenaustausch:** interne Freigaben mit Rollen, externe Links mit Passwort und Ablauf,
  Anforderungslinks zum Einsammeln von Dateien.
- **Team-Ordner und Labels:** gemeinsame Bereiche, persönliche und gemeinsame Markierungen.
- **Zusammenarbeit:** Dokumente, Tabellen und Präsentationen in Echtzeit gemeinsam bearbeiten.
- **Server-zu-Server-Sync:** mehrere DataDrive-Standorte gleichen sich zweiseitig oder einseitig ab.
- **Mobile Apps:** iOS und Android mit Offline-Dateien.
- **Administration:** Dashboard, Aktivitätsprotokoll, Benutzer- und Gruppenverwaltung, LDAP/AD.
- **Sicherheit:** Verschlüsselung, Download-Sperre, Wasserzeichen, Remote-Löschen.
- **Offene API** zur Integration in eigene Abläufe.

## Grundsätze
- **Unabhängig und selbst gehostet:** keine Cloud-Pflicht, keine Lizenzschlüssel.
- **Alles in Containern:** Betrieb, Entwicklung, Tests und Builds laufen mit Docker.
- **Clean Code:** Clean Architecture, Tests zuerst, strenge Linter, siehe [Regeln](docs/CLEAN-CODE.md).
- **Clean-Room:** nachgebaut wird beobachtetes Verhalten. Kein Code, Design, Text und keine Marke
  eines anderen Produkts wird übernommen. DataDrive steht in keiner Verbindung zu Synology.

## Stand
Phase 1 – Analyse und Spezifikation. Es gibt noch keine lauffähige Software.

## Dokumentation
- [Funktionsspezifikation](docs/spec/features.md)
- [Entscheidung Tech-Stack (ADR 0001)](docs/adr/0001-tech-stack.md)
- [Clean-Code-Regeln](docs/CLEAN-CODE.md)
- [Roadmap](docs/ROADMAP.md)
- Logo: [brand/logo.svg](brand/logo.svg)
