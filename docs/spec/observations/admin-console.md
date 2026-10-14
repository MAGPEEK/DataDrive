# Beobachtung: Drive-Admin-Konsole

Datum: 2026-10-14. Quelle: vom Projektinhaber bereitgestellte Bildschirmaufzeichnung (Schritte-Recorder) der
Admin-Konsole der Testinstanz. Beschrieben ist nur Verhalten und Struktur. Keine Texte, Icons oder Layouts
übernehmen. Personenbezogene Inhalte der Aufzeichnung (Dateinamen, Adressen, Domains) sind bewusst nicht hier.

## Struktur der Konsole
Navigation links, zwei Gruppen:
- **Drive:** Overview, Client List, Log, Team Folder, Advanced Features, Settings.
- **Office:** Font, Version Rotation, AI Assistant.

## Team Folder (Übersicht)
Tabelle je Ordner mit Spalten: Name, Status (Enabled / Not available / Not enabled), Anzahl Versionen,
Restrict Downloads, Watermark, File Locking (je On/Off). Aktionen: Enable, Disable, Settings, Version Explorer, Suche.
- Der persönliche Bereich ("My Drive (home)") erscheint als besonderer Eintrag, Status Enabled.
- Ordner, die nicht als Team-Ordner nutzbar sind, zeigen "Not available" mit Info-Hinweis.
→ DataDrive: F9.6 Team-Ordner verwalten, je Ordner Versionen, Download-Sperre, Wasserzeichen, Dateisperre.

## Version Explorer
Dialog zum Durchsuchen früherer Stände eines Ordnerbaums:
- Zeitpunkt wählbar: Datum plus Uhrzeit in **Stundenschritten**; Schaltfläche "Go".
- "View role": Ansicht als ein bestimmter Benutzer, mit "Change" (Admin kann Benutzer wechseln).
- Ordnerbaum (My Drive, Team-Ordner) und Dateiliste (Name, Größe, Typ, Änderungsdatum), Zähler "n items".
- Aktionen: Browse previous versions, Restore, Download, More, Option "Show deleted files", Suche in aktueller Seite.
→ DataDrive: F4.4, ergänzt um Zeitpunkt-Ansicht des ganzen Baums und Sicht "als Benutzer".

## Log
Aktionen Refresh, Export (Protokoll exportieren) und Settings (Aufbewahrung/Rotation, mit Apply).
→ F9.2 ergänzt um Export und Protokolleinstellungen.

## Advanced Features
Baum mit **Remote Wipe**, **Restrict Downloads**, **Watermark**. Aktivierung hier ist Voraussetzung, damit
File Request, Shared Labels und File Locking in den Einstellungen nutzbar werden (Hinweis "zum Aktivieren
Advanced Features öffnen").

## Settings – Reiter General
- **Package Usage:** Speicherort (Volume mit freier Kapazität), "Calculate", Ergebnis: Dateiversionen,
  Datenbank, Office-Dateien, Zeitpunkt der letzten Berechnung.
- **Empty Recycle Bins:** nur Team-Ordner-Papierkörbe; "Empty Now" und zeitgesteuert (Schedule).
- **Content Indexing:** Inhaltsindex für neue persönliche Bereiche und neu aktivierte Team-Ordner; Anpassung je Ordner.
- **Performance:** ungenutzten Speicher als Datenbank-Cache nutzen; reservierter Anteil für andere Anwendungen (%, Standard 30).
- **Email Notification Service:** Einrichtung des Mailversands.
- **Display Name:** Standardanzeige (Benutzername).
- **Sync and Backup Permission for Non-admin Users:** Schalter, ob normale Benutzer Sync/Backup nutzen dürfen
  (gilt auch für Server-zu-Server-Sync).
- **File Ownership Transfer:** alle Dateien von Benutzer A nach Benutzer B übertragen (vor dem Löschen eines Benutzers).

## Settings – User Sync Profiles
Liste (Name, Beschreibung, angewendete Benutzer) mit Create, Edit, Remove. Profile bündeln Client-Sync-Regeln
und werden Benutzern/Gruppen zugewiesen. Leer in der Testinstanz.
→ F9.4 konkretisiert.

## Settings – Sharing
- Dateifreigabe für Nicht-Admins erlauben; Art: interner Link, Kontoeinladung oder beides.
- Öffentliche Freigabe erlauben; optional nur bestimmte Benutzer; Passwortpflicht; Ablaufpflicht mit maximaler Gültigkeit (Tage).
- Link per E-Mail senden erlauben.
- **Sharing Link Report:** Export aller Freigabelinks (Pfad, Berechtigung, letzte Änderung).
- Links anpassen: HTTPS erzwingen; eigene Domain/Format der Links.
- **File Request Settings:** Anforderungslinks erlauben, nur für bestimmte Benutzer, Passwortpflicht, Ablaufpflicht,
  E-Mail-Versand.
→ F5.4 (Admin-Richtlinien für Freigaben), F5.5 (Linkbericht).

## Settings – Shared Labels, File Locking
- **Shared Labels:** Liste (aktiv, Name, Besitzer, Rechte, Einladungsliste Benutzer/Gruppen) mit Create, Edit, Delete, Manage Privilege.
- **File Locking:** eigener Reiter (Dateisperren verwalten); nur nutzbar, wenn in Advanced Features aktiviert.
