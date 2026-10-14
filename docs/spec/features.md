# Funktionsspezifikation DataDrive

Quelle: öffentliche Produkt- und Hilfeseiten von Synology Drive. Status `offen` = noch nicht gegen die
Testinstanz verifiziert. Jede Zeile wird zu Abnahmetests (`tests/acceptance`).
Priorität: P0 Kern, P1 Ausbau, P2 Erweiterung.

## F1 Konten und Ordner
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F1.1 | Benutzer, Gruppen, Rollen, Anmeldung (2FA) | P0 | teilweise (Passwort, Sitzung, TOTP, Admin-Anlage; Gruppen fehlen) |
| F1.2 | Persönlicher Bereich je Benutzer | P0 | teilweise (Ordner, Postgres) |
| F1.3 | Team-Ordner mit Rechten (lesen/schreiben/verwalten) | P0 | offen |
| F1.4 | Ansicht "Für mich freigegeben" | P0 | offen |
| F1.5 | Persönliche und gemeinsame Labels | P1 | offen |
| F1.6 | Papierkorb, Suche, Zuletzt verwendet | P1 | teilweise (Papierkorb, Postgres) |
| F1.7 | Quotas pro Benutzer/Ordner | P1 | offen |

## F2 Synchronisierung
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F2.1 | Zwei-Wege-Sync Windows/macOS/Ubuntu, Konfliktbehandlung | P0 | offen |
| F2.2 | Selektive Ordnerauswahl, Ausschlussregeln | P0 | offen |
| F2.3 | On-Demand-Sync (Platzhalter, "lokal anheften") | P1 | offen |
| F2.4 | Block-/Delta-Sync, Resume bei Abbruch | P1 | offen |
| F2.5 | LAN-Erkennung / direkter Transfer | P2 | offen |

## F3 Backup (Client)
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F3.1 | Echtzeit- und geplante Ordner-Backups | P1 | offen |
| F3.2 | Ransomware-/Löschschutz über Versionen | P1 | offen |
| F3.3 | Wiederherstellung einzelner Dateien/Stände | P1 | offen |

## F4 Versionierung
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F4.1 | Bis zu 32 Versionen je Datei, Aufbewahrung 7/30/60/120 Tage | P0 | offen |
| F4.2 | FIFO und "Intelliversioning" (signifikante Versionen) | P1 | offen |
| F4.3 | Deduplizierung über Versionen | P1 | offen |
| F4.4 | Version Explorer (minutengenau, ansehen/laden/wiederherstellen) | P1 | offen |

## F5 Freigabe
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F5.1 | Interne Freigabe an Benutzer/Gruppen mit Rolle | P0 | offen |
| F5.2 | Externe Links: Passwort, Ablauf, Download-Limit, Rechte | P0 | offen |
| F5.3 | Anforderungslinks (Dateien von Externen sammeln) | P1 | offen |

## F6 Office (Zusammenarbeit)
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F6.1 | Textdokumente, Echtzeit-Mehrbenutzerbearbeitung | P1 | offen |
| F6.2 | Tabellen | P1 | offen |
| F6.3 | Präsentationen | P2 | offen |
| F6.4 | Import/Export MS Office (docx/xlsx/pptx) und ODF | P1 | offen |
| F6.5 | Dateisperre bei gleichzeitiger Bearbeitung | P0 | offen |
| F6.6 | Kommentare, Versionsverlauf der Dokumente | P2 | offen |
| F6.7 | Vorlagen für neue Dokumente | P2 | offen |

## F7 NAS-zu-NAS und Cloud
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F7.1 | ShareSync: zweiseitig, einseitig (push/pull), Teilordner | P1 | offen |
| F7.2 | Sync von Rechten/Metadaten wählbar | P2 | offen |
| F7.3 | Hybrid Share: Cloud-Speicher-Anbindung (S3-kompatibel) | P2 | offen |

## F8 Mobile
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F8.1 | iOS/Android: Browsen, Hoch-/Herunterladen, Offline-Dateien | P1 | offen |
| F8.2 | Automatischer Foto-Upload | P2 | offen |
| F8.3 | Biometrische Sperre, Remote-Wipe | P2 | offen |

## F9 Administration
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F9.1 | Dashboard: Clients, Server-Status, Nutzungstrends | P1 | offen |
| F9.2 | Aktivitätsprotokoll (~40 Aktionstypen), Filter (IP, Ereignis, Benutzer) | P1 | offen |
| F9.3 | LDAP/Active-Directory-Anbindung | P1 | offen |
| F9.4 | Gruppenrichtlinien für Client-Sync/-Backup, Massen-Rollout | P2 | offen |
| F9.5 | Remote-Löschen synchronisierter Dateien | P2 | offen |

## F10 Sicherheit
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F10.1 | Download-Sperre je Ordner/Freigabe | P1 | offen |
| F10.2 | Wasserzeichen | P2 | offen |
| F10.3 | TLS überall, Verschlüsselung ruhender Daten | P0 | offen |
| F10.4 | Verschlüsselte Dateien (Passwort, clientseitig) | P2 | offen |

## F11 Entwickler
| ID | Funktion | Prio | Status |
|---|---|---|---|
| F11.1 | Öffentliche REST-API (OpenAPI), API-Tokens | P1 | offen |
| F11.2 | Webhooks | P2 | offen |

## Nicht-funktional
- Selbst hostbar per Docker Compose, keine Lizenzschlüssel, keine Cloud-Pflicht.
- Skalierbar von kleinem Heimserver bis Rechenzentrum.
- Offene API und Formate, Export aller Daten (Unabhängigkeit).
