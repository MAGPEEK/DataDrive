# Beobachtung: Verhalten der Drive-API (Referenzsystem)

Datum: 2026-10-14. Methode: Aufrufe der Web-API aus der angemeldeten Weboberfläche, nur im Testordner des
Testkontos. Beschrieben ist Verhalten, nicht Implementierung. Keine Zugangsdaten, Adressen oder Tokens notiert.

## Modulübersicht der API (aus der öffentlichen API-Erkennung)
Die Oberfläche nutzt einen einzigen Endpunkt mit Modul + Methode + Version. Module (Auswahl, nach Funktion gruppiert):
- **Dateien/Knoten:** Files (bis Version 11), Node, Node.Delete, Node.Download, Node.Restore, Trash, Revisions
  (Versionen), NodeLocking, NodeLockingOption, Labels, Photos, Index (Suche).
- **Freigabe:** Share, Share.Priv, Sharing, Sharing.Report, AdvanceSharing(.Public), FileRequest(.Public), Privilege.
- **Verwaltung:** Settings, Profiles (Sync-Profile), TeamFolders, Users, Dashboard, Statistics, Log, DBUsage, Config,
  Activation, Webhooks, Notifications, Authentication, Connection, Migration, KeyManagement (Verschlüsselung).
- **Office:** Zusammenarbeit über eigene Module für Dokumente, Tabellen, Folien, Vorlagen, Schriften, Snapshots/Verlauf, Rechte.
- **ShareSync:** Config, Connection, Session.
→ Für DataDrive: ein Modul pro Funktionsbereich (REST statt Einzelendpunkt), gleiche fachliche Trennung.

## Knotenmodell (Felder, die jede Datei/jeder Ordner liefert)
Typ (Ordner/Datei), Name, Anzeige-Pfad, stabile numerische ID, Eltern-ID, Besitzer, Erstell-/Änderungs-/Zugriffszeit,
Änderungszähler je Knoten (`change_id`) und globaler Höchstwert (`max_id`) → Grundlage für Sync per Änderungsliste,
Hash, Labels, Flags (verschlüsselt, Download gesperrt, Wasserzeichen, erweitert freigegeben) und **Fähigkeiten pro Benutzer**:
lesen, schreiben, löschen, umbenennen, organisieren, herunterladen, freigeben, synchronisieren, kommentieren,
sperren, automatisch sperren, verschlüsseln, Vorschau.
→ DataDrive: Knoten-DTO um `capabilities` erweitern (aus Rolle und Laufwerkseinstellungen berechnet).

## Namensregeln (Ordner anlegen)
| Eingabe | Ergebnis |
|---|---|
| gleicher Name, auch anders geschrieben ("alpha" vs "Alpha") | Fehler "Name vergeben" (Code 1022); Vergleich ohne Groß-/Kleinschreibung |
| Konfliktaktion "automatisch umbenennen" | legt "Alpha (1)" an |
| Name mit Leerzeichen am Anfang oder Ende | **erlaubt** (wird nicht getrimmt, kollidiert nicht mit dem Namen ohne Leerzeichen) |
| `:` `*` `?` `<` `>` `"` `\|` im Namen | erlaubt |
| `...`, Emoji, `con`, Name mit Endpunkt | erlaubt |
| `\` im Namen, `.` oder `..` | abgelehnt (Code 1000) |
| 255 Bytes (UTF-8) | erlaubt; 254 Bytes mit Mehrbyte-Zeichen erlaubt |
| 256 Bytes (auch 128 × "ä" oder 64 × Emoji) | abgelehnt (Code 1035). Grenze zählt **Bytes**, nicht Zeichen |
| Namen mit `/` im API-Pfad | wird als Pfadtrennung gelesen (Zwischenordner entstehen); die Oberfläche lehnt `/` in Namen ab |

Fehlercodes des Moduls: 1000 ungültiger Parameter/Name, 1003 ungültiger Pfad, 1022 Name existiert, 1035 Name zu lang,
401 unbekannte Aufgaben-ID, 103 unbekannte Methode.

## Löschen und Papierkorb
- Löschen läuft **asynchron**: die Antwort enthält eine Aufgaben-ID; danach ist der Knoten sofort aus der Liste verschwunden.
- Papierkorb-Einträge liefern: Originalpfad, Zeitpunkt des Löschens (`recycled_time`), Markierung `removed`, Versions-ID.
  Anzeigepfad liegt unter einem eigenen Papierkorb-Bereich je Laufwerk.
- Nach dem Löschen darf der Name sofort neu vergeben werden.
- **Achtung Pfadauflösung:** Beim Löschen per Pfad wurde ein anderer Eintrag getroffen als erwartet (Pfade werden ohne
  Beachtung von Groß-/Kleinschreibung und Randzeichen aufgelöst). → DataDrive adressiert Knoten immer über die ID, nie über Pfade.
- Wiederherstellen bei Namenskonflikt: noch nicht beobachtet (offen).

## Folgen für DataDrive
1. Namensregel angepasst (Bytes statt Zeichen, Randleerzeichen erlaubt) – Tests in `node-name.test.ts`.
2. Konfliktaktion `autorename` (Name (1), (2) …) für Upload und Anlegen vorsehen (F2.1/F1.x).
3. Änderungszähler je Knoten und je Laufwerk für den Sync einplanen (ADR 0003).
4. Fähigkeiten pro Benutzer im Knoten-DTO (Basis für UI und Clients).
5. Löschen als Hintergrundaufgabe nur bei großen Bäumen; kleine Löschungen synchron (einfacher, gleiches Ergebnis).
