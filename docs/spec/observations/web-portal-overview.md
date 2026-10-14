# Beobachtung: Drive-Webportal (Übersicht)

Datum: 2026-10-14. Methode: nur Ansehen (keine Schreibaktionen). Quelle: Testinstanz, Konto mit Standardrechten.
Beschrieben ist nur Verhalten. Texte, Icons und Layout werden nicht übernommen.

## Navigation (linke Spalte)
My Drive (aufklappbar), Team Folder (aufklappbar), Shared with me, Shared with others, File Request,
Recent, Starred, Recycle Bin, My Labels (mit Plus zum Anlegen).
- Leerer persönlicher Bereich zeigt Hinweis "Plus-Taste zum Erstellen".
- Team Folder listet die für den Benutzer freigegebenen Team-Ordner (hier: `transfer`).
- Jede Ansicht hat eine Suche mit Bereichsauswahl ("in <Ansicht>" bzw. "alle Orte").

## Toolbar in My Drive
Create (Menü), Upload, Freigeben an Benutzer, Link erstellen, Label, Kopieren, Löschen, Mehr (...), Ansichtsumschalter.
Aktionen sind ohne Auswahl ausgegraut.

## Create-Menü
Folder, Document, Spreadsheet, Slides, From template, Create an encrypted file.
→ Spezifikation: F6.1–F6.3, F6.7 (Vorlagen), F10.4 (verschlüsselte Datei).

## File Request
Tabelle mit Name, Erstellzeit, Ablaufzeit, Status; Aktion "Create" zum Anlegen; leer = Hinweis.
Im Team-Folder-Kontext heißt die Schaltfläche "Create File Request".

## Benutzermenü
Konto, Speichernutzung "n Bytes used", Settings, Storage usage, Log, Client list, Apps herunterladen, Help, About, Sign out.

## Settings (Reiter)
- **Profil:** Foto, Spitzname, Beschreibung, E-Mail.
- **Allgemein:** Benachrichtigung per E-Mail (Checkbox); Hinweis, dass ein "Login-Portal" für Drive vom Admin
  aktiviert werden muss (hier nicht aktiv); Codepage für ZIP-Download/-Kompression (Standard Unicode).
- **Anzeige:** Sprache (Standard "System setting"), Datumsformat (hier dd.MM.YYYY), Zeitformat (24 Stunden),
  Anzeigename der Benutzer (Systemeinstellung).
- **E-Mail-Konto:** nicht geöffnet.
- **Office:** Standard-Locale (Browser-Standard).
→ Anforderungen für DataDrive: Profil, Benachrichtigungen, Zip-Codepage, Sprache/Datums-/Zeitformat, Anzeigename.

## Storage Usage
Dialog zeigt Verbrauch je Bereich (My Drive, jeder Team-Ordner). Gesamtkapazität nur bei gesetztem Quota.
→ F1.7 Quotas: Anzeige je Ordner, Gesamtkapazität nur mit Limit.

## Noch offen
Log, Client list, Labels, Suche/Filter, Freigabe-Dialoge, Versionsverlauf, Papierkorb, Office-Editoren,
Web-API-Aufrufe. Schreibende Tests folgen im Testordner `datadrive-spec-tests`.
